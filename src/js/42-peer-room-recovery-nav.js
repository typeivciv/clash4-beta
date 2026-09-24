'use strict';
const PEER_ROOM_RECOVERY_NAV_VERSION='0.20.6';
const PEER_ROOM_RECOVERY_CONNECT_TIMEOUT_MS=18000;
const PEER_ROOM_RECOVERY_MAX_BACKOFF_MS=4200;

const peerRoomRecoveryState={
  attempt:0,connecting:false,generation:0,attemptTimer:null,lastIce:'new',lastConnection:'new',
  lastError:'',lastAttemptAt:0,lastWelcomeAt:0,lastConn:null
};
globalThis.peerRoomRecoveryState=peerRoomRecoveryState;

function peerRoomRecoveryClearAttemptTimer(){if(peerRoomRecoveryState.attemptTimer)clearTimeout(peerRoomRecoveryState.attemptTimer);peerRoomRecoveryState.attemptTimer=null}
function peerRoomRecoveryRetryDelay(){return Math.min(PEER_ROOM_RECOVERY_MAX_BACKOFF_MS,650+peerRoomRecoveryState.attempt*650)}
function peerRoomRecoveryRouteText(){return `ICE ${peerRoomRecoveryState.lastIce||'unknown'} · connection ${peerRoomRecoveryState.lastConnection||'unknown'}`}
function peerRoomRecoveryEnsureUi(){
  if(typeof document==='undefined')return null;
  let button=document.getElementById('peerRoomRetryConnection');if(button)return button;
  const status=document.getElementById('peerRoomStatus');if(!status)return null;
  button=document.createElement('button');button.id='peerRoomRetryConnection';button.className='duelSecondary peerRoomRetryConnection';button.type='button';button.hidden=true;button.textContent='Retry Connection';button.setAttribute('aria-label','Retry Peer Room connection');
  button.addEventListener('click',()=>peerRoomRecoveryRetryNow({freshPeer:true}));status.after(button);return button
}
function peerRoomRecoveryShowRetry(show=true){const button=peerRoomRecoveryEnsureUi();if(button)button.hidden=!show}
function peerRoomRecoverySetStatus(text,tone='warn'){try{peerRoomStatus(text,tone)}catch{}}
function peerRoomRecoveryResetSuccess(){
  peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryState.attempt=0;peerRoomRecoveryState.connecting=false;peerRoomRecoveryState.lastError='';peerRoomRecoveryState.lastWelcomeAt=Date.now();
  if(peerRoom.reconnectTimer)clearTimeout(peerRoom.reconnectTimer);peerRoom.reconnectTimer=null;peerRoomRecoveryShowRetry(false)
}
function peerRoomRecoveryReleaseConn(conn,{close=true}={}){
  if(!conn)return;peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryState.connecting=false;
  if(peerRoom.conn===conn)peerRoom.conn=null;if(peerRoomRecoveryState.lastConn===conn)peerRoomRecoveryState.lastConn=null;
  if(close)try{conn.close()}catch{}
}
function peerRoomRecoveryObserveConnection(conn){
  if(!conn||conn.__peerRoomRecoveryObserved)return conn;conn.__peerRoomRecoveryObserved=true;peerRoomRecoveryState.lastConn=conn;
  const pc=conn.peerConnection;
  const sample=()=>{
    if(!pc)return;peerRoomRecoveryState.lastIce=pc.iceConnectionState||peerRoomRecoveryState.lastIce;peerRoomRecoveryState.lastConnection=pc.connectionState||peerRoomRecoveryState.lastConnection;
    if(pc.iceConnectionState==='failed'||pc.connectionState==='failed')peerRoomRecoveryFailConnection(conn,{type:'webrtc',message:'WebRTC route failed.'},'route-failed')
  };
  pc?.addEventListener?.('iceconnectionstatechange',sample);pc?.addEventListener?.('connectionstatechange',sample);sample();
  conn.on?.('open',()=>{peerRoomRecoveryState.connecting=false;peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryShowRetry(false)});
  conn.on?.('data',data=>{if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-welcome')peerRoomRecoveryResetSuccess()});
  conn.on?.('error',error=>peerRoomRecoveryFailConnection(conn,error,'data-error'));
  conn.on?.('close',()=>{if(peerRoom.intentionalClose||peerRoom.role!=='guest')return;peerRoomRecoveryState.connecting=false;if(peerRoom.conn===conn)peerRoom.conn=null;peerRoomRecoveryShowRetry(true)});
  return conn
}
function peerRoomRecoveryFailConnection(conn,error,reason='error'){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest')return;
  if(conn&&peerRoom.conn&&conn!==peerRoom.conn)return;
  peerRoomRecoveryState.lastError=String(error?.type||error?.message||reason);peerRoomRecoveryState.attempt=Math.min(99,peerRoomRecoveryState.attempt+1);peerRoomRecoveryState.connecting=false;
  peerRoomRecoveryReleaseConn(conn,{close:true});peerRoom.active=false;peerRoomRecoveryShowRetry(true);
  peerRoomRecoverySetStatus(`WebRTC connection interrupted (${peerRoomRecoveryRouteText()}). Retrying automatically…`,'warn');peerRoomScheduleReconnect()
}
function peerRoomRecoveryBindPeer(peer){
  if(!peer||peer.__peerRoomRecoveryBound)return peer;peer.__peerRoomRecoveryBound=true;
  peer.on?.('open',()=>{if(peerRoom.peer!==peer||peerRoom.intentionalClose)return;peerRoomRecoveryState.connecting=false;peerRoomGuestConnect()});
  peer.on?.('disconnected',()=>{if(peerRoom.peer!==peer||peerRoom.intentionalClose)return;peerRoomRecoveryState.connecting=false;peerRoomRecoveryShowRetry(true);peerRoomScheduleReconnect(500)});
  peer.on?.('error',error=>{if(peerRoom.peer!==peer||peerRoom.intentionalClose)return;peerRoomRecoveryState.lastError=String(error?.type||error?.message||'peer-error');peerRoomRecoveryState.connecting=false;peerRoomRecoveryShowRetry(true);peerRoomRecoverySetStatus(error?.type==='peer-unavailable'?'Host rendezvous is temporarily unavailable. Retrying the same invite…':`Pairing error: ${error?.message||error?.type||'unknown'}. Retrying…`,'warn');peerRoomScheduleReconnect()});
  return peer
}
function peerRoomRecoveryCreateGuestPeer(){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest'||!globalThis.Peer)return null;
  const previous=peerRoom.peer;try{previous?.destroy?.()}catch{};
  try{const peer=new Peer(undefined,{debug:0,config:peerRoomConnectionConfig()});peerRoom.peer=peer;peerRoomRecoveryBindPeer(peer);return peer}catch(error){peerRoomRecoveryState.lastError=String(error?.message||error);peerRoomRecoveryShowRetry(true);peerRoomScheduleReconnect();return null}
}
function peerRoomRecoveryDial(peer){
  if(!peer||peerRoomRecoveryState.connecting||peerRoom.intentionalClose||peerRoom.role!=='guest')return;
  if(peerRoom.conn?.open){peerRoomRecoveryResetSuccess();return}
  if(peerRoom.conn){try{peerRoom.conn.close()}catch{};peerRoom.conn=null}
  peerRoomRecoveryState.connecting=true;peerRoomRecoveryState.lastAttemptAt=Date.now();const generation=++peerRoomRecoveryState.generation;
  peerRoomRecoverySetStatus(peerRoomRecoveryState.attempt?`Retry ${peerRoomRecoveryState.attempt} · finding the host…`:'Finding the host…');
  try{
    const conn=peer.connect(peerRoom.hostId,{reliable:true,serialization:'json',metadata:{protocol:PEER_ROOM_PROTOCOL,clientKey:peerRoom.clientKey}});peerRoom.conn=conn;peerRoomGuestBind(conn);peerRoomRecoveryObserveConnection(conn);
    peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryState.attemptTimer=setTimeout(()=>{if(generation!==peerRoomRecoveryState.generation||conn.open||peerRoom.intentionalClose)return;peerRoomRecoveryFailConnection(conn,{type:'timeout',message:'Connection attempt timed out.'},'timeout')},PEER_ROOM_RECOVERY_CONNECT_TIMEOUT_MS)
  }catch(error){peerRoomRecoveryState.connecting=false;peerRoomRecoveryFailConnection(null,error,'dial-error')}
}

const peerRoomGuestBindBeforeRecovery=peerRoomGuestBind;
peerRoomGuestBind=function(conn){const out=peerRoomGuestBindBeforeRecovery(conn);peerRoomRecoveryObserveConnection(conn);return out};
globalThis.peerRoomGuestBind=peerRoomGuestBind;

peerRoomScheduleReconnect=function(delay=null){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest'||peerRoom.reconnectTimer||peerRoom.conn?.open)return;
  const wait=Math.max(100,Number.isFinite(Number(delay))?Number(delay):peerRoomRecoveryRetryDelay());
  peerRoom.reconnectTimer=setTimeout(()=>{peerRoom.reconnectTimer=null;peerRoomGuestConnect()},wait)
};
globalThis.peerRoomScheduleReconnect=peerRoomScheduleReconnect;

peerRoomGuestConnect=function(){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest'||!peerRoom.hostId)return;
  if(peerRoom.conn?.open){peerRoomRecoveryResetSuccess();return}
  if(peerRoomRecoveryState.connecting)return;
  let peer=peerRoom.peer;
  if(!peer||peer.destroyed){peer=peerRoomRecoveryCreateGuestPeer();if(!peer)return}
  peerRoomRecoveryBindPeer(peer);
  if(peer.disconnected){try{peer.reconnect()}catch{};peerRoomScheduleReconnect(450);return}
  if(peer.open===false){peerRoomScheduleReconnect(350);return}
  peerRoomRecoveryDial(peer)
};
globalThis.peerRoomGuestConnect=peerRoomGuestConnect;

function peerRoomRecoveryRetryNow({freshPeer=false}={}){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest')return false;
  if(peerRoom.reconnectTimer)clearTimeout(peerRoom.reconnectTimer);peerRoom.reconnectTimer=null;peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryState.connecting=false;
  if(peerRoom.conn){try{peerRoom.conn.close()}catch{};peerRoom.conn=null}
  if(freshPeer||peerRoomRecoveryState.attempt>=2)peerRoomRecoveryCreateGuestPeer();
  peerRoomRecoverySetStatus('Retrying the same Peer Room invite…','warn');setTimeout(peerRoomGuestConnect,80);return true
}
globalThis.peerRoomRecoveryRetryNow=peerRoomRecoveryRetryNow;

const peerRoomGuestMessageBeforeRecovery=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-welcome')peerRoomRecoveryResetSuccess();return peerRoomGuestMessageBeforeRecovery(data)};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

const peerRoomJoinBeforeRecovery=peerRoomJoin;
peerRoomJoin=function(hostId){
  peerRoomRecoveryClearAttemptTimer();peerRoomRecoveryState.attempt=0;peerRoomRecoveryState.connecting=false;peerRoomRecoveryState.lastIce='new';peerRoomRecoveryState.lastConnection='new';peerRoomRecoveryState.lastError='';peerRoomRecoveryShowRetry(false);
  const out=peerRoomJoinBeforeRecovery(hostId);setTimeout(()=>{peerRoomRecoveryEnsureUi();if(peerRoom.role==='guest'){peerRoomRecoveryBindPeer(peerRoom.peer);if(peerRoom.conn)peerRoomRecoveryObserveConnection(peerRoom.conn)}},0);return out
};
globalThis.peerRoomJoin=peerRoomJoin;if(globalThis.peerRoomFoundation)globalThis.peerRoomFoundation.join=peerRoomJoin;

// ---------- universal Back coverage ----------
function c4BackVisible(el){if(!el||el.hidden)return false;try{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&el.getClientRects().length>0}catch{return !el.hidden}}
function c4BackNative(){return [...document.querySelectorAll('#duelBackButton,#duelDirectBack,#duelOnlineBack,#peerRoomBack,#peerRoomMatchLobbyButton,.introBack,.duelSectionBack')].find(c4BackVisible)||null}
function c4BackOnHome(){const active=document.querySelector('.introScreen.active');return !!(active&&(active.classList.contains('gameHome')||/home/i.test(active.id||'')))}
function c4BackEnsure(){
  if(typeof document==='undefined')return null;let button=document.getElementById('c4UniversalBack');if(button)return button;
  button=document.createElement('button');button.id='c4UniversalBack';button.className='c4UniversalBack';button.type='button';button.textContent='← Back';button.setAttribute('aria-label','Go back');button.addEventListener('click',c4BackAction);document.body.append(button);return button
}
function c4BackAction(){
  const modal=document.getElementById('alphaTesterModal');if(modal&&!modal.hidden){document.getElementById('alphaTesterClose')?.click();return}
  const help=document.querySelector('.helpOverlay.show');if(help){document.querySelector('.helpClose')?.click();return}
  if(globalThis.peerRoomMatch?.phase==='active'&&document.body.classList.contains('peer-room-match-active')){globalThis.peerRoomMatchRequestLobby?.();return}
  const waiting=document.getElementById('duelWaitingPanel');if(c4BackVisible(waiting)){document.getElementById('duelLeaveButton')?.click();return}
  for(const id of ['peerRoomBack','duelDirectBack','duelOnlineBack','duelBackButton']){const el=document.getElementById(id);if(c4BackVisible(el)){el.click();return}}
  for(const id of ['homeBottom','reviewHome','sidebarHome']){const el=document.getElementById(id);if(c4BackVisible(el)){el.click();return}}
  const native=c4BackNative();if(native){native.click();return}
  try{if(typeof globalThis.setIntroScreen==='function'){globalThis.setIntroScreen('home');return}}catch{}
  try{if(history.length>1)history.back()}catch{}
}
function c4BackSync(){const button=c4BackEnsure();if(!button)return;button.hidden=!!c4BackNative()||c4BackOnHome()}
function c4BackInstallStyle(){
  if(document.querySelector('style[data-c4-back-recovery]'))return;const style=document.createElement('style');style.dataset.c4BackRecovery='1';style.textContent=`
  .peerRoomRetryConnection{width:100%;margin:8px 0 2px;min-height:44px}
  .c4UniversalBack{position:fixed;z-index:120;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));min-height:42px;padding:8px 12px;border:1px solid #40516b;border-radius:11px;background:rgba(12,20,33,.94);color:#eef4ff;font:800 12px/1 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(8px)}
  .c4UniversalBack[hidden]{display:none!important}@media(pointer:coarse){.c4UniversalBack{min-height:44px;min-width:76px}}`;
  document.head.append(style)
}

if(typeof document!=='undefined'){
  c4BackInstallStyle();peerRoomRecoveryEnsureUi();c4BackEnsure();c4BackSync();
  const observer=new MutationObserver(()=>requestAnimationFrame(c4BackSync));observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','style']});
  window.addEventListener('resize',()=>requestAnimationFrame(c4BackSync),{passive:true});window.addEventListener('pageshow',()=>requestAnimationFrame(c4BackSync),{passive:true});
  if(peerRoom?.role==='guest'){peerRoomRecoveryBindPeer(peerRoom.peer);if(peerRoom.conn)peerRoomRecoveryObserveConnection(peerRoom.conn);else peerRoomScheduleReconnect(250)}
}

globalThis.peerRoomRecoveryNav={version:PEER_ROOM_RECOVERY_NAV_VERSION,state:peerRoomRecoveryState,retry:peerRoomRecoveryRetryNow,syncBack:c4BackSync};

// WebKit's requestAnimationFrame can be delayed by a full frame bucket even while visible.
// Override the 0.20.6 presentation clock with absolute setTimeout targets. Every callback
// re-checks Date.now(), so early timers are corrected without chaining drift from prior events.
if(typeof globalThis.peerRoomPresentationSyncScheduleAt==='function'&&globalThis.peerRoomPresentationSyncState?.schedules){
  globalThis.peerRoomPresentationSyncScheduleAt=function(name,targetAt,fn){
    try{globalThis.peerRoomPresentationSyncCancelSchedule?.(name)}catch{
      const prior=globalThis.peerRoomPresentationSyncState.schedules.get(name);if(prior?.timer)clearTimeout(prior.timer);globalThis.peerRoomPresentationSyncState.schedules.delete(name)
    }
    const target=Number(targetAt),record={targetAt:Number.isFinite(target)?target:Date.now(),raf:null,timer:null,cancelled:false};
    globalThis.peerRoomPresentationSyncState.schedules.set(name,record);
    const fire=()=>{
      if(record.cancelled||globalThis.peerRoomPresentationSyncState.schedules.get(name)!==record)return;
      const remaining=record.targetAt-Date.now();
      if(remaining>1){record.timer=setTimeout(fire,remaining);return}
      globalThis.peerRoomPresentationSyncState.schedules.delete(name);fn()
    };
    record.timer=setTimeout(fire,Math.max(0,record.targetAt-Date.now()));return record
  };
  try{peerRoomPresentationSyncScheduleAt=globalThis.peerRoomPresentationSyncScheduleAt}catch{}
  if(globalThis.peerRoomPresentationSync)globalThis.peerRoomPresentationSync.scheduleAt=globalThis.peerRoomPresentationSyncScheduleAt
}
