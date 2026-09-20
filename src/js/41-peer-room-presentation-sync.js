'use strict';
const PEER_ROOM_PRESENTATION_SYNC_VERSION='0.20.5';
const PEER_ROOM_PRESENTATION_SYNC_PROTOCOL=1;
const PEER_ROOM_PRESENTATION_BASE_LEAD_MS=240;
const PEER_ROOM_PRESENTATION_MAX_LEAD_MS=520;

const peerRoomPresentationSyncState={
  sequence:0,
  pingSequence:0,
  pendingPings:new Map(),
  offsetMs:0,
  bestRttMs:Infinity,
  synced:false,
  lastSyncAt:0,
  lastPresentation:null
};
globalThis.peerRoomPresentationSyncState=peerRoomPresentationSyncState;

function peerRoomPresentationSyncActive(){
  const seat=Number(globalThis.peerRoom?.seat||0);
  return !!(globalThis.peerRoomMatch?.phase==='active'&&!globalThis.peerRoomMatch?.spectator&&(seat===1||seat===2)&&document.body.classList.contains('peer-room-match-active'))
}
function peerRoomPresentationSyncDropMs(){return Math.max(1,Number(globalThis.TIMING?.drop)||220)}
function peerRoomPresentationSyncClamp(value,min,max){return Math.max(min,Math.min(max,value))}
function peerRoomPresentationSyncBestHostRtt(){
  let rtt=0;
  try{for(const conn of peerRoom.connections?.values?.()||[]){const n=Number(conn?.__peerRoomPresentationRtt);if(Number.isFinite(n)&&n>rtt)rtt=n}}catch{}
  return rtt
}
function peerRoomPresentationSyncLeadMs(){
  const rtt=peerRoomPresentationSyncBestHostRtt();
  return Math.round(peerRoomPresentationSyncClamp(PEER_ROOM_PRESENTATION_BASE_LEAD_MS+(rtt>0?rtt*.6:0),PEER_ROOM_PRESENTATION_BASE_LEAD_MS,PEER_ROOM_PRESENTATION_MAX_LEAD_MS))
}
function peerRoomPresentationSyncMakeMeta(){
  const issuedAt=Date.now(),leadMs=peerRoomPresentationSyncLeadMs(),version=Number(peerRoomMatch?.authority?.version||0);
  return{protocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:`prs_${version}_${++peerRoomPresentationSyncState.sequence}`,version,hostIssuedAt:issuedAt,presentAtHost:issuedAt+leadMs,leadMs,duration:peerRoomPresentationSyncDropMs()}
}
function peerRoomPresentationSyncLocalTarget(meta){
  const hostAt=Number(meta?.presentAtHost);if(!Number.isFinite(hostAt))return Date.now();
  if(peerRoom?.role==='host')return hostAt;
  if(peerRoom?.role==='guest'&&peerRoomPresentationSyncState.synced)return hostAt+peerRoomPresentationSyncState.offsetMs;
  const issued=Number(meta?.hostIssuedAt),lead=Number.isFinite(issued)?Math.max(0,hostAt-issued):PEER_ROOM_PRESENTATION_BASE_LEAD_MS;
  const oneWay=Number.isFinite(peerRoomPresentationSyncState.bestRttMs)?peerRoomPresentationSyncState.bestRttMs/2:40;
  return Date.now()+Math.max(0,lead-oneWay)
}

