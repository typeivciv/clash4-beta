'use strict';
const DIRECT_CHAT_VERSION='0.18.4';
const DIRECT_CHAT_PROTOCOL=1;
const DIRECT_CHAT_MAX_MESSAGES=50;
const DIRECT_CHAT_MAX_CHARS=200;
const DIRECT_CHAT_MIN_SEND_MS=500;
const DIRECT_CHAT_BURST_WINDOW_MS=10_000;
const DIRECT_CHAT_BURST_MAX=8;
const DIRECT_CHAT_QUICK=['Nice move!','Good game!','Rematch?','🔥','😂','😮'];
let directChatState={messages:[],seenIds:new Set(),open:false,muted:false,unread:0,lastSendAt:0,sendTimes:[],incomingTimes:[],returnFocus:null,wasConnected:false};

function directChatEl(id){return document.getElementById(id)}
function directChatNormalizeText(value){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,DIRECT_CHAT_MAX_CHARS)}
function directChatConnected(){return !!(typeof directDuel!=='undefined'&&directDuel?.active&&directDuel?.channel?.readyState==='open')}
function directChatBlockingOverlay(){return !!document.querySelector('.overlay.show,.end.show,.coinOverlay.show,.helpOverlay.show,.alphaTesterModal:not([hidden])')}
function directChatTimestamp(ms){try{return new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit'}).format(new Date(ms))}catch{return''}}
function directChatMakeId(){try{return crypto.randomUUID()}catch{return`c4chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}}
function directChatTrimSeen(){if(directChatState.seenIds.size<=120)return;directChatState.seenIds=new Set(directChatState.messages.map(message=>message.id))}
function directChatRemember(message){
  if(!message?.id||directChatState.seenIds.has(message.id))return false;
  directChatState.seenIds.add(message.id);directChatState.messages.push(message);
  if(directChatState.messages.length>DIRECT_CHAT_MAX_MESSAGES)directChatState.messages.splice(0,directChatState.messages.length-DIRECT_CHAT_MAX_MESSAGES);
  directChatTrimSeen();return true
}
function directChatRender(){
  const log=directChatEl('directChatLog'),empty=directChatEl('directChatEmpty'),badge=directChatEl('directChatBadge'),mute=directChatEl('directChatMute'),count=directChatEl('directChatCount'),fab=directChatEl('directChatFab');
  if(log){
    log.querySelectorAll('.directChatMessage').forEach(node=>node.remove());
    for(const message of directChatState.messages){
      const row=document.createElement('div');row.className=`directChatMessage ${message.mine?'mine':'theirs'}`;
      const meta=document.createElement('div');meta.className='directChatMeta';
      const who=document.createElement('strong');who.textContent=message.mine?'You':'Opponent';
      const time=document.createElement('time');time.textContent=directChatTimestamp(message.receivedAt);time.dateTime=new Date(message.receivedAt).toISOString();
      const text=document.createElement('p');text.textContent=message.text;
      meta.append(who,time);row.append(meta,text);log.append(row)
    }
    if(directChatState.open)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight})
  }
  if(empty)empty.hidden=directChatState.messages.length>0;
  if(badge){badge.textContent=directChatState.unread>99?'99+':String(directChatState.unread);badge.hidden=directChatState.unread===0||directChatState.muted}
  if(fab)fab.setAttribute('aria-label',directChatState.unread&&!directChatState.muted?`Open Direct Duel chat, ${directChatState.unread} unread ${directChatState.unread===1?'message':'messages'}`:'Open Direct Duel chat');
  if(mute){mute.textContent=directChatState.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(directChatState.muted))}
  if(count){const input=directChatEl('directChatInput');count.textContent=`${input?.value?.length||0}/${DIRECT_CHAT_MAX_CHARS}`}
}
function directChatSetOpen(open,{restoreFocus=true}={}){
  const drawer=directChatEl('directChatDrawer'),fab=directChatEl('directChatFab');if(!drawer||!fab)return;
  directChatState.open=!!open;drawer.hidden=!open;fab.setAttribute('aria-expanded',String(!!open));
  document.body.classList.toggle('direct-chat-open',!!open);
  if(open){
    directChatState.returnFocus=document.activeElement;directChatState.unread=0;directChatRender();
    requestAnimationFrame(()=>directChatEl('directChatInput')?.focus({preventScroll:true}))
  }else{
    directChatRender();
    if(restoreFocus&&directChatState.returnFocus?.isConnected)try{directChatState.returnFocus.focus({preventScroll:true})}catch{}
    directChatState.returnFocus=null
  }
}
function directChatOpen(){if(!directChatConnected()||directChatBlockingOverlay())return;directChatSetOpen(true)}
function directChatClose(options){directChatSetOpen(false,options)}
function directChatReset(){
  directChatSetOpen(false,{restoreFocus:false});
  directChatState={messages:[],seenIds:new Set(),open:false,muted:false,unread:0,lastSendAt:0,sendTimes:[],incomingTimes:[],returnFocus:null,wasConnected:false};
  const input=directChatEl('directChatInput');if(input)input.value='';directChatRender();directChatSyncVisibility()
}
function directChatCanSendNow(){
  const now=Date.now();if(now-directChatState.lastSendAt<DIRECT_CHAT_MIN_SEND_MS)return false;
  directChatState.sendTimes=directChatState.sendTimes.filter(t=>now-t<DIRECT_CHAT_BURST_WINDOW_MS);
  return directChatState.sendTimes.length<DIRECT_CHAT_BURST_MAX
}
function directChatNoteSend(){const now=Date.now();directChatState.lastSendAt=now;directChatState.sendTimes.push(now)}
function directChatSendText(value){
  const text=directChatNormalizeText(value);if(!text||!directChatConnected())return false;
  if(!directChatCanSendNow()){if(typeof msg==='function')msg('Chat is moving too fast — wait a moment.');return false}
  const id=directChatMakeId(),message={id,text,mine:true,receivedAt:Date.now()};
  directChatNoteSend();directChatRemember(message);directSend({kind:'chat',chatVersion:DIRECT_CHAT_PROTOCOL,id,text});directChatRender();return true
}
function directChatIncomingAllowed(){
  const now=Date.now();directChatState.incomingTimes=directChatState.incomingTimes.filter(t=>now-t<DIRECT_CHAT_BURST_WINDOW_MS);
  if(directChatState.incomingTimes.length>=12)return false;directChatState.incomingTimes.push(now);return true
}
function directChatReceive(data){
  if(!directChatConnected()||data?.chatVersion!==DIRECT_CHAT_PROTOCOL||typeof data?.id!=='string'||data.id.length>80||!directChatIncomingAllowed())return;
  const text=directChatNormalizeText(data.text);if(!text)return;
  if(!directChatRemember({id:data.id,text,mine:false,receivedAt:Date.now()}))return;
  if(!directChatState.open&&!directChatState.muted)directChatState.unread++;
  directChatRender()
}
function directChatSubmit(event){event?.preventDefault?.();const input=directChatEl('directChatInput');if(!input)return;if(directChatSendText(input.value)){input.value='';directChatRender();input.focus()}}
function directChatToggleMute(){directChatState.muted=!directChatState.muted;if(directChatState.muted)directChatState.unread=0;directChatRender()}
function directChatSyncVisibility(){
  const fab=directChatEl('directChatFab'),drawer=directChatEl('directChatDrawer');if(!fab||!drawer)return;
  const connected=directChatConnected();fab.hidden=!connected;
  if(!connected&&directChatState.open)directChatClose({restoreFocus:false});
  if(connected&&directChatBlockingOverlay()&&directChatState.open)directChatClose({restoreFocus:false});
  if(directChatState.wasConnected&&!connected&&directChatState.messages.length&&!globalThis.directMobileRecovery?.recovering)directChatReset();
  directChatState.wasConnected=connected
}
function directChatCreateUi(){
  if(directChatEl('directChatFab')||!document.body)return;
  const fab=document.createElement('button');fab.id='directChatFab';fab.className='directChatFab';fab.type='button';fab.hidden=true;fab.setAttribute('aria-label','Open Direct Duel chat');fab.setAttribute('aria-controls','directChatDrawer');fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-expanded','false');fab.innerHTML='<span class="directChatFabIcon" aria-hidden="true">💬</span><span class="directChatFabLabel">Chat</span><span id="directChatBadge" class="directChatBadge" aria-hidden="true" hidden>0</span>';
  const drawer=document.createElement('aside');drawer.id='directChatDrawer';drawer.className='directChatDrawer';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','false');drawer.setAttribute('aria-labelledby','directChatTitle');
  const quick=DIRECT_CHAT_QUICK.map((text,index)=>`<button type="button" class="directChatQuick" data-chat-quick="${index}">${text}</button>`).join('');
  drawer.innerHTML=`<div class="directChatHead"><div><span>DIRECT DUEL</span><strong id="directChatTitle">Chat</strong><small>Private WebRTC · this match only</small></div><div class="directChatHeadActions"><button id="directChatMute" type="button" aria-pressed="false">Mute</button><button id="directChatClose" type="button" aria-label="Close chat">×</button></div></div><div id="directChatLog" class="directChatLog" role="log" aria-live="polite" aria-relevant="additions text"><div id="directChatEmpty" class="directChatEmpty"><strong>Say hi.</strong><span>Messages travel over the same encrypted Direct Duel connection and are not saved after the duel.</span></div></div><div class="directChatQuickRow" aria-label="Quick messages">${quick}</div><form id="directChatForm" class="directChatForm"><label><span class="srOnly">Message opponent</span><input id="directChatInput" type="text" maxlength="${DIRECT_CHAT_MAX_CHARS}" autocomplete="off" enterkeyhint="send" placeholder="Message opponent…"></label><span id="directChatCount" class="directChatCount">0/${DIRECT_CHAT_MAX_CHARS}</span><button id="directChatSend" type="submit">Send</button></form>`;
  const topActions=document.querySelector('.topActions');(topActions||document.body).append(fab);document.body.append(drawer);
  fab.addEventListener('click',directChatOpen);directChatEl('directChatClose').addEventListener('click',()=>directChatClose());directChatEl('directChatMute').addEventListener('click',directChatToggleMute);directChatEl('directChatForm').addEventListener('submit',directChatSubmit);
  directChatEl('directChatInput').addEventListener('input',directChatRender);
  drawer.addEventListener('click',event=>{const button=event.target?.closest?.('[data-chat-quick]');if(!button)return;const value=DIRECT_CHAT_QUICK[Number(button.dataset.chatQuick)];if(value)directChatSendText(value)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&directChatState.open){event.preventDefault();directChatClose()}});
  directChatRender();directChatSyncVisibility()
}

const directHandleMessageBeforeChat=directHandleMessage;
directHandleMessage=function(data){
  if(data?.kind==='chat'){directChatReceive(data);return}
  const result=directHandleMessageBeforeChat(data);
  if(data?.kind==='leave')directChatReset();
  return result
};
globalThis.directHandleMessage=directHandleMessage;

const directClosePeerBeforeChat=directClosePeer;
directClosePeer=function(options={}){directChatReset();return directClosePeerBeforeChat(options)};
globalThis.directClosePeer=directClosePeer;

const duelStartDirectRematchBeforeChat=duelStartDirectRematch;
duelStartDirectRematch=function(payload){directChatReset();return duelStartDirectRematchBeforeChat(payload)};
globalThis.duelStartDirectRematch=duelStartDirectRematch;

const directEnterReadyRoomBeforeChat=directEnterReadyRoom;
directEnterReadyRoom=function(){const result=directEnterReadyRoomBeforeChat();directChatSyncVisibility();return result};
globalThis.directEnterReadyRoom=directEnterReadyRoom;

// Mobile lifecycle recovery 0.18.5: keep the active host-authoritative match in memory
// while iOS/Android suspends the page, then rebuild only the Direct WebRTC transport.
// PeerJS remains signaling-only; match state, Fog projection, moves, and chat stay P2P.
const DIRECT_MOBILE_RESUME_VERSION='0.18.5';
const DIRECT_MOBILE_PONG_TIMEOUT_MS=2600;
const DIRECT_MOBILE_RETRY_MS=1800;
const DIRECT_MOBILE_SLOW_RETRY_MS=5000;
const DIRECT_MOBILE_FAST_WINDOW_MS=45_000;
const DIRECT_MOBILE_HEARTBEAT_MS=12_000;
let directMobileResumeState={recovering:false,targetPeerId:'',hostPeerId:'',pendingPing:'',pingTimer:null,retryTimer:null,recoveryStartedAt:0,lastAttemptAt:0,attempts:0,lastHealthyAt:0};
globalThis.directMobileRecovery=directMobileResumeState;

function directMobileResumeEligible(){
  return !!(typeof directDuel!=='undefined'&&directDuel?.pairing==='nearby'&&typeof duelSession!=='undefined'&&duelSession?.active&&typeof s!=='undefined'&&!s?.winner&&!s?.draw)
}
function directMobileClearTimer(name){const id=directMobileResumeState[name];if(id)clearTimeout(id);directMobileResumeState[name]=null}
function directMobileCapturePeer(channel=directDuel?.channel){
  const conn=channel?.__peerJsConn||directPeerSession?.conn;
  if(directDuel?.role==='guest'){
    const target=String(conn?.peer||directMobileResumeState.targetPeerId||'');
    if(/^[A-Za-z0-9_-]{1,128}$/.test(target))directMobileResumeState.targetPeerId=target
  }else if(directDuel?.role==='host'){
    const id=String(directPeerSession?.peer?.id||directMobileResumeState.hostPeerId||'');
    if(/^[A-Za-z0-9_-]{1,128}$/.test(id))directMobileResumeState.hostPeerId=id
  }
}
function directMobilePeerReady(){const peer=directPeerSession?.peer;return !!(peer&&!peer.destroyed&&peer.open&&!peer.disconnected)}
function directMobileEnsureSignaling(){
  const peer=directPeerSession?.peer;if(!peer||peer.destroyed)return false;
  if(peer.disconnected&&typeof peer.reconnect==='function'){try{peer.reconnect()}catch{}}
  return true
}
function directMobileSetRecovering(copy='Connection paused. Restoring this Direct Duel…'){
  if(!directMobileResumeEligible())return false;
  if(!directMobileResumeState.recovering){directMobileResumeState.recoveryStartedAt=Date.now();directMobileResumeState.attempts=0}
  directMobileResumeState.recovering=true;directMobileCapturePeer();
  directChatState.wasConnected=false;
  directConnectionBadge('offline','Reconnecting…');directSetStatus(copy);
  return true
}
function directMobileRecoveryDelay(){return Date.now()-directMobileResumeState.recoveryStartedAt<DIRECT_MOBILE_FAST_WINDOW_MS?DIRECT_MOBILE_RETRY_MS:DIRECT_MOBILE_SLOW_RETRY_MS}
function directMobileScheduleRetry(delay=directMobileRecoveryDelay()){
  directMobileClearTimer('retryTimer');
  if(!directMobileResumeState.recovering||!directMobileResumeEligible())return;
  directMobileResumeState.retryTimer=setTimeout(directMobileRecoveryTick,delay)
}
function directMobileReleaseStaleConnection(){
  const conn=directPeerSession?.conn;directMobileCapturePeer(directDuel?.channel);
  try{if(conn?.open||conn?.peerConnection)conn.close()}catch{}
  if(typeof directPeerSession!=='undefined'){directPeerSession.opened=false;if(directPeerSession.conn===conn)directPeerSession.conn=null}
  if(directDuel?.channel?.__peerJsConn===conn)directDuel.channel=null;
  if(directDuel?.pc?.__peerJsConn===conn)directDuel.pc=null
}
function directMobileGuestConnect(){
  if(!directMobileResumeEligible()||directDuel?.role!=='guest'||document.hidden)return false;
  const target=directMobileResumeState.targetPeerId;if(!target)return false;
  if(!directMobilePeerReady()){directMobileEnsureSignaling();return false}
  const existing=directPeerSession?.conn;
  if(existing&&!directDuel.active&&Date.now()-directMobileResumeState.lastAttemptAt<3400)return false;
  if(existing&&!directDuel.active)directMobileReleaseStaleConnection();
  try{
    directMobileResumeState.lastAttemptAt=Date.now();directMobileResumeState.attempts++;
    const conn=directPeerSession.peer.connect(target,{reliable:true,serialization:'json'});directBindPeerJsConnection(conn);return true
  }catch{return false}
}
function directMobileRecoveryTick(){
  if(!directMobileResumeState.recovering||!directMobileResumeEligible()||document.hidden)return;
  if(directDuel?.active&&directDuel?.channel?.readyState==='open'){directMobileFinishRecovery();return}
  directMobileEnsureSignaling();
  if(directDuel?.role==='guest')directMobileGuestConnect();
  else directSetStatus('Connection paused. Waiting for your opponent to return…');
  directMobileScheduleRetry()
}
function directMobileBeginRecovery(reason='interrupted'){
  if(!directMobileSetRecovering(reason==='resume'?'Checking the Direct Duel connection…':'Connection paused. Restoring this Direct Duel…'))return;
  directDuel.active=false;
  if(typeof directPeerSession!=='undefined')directPeerSession.opened=false;
  directMobileEnsureSignaling();directMobileScheduleRetry(120)
}
function directMobileFinishRecovery(){
  if(!directMobileResumeState.recovering)return;
  directMobileResumeState.recovering=false;directMobileClearTimer('retryTimer');directMobileClearTimer('pingTimer');directMobileResumeState.pendingPing='';directMobileResumeState.lastHealthyAt=Date.now();
  directConnectionBadge('online','Direct connected');directSetStatus('');directChatState.wasConnected=true
}
function directMobileSendSnapshot(){
  if(directDuel?.role!=='host'||!directDuel?.authority?.state||directDuel?.channel?.readyState!=='open')return;
  const auth=directDuel.authority,players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
  const payload=localDuelPayload(auth.state,A,auth.version,[],players);
  directSend({kind:'resume-state',resumeVersion:DIRECT_MOBILE_RESUME_VERSION,payload})
}
function directMobileApplySnapshot(payload){
  if(!payload?.state||directDuel?.role!=='guest')return;
  duelSession.pendingLocal=null;busy=false;
  const version=Number(payload.version);
  if(Number.isFinite(version)&&version>duelSession.handledVersion)duelApplyPayload(payload);
  else{render();if(!s.winner&&!s.draw)continueTurnController()}
}
function directMobileNonce(){try{return crypto.randomUUID()}catch{return`resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}}
function directMobileHealthCheck(reason='heartbeat'){
  if(!directMobileResumeEligible()||document.hidden)return;
  directMobileCapturePeer();
  if(!directDuel.active||directDuel?.channel?.readyState!=='open'){directMobileBeginRecovery(reason==='resume'?'resume':'interrupted');return}
  directMobileClearTimer('pingTimer');
  const nonce=directMobileNonce();directMobileResumeState.pendingPing=nonce;directSend({kind:'resume-ping',resumeVersion:DIRECT_MOBILE_RESUME_VERSION,nonce});
  directMobileResumeState.pingTimer=setTimeout(()=>{
    if(directMobileResumeState.pendingPing!==nonce||!directMobileResumeEligible())return;
    directMobileResumeState.pendingPing='';directMobileSetRecovering('Connection was suspended. Restoring the Direct Duel…');directMobileReleaseStaleConnection();directDuel.active=false;directMobileEnsureSignaling();directMobileScheduleRetry(120)
  },DIRECT_MOBILE_PONG_TIMEOUT_MS)
}

const directHandleMessageBeforeMobileResume=directHandleMessage;
directHandleMessage=function(data){
  if(data?.kind==='resume-ping'){directSend({kind:'resume-pong',resumeVersion:DIRECT_MOBILE_RESUME_VERSION,nonce:data.nonce});return}
  if(data?.kind==='resume-pong'){
    if(data.nonce&&data.nonce===directMobileResumeState.pendingPing){directMobileResumeState.pendingPing='';directMobileClearTimer('pingTimer');directMobileResumeState.lastHealthyAt=Date.now();if(directMobileResumeState.recovering)directMobileFinishRecovery()}
    return
  }
  if(data?.kind==='resume-request'&&directDuel?.role==='host'&&directMobileResumeEligible()){directMobileSendSnapshot();return}
  if(data?.kind==='resume-state'&&directDuel?.role==='guest'&&directMobileResumeEligible()){directMobileApplySnapshot(data.payload);return}
  return directHandleMessageBeforeMobileResume(data)
};
globalThis.directHandleMessage=directHandleMessage;

const directBindChannelBeforeMobileResume=directBindChannel;
directBindChannel=function(channel){
  const result=directBindChannelBeforeMobileResume(channel),normalOpen=channel.onopen,normalClose=channel.onclose;
  directMobileCapturePeer(channel);
  channel.onopen=()=>{
    directMobileCapturePeer(channel);
    const resuming=directMobileResumeEligible()&&(directMobileResumeState.recovering||!directDuel.active);
    if(!resuming){const out=normalOpen?.();directMobileCapturePeer(channel);directMobileResumeState.lastHealthyAt=Date.now();return out}
    directDuel.active=true;directDuel.ready={human:true,ai:true};directMobileFinishRecovery();
    if(directDuel.role==='host')setTimeout(directMobileSendSnapshot,40);else directSend({kind:'resume-request',resumeVersion:DIRECT_MOBILE_RESUME_VERSION,handledVersion:duelSession.handledVersion});
    if(typeof msg==='function')msg('Direct Duel connection restored.');return undefined
  };
  channel.onclose=()=>{
    if(directMobileResumeEligible()){
      directMobileCapturePeer(channel);if(typeof directPeerSession!=='undefined'){directPeerSession.opened=false;if(directPeerSession.conn===channel.__peerJsConn)directPeerSession.conn=null}
      directDuel.active=false;directChatState.wasConnected=false;directMobileBeginRecovery('channel-close');return
    }
    return normalClose?.()
  };
  return result
};
globalThis.directBindChannel=directBindChannel;

const directClosePeerBeforeMobileResume=directClosePeer;
directClosePeer=function(options={}){
  directMobileResumeState.recovering=false;directMobileClearTimer('retryTimer');directMobileClearTimer('pingTimer');directMobileResumeState.pendingPing='';directMobileResumeState.targetPeerId='';directMobileResumeState.hostPeerId='';
  return directClosePeerBeforeMobileResume(options)
};
globalThis.directClosePeer=directClosePeer;

function directMobileResumeFromLifecycle(){if(!document.hidden&&directMobileResumeEligible())setTimeout(()=>directMobileHealthCheck('resume'),160)}
document.addEventListener('visibilitychange',directMobileResumeFromLifecycle);
window.addEventListener('pageshow',directMobileResumeFromLifecycle);
window.addEventListener('online',directMobileResumeFromLifecycle);
window.addEventListener('focus',directMobileResumeFromLifecycle);
setInterval(()=>{if(directMobileResumeEligible()&&!document.hidden)directMobileHealthCheck('heartbeat')},DIRECT_MOBILE_HEARTBEAT_MS);

globalThis.directMobileRecovery={
  get recovering(){return directMobileResumeState.recovering},
  get attempts(){return directMobileResumeState.attempts},
  get targetPeerId(){return directMobileResumeState.targetPeerId},
  check:directMobileHealthCheck,
  retry:()=>directMobileBeginRecovery('manual')
};

if(document.body)directChatCreateUi();else document.addEventListener('DOMContentLoaded',directChatCreateUi,{once:true});
setInterval(directChatSyncVisibility,400);
globalThis.directChat={version:DIRECT_CHAT_VERSION,open:directChatOpen,close:directChatClose,reset:directChatReset,send:directChatSendText};