function peerRoomPresentationSyncSendPing(){
  if(peerRoom?.role!=='guest'||!peerRoom.conn?.open)return false;
  const id=`clk_${++peerRoomPresentationSyncState.pingSequence}_${Math.random().toString(36).slice(2,7)}`,guestSentAt=Date.now();
  peerRoomPresentationSyncState.pendingPings.set(id,guestSentAt);
  peerRoomSend(peerRoom.conn,{kind:'room-clock-ping',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id,guestSentAt});
  setTimeout(()=>peerRoomPresentationSyncState.pendingPings.delete(id),4000);return true
}
function peerRoomPresentationSyncBurst(){
  if(peerRoom?.role!=='guest')return;
  for(let i=0;i<4;i++)setTimeout(peerRoomPresentationSyncSendPing,i*90)
}
function peerRoomPresentationSyncApplyPong(data){
  const id=String(data?.id||''),g0=peerRoomPresentationSyncState.pendingPings.get(id);if(!g0)return;
  peerRoomPresentationSyncState.pendingPings.delete(id);
  const g3=Date.now(),h1=Number(data.hostReceivedAt),h2=Number(data.hostSentAt);if(!Number.isFinite(h1)||!Number.isFinite(h2))return;
  const rtt=Math.max(0,(g3-g0)-Math.max(0,h2-h1));
  const guestMinusHost=((g0-h1)+(g3-h2))/2;
  if(!Number.isFinite(guestMinusHost)||rtt>2500)return;
  if(!peerRoomPresentationSyncState.synced||rtt<=peerRoomPresentationSyncState.bestRttMs){
    peerRoomPresentationSyncState.offsetMs=guestMinusHost;
    peerRoomPresentationSyncState.bestRttMs=rtt;
    peerRoomPresentationSyncState.synced=true;
    peerRoomPresentationSyncState.lastSyncAt=g3
  }
  if(peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-clock-report',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,rttMs:peerRoomPresentationSyncState.bestRttMs})
}

// Add a small NTP-style clock sample to the existing PeerJS DataConnection. The game
// still runs entirely on the host authority; this clock is presentation-only and is
// never used to validate turns, moves, Fog, inventory, or winners.
const peerRoomHostMessageBeforePresentationSync=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-ping'){
    const hostReceivedAt=Date.now();
    peerRoomSend(conn,{kind:'room-clock-pong',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:String(data.id||''),guestSentAt:Number(data.guestSentAt)||0,hostReceivedAt,hostSentAt:Date.now()});return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-report'){
    const rtt=Number(data.rttMs);if(Number.isFinite(rtt)&&rtt>=0&&rtt<2500)conn.__peerRoomPresentationRtt=rtt;return
  }
  return peerRoomHostMessageBeforePresentationSync(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforePresentationSync=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-pong'){peerRoomPresentationSyncApplyPong(data);return}
  const out=peerRoomGuestMessageBeforePresentationSync(data);
  if(data?.kind==='room-welcome')setTimeout(peerRoomPresentationSyncBurst,0);
  if(data?.kind==='room-match-error'){hoverCol=null;try{render()}catch{}}
  return out
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

// Every validated move gets one host-authored presentation transaction. All connected
// players receive the same future host timestamp; P2 converts it to local time using the
// clock sample above. This replaces independent optimistic checker timelines.
const peerRoomMatchBroadcastBeforePresentationSync=peerRoomMatchBroadcast;
peerRoomMatchBroadcast=function(events=[],kind='room-match-payload'){
  const auth=peerRoomMatch?.authority,lm=auth?.state?.lastMove;
  if(peerRoom?.role!=='host'||peerRoomMatch?.phase!=='active'||!auth||kind!=='room-match-payload'||!lm)return peerRoomMatchBroadcastBeforePresentationSync(events,kind);
  const presentation=peerRoomPresentationSyncMakeMeta();
  for(const [seat,conn] of peerRoom.connections){
    const payload=peerRoomMatchPayloadForSeat(seat,events);if(!payload)continue;payload.peerPresentation={...presentation};
    peerRoomSend(conn,{kind,protocol:PEER_ROOM_PROTOCOL,matchId:peerRoomMatch.matchId,payload})
  }
  const hostPayload=peerRoomMatchPayloadForSeat(1,events);if(hostPayload){hostPayload.peerPresentation={...presentation};peerRoomMatchEnterPayload(hostPayload,peerRoomMatch.matchId,1)}
  peerRoomMatchPersist()
};
globalThis.peerRoomMatchBroadcast=peerRoomMatchBroadcast;

// Input gets immediate lightweight acknowledgement (column intent + busy state), but the
// real checker does not begin falling until the host has validated the move and issued the
// shared presentation timestamp.
const peerRoomMatchMoveBeforePresentationSync=peerRoomMatchMove;
peerRoomMatchMove=function(owner,type,column){
  if(!peerRoomPresentationSyncActive())return peerRoomMatchMoveBeforePresentationSync(owner,type,column);
  if(peerRoomMatch.phase!=='active'||peerRoomMatch.spectator||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  const pending={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion,peerRoomSynchronized:true,requestedAt:Date.now()};
  duelSession.pendingLocal=pending;try{peerRoomPolishState.previewPending=pending}catch{};busy=true;hoverCol=c;dropPresentation=null;render();
  try{gameHaptic?.('tap')}catch{}
  if(Number(peerRoom.seat)===1)peerRoomMatchAuthorityMove(H,type,c);
  else if(Number(peerRoom.seat)===2&&peerRoom.conn?.open){
    if(Date.now()-peerRoomPresentationSyncState.lastSyncAt>15000)peerRoomPresentationSyncSendPing();
    peerRoomSend(peerRoom.conn,{kind:'room-match-move',protocol:PEER_ROOM_PROTOCOL,type,column:c,baseVersion:duelSession.handledVersion})
  }
};
globalThis.peerRoomMatchMove=peerRoomMatchMove;

function peerRoomPresentationSyncStage(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  hoverCol=null;
  dropPresentation={before:tx.before,owner:tx.lm.owner,type:tx.lm.owner===H?tx.ownType:null,column:tx.column,targetRow:dropTargetRow(tx.before,tx.column),moveNumber:tx.after.moveNumber,duration:tx.duration};
  render();try{emitFeedback('drop')}catch{}
  try{clearTimer('peerRoomMoveTransaction')}catch{}
  scheduleTimer('peerRoomMoveTransaction',()=>peerRoomTransactionCommit(tx),tx.duration)
}

const duelApplyActiveUpdateBeforePresentationSync=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomPresentationSyncActive()||!payload?.peerPresentation)return duelApplyActiveUpdateBeforePresentationSync(payload);
  const version=Number(payload.version);if(!Number.isFinite(version)||version<=duelSession.handledVersion||!payload.state)return;
  const pending=duelSession.pendingLocal,after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  const samePending=!!(pending?.peerRoomSynchronized&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const before=samePending?pending.before:cloneState(s);
  duelSession.handledVersion=version;peerRoomTransactionState.activeVersion=version;busy=true;
  duelSession.pendingLocal=null;try{peerRoomPolishState.previewPending=null}catch{}

  if(!lm||!Number.isInteger(Number(lm.column))){
    hoverCol=null;peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return
  }

  const column=Number(lm.column),ownType=samePending&&pending?.type?pending.type:lm.type,duration=Math.max(1,Number(payload.peerPresentation.duration)||peerRoomPresentationSyncDropMs());
  const tx={version,before,after,events,lm,column,ownType,duration,presentation:payload.peerPresentation};
  peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt:Date.now(),targetAt:peerRoomPresentationSyncLocalTarget(payload.peerPresentation)};
  const wait=Math.max(0,peerRoomPresentationSyncState.lastPresentation.targetAt-Date.now());
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{}
  scheduleTimer('peerRoomPresentationStart',()=>peerRoomPresentationSyncStage(tx),wait)
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

const peerRoomTransactionClearVisualBeforePresentationSync=peerRoomTransactionClearVisual;
peerRoomTransactionClearVisual=function(){try{clearTimer('peerRoomPresentationStart')}catch{};hoverCol=null;return peerRoomTransactionClearVisualBeforePresentationSync()};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;
if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

// A restored/in-progress guest may have loaded this layer after the welcome packet.
if(peerRoom?.role==='guest'&&peerRoom.conn?.open)setTimeout(peerRoomPresentationSyncBurst,0);

globalThis.peerRoomPresentationSync={
  version:PEER_ROOM_PRESENTATION_SYNC_VERSION,
  protocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,
  state:peerRoomPresentationSyncState,
  active:peerRoomPresentationSyncActive,
  burst:peerRoomPresentationSyncBurst,
  leadMs:peerRoomPresentationSyncLeadMs,
  localTarget:peerRoomPresentationSyncLocalTarget
};
