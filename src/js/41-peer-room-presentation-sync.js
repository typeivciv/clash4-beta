'use strict';
const PEER_ROOM_PRESENTATION_SYNC_VERSION='0.20.6';
const PEER_ROOM_PRESENTATION_SYNC_PROTOCOL=1;
const PEER_ROOM_PRESENTATION_BASE_LEAD_MS=280;
const PEER_ROOM_PRESENTATION_MAX_LEAD_MS=2400;
const PEER_ROOM_PRESENTATION_PREP_WARN_MS=4500;
const PEER_ROOM_PRESENTATION_EVENT_GAP_MS=48;

const peerRoomPresentationSyncState={
  sequence:0,
  pingSequence:0,
  pendingPings:new Map(),
  pendingHostTransactions:new Map(),
  pendingGuestTransactions:new Map(),
  schedules:new Map(),
  pendingEventPresentation:null,
  offsetMs:0,
  bestRttMs:Infinity,
  synced:false,
  lastSyncAt:0,
  lastPresentation:null,
  lastDeliveryMs:0
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
  return Math.round(peerRoomPresentationSyncClamp(PEER_ROOM_PRESENTATION_BASE_LEAD_MS+(rtt>0?rtt*.7:0),PEER_ROOM_PRESENTATION_BASE_LEAD_MS,620))
}
function peerRoomPresentationSyncReceiptLeadMs(conn,observedDownlink=0){
  const observed=peerRoomPresentationSyncClamp(Number(observedDownlink)||0,0,4000),previous=peerRoomPresentationSyncClamp(Number(conn?.__peerRoomPresentationDeliveryMs)||0,0,4000),rtt=peerRoomPresentationSyncClamp(Number(conn?.__peerRoomPresentationRtt)||0,0,2500);
  const delivery=Math.max(observed,previous*.82);
  if(conn)conn.__peerRoomPresentationDeliveryMs=Math.max(observed,previous*.72);
  peerRoomPresentationSyncState.lastDeliveryMs=delivery;
  return Math.round(peerRoomPresentationSyncClamp(Math.max(PEER_ROOM_PRESENTATION_BASE_LEAD_MS,delivery*1.45+180,rtt*.9+180),PEER_ROOM_PRESENTATION_BASE_LEAD_MS,PEER_ROOM_PRESENTATION_MAX_LEAD_MS))
}
function peerRoomPresentationSyncMakeMeta({id='',version=0,leadMs=peerRoomPresentationSyncLeadMs()}={}){
  const issuedAt=Date.now(),lead=Math.round(peerRoomPresentationSyncClamp(Number(leadMs)||PEER_ROOM_PRESENTATION_BASE_LEAD_MS,PEER_ROOM_PRESENTATION_BASE_LEAD_MS,PEER_ROOM_PRESENTATION_MAX_LEAD_MS));
  return{protocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:id||`prs_${version}_${++peerRoomPresentationSyncState.sequence}`,version:Number(version)||0,hostIssuedAt:issuedAt,presentAtHost:issuedAt+lead,leadMs:lead,duration:peerRoomPresentationSyncDropMs()}
}
function peerRoomPresentationSyncLocalTarget(meta){
  const hostAt=Number(meta?.presentAtHost);if(!Number.isFinite(hostAt))return Date.now();
  if(peerRoom?.role==='host')return hostAt;
  if(peerRoom?.role==='guest'&&peerRoomPresentationSyncState.synced)return hostAt+peerRoomPresentationSyncState.offsetMs;
  const issued=Number(meta?.hostIssuedAt),lead=Number.isFinite(issued)?Math.max(0,hostAt-issued):PEER_ROOM_PRESENTATION_BASE_LEAD_MS;
  const oneWay=Number.isFinite(peerRoomPresentationSyncState.bestRttMs)?peerRoomPresentationSyncState.bestRttMs/2:40;
  return Date.now()+Math.max(0,lead-oneWay)
}
function peerRoomPresentationSyncLocalEventAnchor(meta){
  const duration=Math.max(1,Number(meta?.duration)||peerRoomPresentationSyncDropMs());
  return peerRoomPresentationSyncLocalTarget({...meta,presentAtHost:Number(meta?.presentAtHost||Date.now())+duration+PEER_ROOM_PRESENTATION_EVENT_GAP_MS})
}

// WebKit can occasionally delay a setTimeout even while the page is visible. Peer Room
// presentation uses a short requestAnimationFrame clock so checker commit and every combat
// frame are driven by the same absolute host timeline instead of accumulating local timer drift.
function peerRoomPresentationSyncCancelSchedule(name){
  const record=peerRoomPresentationSyncState.schedules.get(name);if(!record)return;
  record.cancelled=true;
  if(record.raf!==null&&typeof cancelAnimationFrame==='function')try{cancelAnimationFrame(record.raf)}catch{}
  if(record.timer!==null)clearTimeout(record.timer);
  peerRoomPresentationSyncState.schedules.delete(name)
}
function peerRoomPresentationSyncCancelAllSchedules(){for(const name of [...peerRoomPresentationSyncState.schedules.keys()])peerRoomPresentationSyncCancelSchedule(name)}
function peerRoomPresentationSyncScheduleAt(name,targetAt,fn){
  peerRoomPresentationSyncCancelSchedule(name);
  const target=Number(targetAt),record={targetAt:Number.isFinite(target)?target:Date.now(),raf:null,timer:null,cancelled:false};
  peerRoomPresentationSyncState.schedules.set(name,record);
  const tick=()=>{
    if(record.cancelled||peerRoomPresentationSyncState.schedules.get(name)!==record)return;
    if(Date.now()+1>=record.targetAt){peerRoomPresentationSyncState.schedules.delete(name);fn();return}
    if(typeof requestAnimationFrame==='function')record.raf=requestAnimationFrame(tick);
    else record.timer=setTimeout(tick,Math.min(16,Math.max(1,record.targetAt-Date.now())))
  };
  tick();return record
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

// Canonical move validation still happens once in peerRoomMatchAuthorityMove/applyLocalDuelMove.
// The receipt gate and synchronized timeline below only control when already-projected visuals run.
function peerRoomPresentationSyncEstimateHostReceipt(guestReceivedAt){
  if(peerRoomPresentationSyncState.synced)return Number(guestReceivedAt)-Number(peerRoomPresentationSyncState.offsetMs||0);
  return Number(guestReceivedAt)-((Number.isFinite(peerRoomPresentationSyncState.bestRttMs)?peerRoomPresentationSyncState.bestRttMs:80)/2)
}
function peerRoomPresentationSyncPreparePacket(tx){
  return{kind:'room-presentation-prepare',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:tx.id,version:tx.version,matchId:tx.matchId,hostPreparedAt:tx.preparedAt,duration:tx.duration,payload:tx.guestPayload}
}
function peerRoomPresentationSyncSendPrepare(tx,conn){
  if(!tx||!conn?.open)return false;peerRoomSend(conn,peerRoomPresentationSyncPreparePacket(tx));return true
}
function peerRoomPresentationSyncWarnPending(tx){
  if(!peerRoomPresentationSyncState.pendingHostTransactions.has(tx.id))return;
  try{peerRoomStatus('Move validated · waiting for Player 2 to receive the presentation…','warn')}catch{}
}
function peerRoomPresentationSyncFinalizeHost(tx,conn,observedDownlink=0){
  if(!tx||tx.finalized||!peerRoomPresentationSyncState.pendingHostTransactions.has(tx.id))return false;
  tx.finalized=true;if(tx.warnTimer)clearTimeout(tx.warnTimer);
  const leadMs=peerRoomPresentationSyncReceiptLeadMs(conn,observedDownlink),presentation=peerRoomPresentationSyncMakeMeta({id:tx.id,version:tx.version,leadMs});
  tx.hostPayload.peerPresentation={...presentation};tx.guestPayload.peerPresentation={...presentation};
  // GO is intentionally tiny: Player 2 already has the Fog-safe payload from PREPARE.
  if(conn?.open)peerRoomSend(conn,{kind:'room-presentation-go',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:tx.id,version:tx.version,matchId:tx.matchId,presentation:{...presentation}});
  for(const [seat,spectatorConn] of peerRoom.connections){if(Number(seat)<=2)continue;const payload=peerRoomMatchPayloadForSeat(seat,tx.events);if(!payload)continue;payload.peerPresentation={...presentation};peerRoomSend(spectatorConn,{kind:'room-match-payload',protocol:PEER_ROOM_PROTOCOL,matchId:tx.matchId,payload})}
  peerRoomMatchEnterPayload(tx.hostPayload,tx.matchId,1);peerRoomMatchPersist();peerRoomPresentationSyncState.pendingHostTransactions.delete(tx.id);return true
}
function peerRoomPresentationSyncPrepareHostTransaction(events=[]){
  const auth=peerRoomMatch?.authority,conn=peerRoom.connections?.get?.(2);if(!auth||!conn?.open)return null;
  const version=Number(auth.version||0),id=`prs_${version}_${++peerRoomPresentationSyncState.sequence}`,preparedAt=Date.now(),guestPayload=peerRoomMatchPayloadForSeat(2,events),hostPayload=peerRoomMatchPayloadForSeat(1,events);
  if(!guestPayload||!hostPayload)return null;
  const tx={id,version,preparedAt,matchId:peerRoomMatch.matchId,duration:peerRoomPresentationSyncDropMs(),events:[...events],guestPayload,hostPayload,finalized:false,warnTimer:null};
  peerRoomPresentationSyncState.pendingHostTransactions.set(id,tx);peerRoomPresentationSyncSendPrepare(tx,conn);peerRoomMatchPersist();
  tx.warnTimer=setTimeout(()=>peerRoomPresentationSyncWarnPending(tx),PEER_ROOM_PRESENTATION_PREP_WARN_MS);return tx
}
function peerRoomPresentationSyncReceivePrepare(data){
  if(peerRoom?.role!=='guest'||Number(peerRoom.seat)!==2||!data?.payload)return true;
  const id=String(data.id||''),version=Number(data.version);if(!id||!Number.isFinite(version))return true;
  if(version<=duelSession.handledVersion){peerRoomSend(peerRoom.conn,{kind:'room-presentation-ready',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id,version,hostPreparedAt:Number(data.hostPreparedAt)||0,estimatedHostReceivedAt:peerRoomPresentationSyncEstimateHostReceipt(Date.now())});return true}
  const receivedAt=Date.now(),hostPreparedAt=Number(data.hostPreparedAt)||receivedAt,estimatedHostReceivedAt=peerRoomPresentationSyncEstimateHostReceipt(receivedAt);
  peerRoomPresentationSyncState.pendingGuestTransactions.set(id,{id,version,matchId:data.matchId||peerRoomMatch.matchId,payload:data.payload,receivedAt,hostPreparedAt});
  if(peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-presentation-ready',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id,version,hostPreparedAt,estimatedHostReceivedAt,observedDownlinkMs:Math.max(0,estimatedHostReceivedAt-hostPreparedAt)});
  return true
}
function peerRoomPresentationSyncReceiveGo(data){
  if(peerRoom?.role!=='guest'||Number(peerRoom.seat)!==2)return true;
  const id=String(data.id||''),tx=peerRoomPresentationSyncState.pendingGuestTransactions.get(id);if(!tx||!data.presentation)return true;
  peerRoomPresentationSyncState.pendingGuestTransactions.delete(id);tx.payload.peerPresentation={...data.presentation};peerRoomMatch.watching=true;peerRoomMatchEnterPayload(tx.payload,data.matchId||tx.matchId,peerRoom.seat);return true
}

const peerRoomHostMessageBeforePresentationSync=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-ping'){
    const hostReceivedAt=Date.now();peerRoomSend(conn,{kind:'room-clock-pong',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:String(data.id||''),guestSentAt:Number(data.guestSentAt)||0,hostReceivedAt,hostSentAt:Date.now()});return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-report'){
    const rtt=Number(data.rttMs);if(Number.isFinite(rtt)&&rtt>=0&&rtt<2500)conn.__peerRoomPresentationRtt=rtt;return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-ready'){
    if(Number(conn?.__peerRoomSeat)!==2)return;
    const tx=peerRoomPresentationSyncState.pendingHostTransactions.get(String(data.id||''));if(!tx||Number(data.version)!==tx.version)return;
    const estimate=Number(data.estimatedHostReceivedAt),observed=Number.isFinite(estimate)?Math.max(0,estimate-tx.preparedAt):Math.max(0,Number(data.observedDownlinkMs)||0);peerRoomPresentationSyncFinalizeHost(tx,conn,observed);return
  }
  return peerRoomHostMessageBeforePresentationSync(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforePresentationSync=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-clock-pong'){peerRoomPresentationSyncApplyPong(data);return}
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-prepare'){peerRoomPresentationSyncReceivePrepare(data);return}
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-go'){peerRoomPresentationSyncReceiveGo(data);return}
  const out=peerRoomGuestMessageBeforePresentationSync(data);
  if(data?.kind==='room-welcome')setTimeout(peerRoomPresentationSyncBurst,0);
  if(data?.kind==='room-match-error'){hoverCol=null;try{render()}catch{}}
  return out
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

// Every validated P1/P2 move uses PREPARE -> READY -> GO. The host does not start its own
// checker until Player 2 has confirmed receipt of the prepared Fog-safe transaction.
const peerRoomMatchBroadcastBeforePresentationSync=peerRoomMatchBroadcast;
peerRoomMatchBroadcast=function(events=[],kind='room-match-payload'){
  const auth=peerRoomMatch?.authority,lm=auth?.state?.lastMove;
  if(peerRoom?.role!=='host'||peerRoomMatch?.phase!=='active'||!auth||kind!=='room-match-payload'||!lm)return peerRoomMatchBroadcastBeforePresentationSync(events,kind);
  const conn=peerRoom.connections?.get?.(2);
  if(!conn?.open){try{peerRoomStatus('Player 2 is reconnecting · authoritative move saved.','warn')}catch{};return peerRoomMatchBroadcastBeforePresentationSync(events,kind)}
  const tx=peerRoomPresentationSyncPrepareHostTransaction(events);if(tx)return;
  return peerRoomMatchBroadcastBeforePresentationSync(events,kind)
};
globalThis.peerRoomMatchBroadcast=peerRoomMatchBroadcast;

// If Player 2 reconnects while a validated transaction is waiting for receipt, send that
// prepared transaction instead of racing an ordinary room-match-start snapshot past it.
const peerRoomMatchSendSeatBeforePresentationSync=peerRoomMatchSendSeat;
peerRoomMatchSendSeat=function(seat,conn,events=[],kind='room-match-payload'){
  if(Number(seat)===2&&peerRoom?.role==='host'&&peerRoomMatch?.phase==='active'&&peerRoomPresentationSyncState.pendingHostTransactions.size){
    const tx=Array.from(peerRoomPresentationSyncState.pendingHostTransactions.values()).at(-1);if(tx&&!tx.finalized&&peerRoomPresentationSyncSendPrepare(tx,conn))return
  }
  return peerRoomMatchSendSeatBeforePresentationSync(seat,conn,events,kind)
};
globalThis.peerRoomMatchSendSeat=peerRoomMatchSendSeat;

// Input gets immediate lightweight acknowledgement (column intent + busy state), but the
// real checker does not begin falling until authority validates and receipt gating completes.
const peerRoomMatchMoveBeforePresentationSync=peerRoomMatchMove;
peerRoomMatchMove=function(owner,type,column){
  if(!peerRoomPresentationSyncActive())return peerRoomMatchMoveBeforePresentationSync(owner,type,column);
  if(peerRoomMatch.phase!=='active'||peerRoomMatch.spectator||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  const pending={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion,peerRoomSynchronized:true,requestedAt:Date.now()};
  duelSession.pendingLocal=pending;try{peerRoomPolishState.previewPending=pending}catch{};busy=true;hoverCol=c;dropPresentation=null;render();
  try{gameHaptic?.('tap')}catch{}
  if(Number(peerRoom.seat)===1)peerRoomMatchAuthorityMove(H,type,c);
  else if(Number(peerRoom.seat)===2&&peerRoom.conn?.open){if(Date.now()-peerRoomPresentationSyncState.lastSyncAt>15000)peerRoomPresentationSyncSendPing();peerRoomSend(peerRoom.conn,{kind:'room-match-move',protocol:PEER_ROOM_PROTOCOL,type,column:c,baseVersion:duelSession.handledVersion})}
};
globalThis.peerRoomMatchMove=peerRoomMatchMove;

function peerRoomPresentationSyncStage(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomPresentationSyncCancelSchedule('dropStart');hoverCol=null;
  const targetAt=peerRoomPresentationSyncLocalTarget(tx.presentation);
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,stagedAt:Date.now(),commitTargetAt:targetAt+tx.duration};
  dropPresentation={before:tx.before,owner:tx.lm.owner,type:tx.lm.owner===H?tx.ownType:null,column:tx.column,targetRow:dropTargetRow(tx.before,tx.column),moveNumber:tx.after.moveNumber,duration:tx.duration};
  render();try{emitFeedback('drop')}catch{}
  try{clearTimer('peerRoomMoveTransaction')}catch{}
  peerRoomPresentationSyncScheduleAt('dropCommit',targetAt+tx.duration,()=>{
    if(peerRoomTransactionState.activeVersion!==tx.version)return;
    peerRoomPresentationSyncState.pendingEventPresentation={id:String(tx.presentation?.id||''),version:tx.version,presentation:{...tx.presentation}};
    peerRoomTransactionCommit(tx)
  })
}

const duelApplyActiveUpdateBeforePresentationSync=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomPresentationSyncActive()||!payload?.peerPresentation)return duelApplyActiveUpdateBeforePresentationSync(payload);
  const version=Number(payload.version);if(!Number.isFinite(version)||version<=duelSession.handledVersion||!payload.state)return;
  const pending=duelSession.pendingLocal,after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  const samePending=!!(pending?.peerRoomSynchronized&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const before=samePending?pending.before:cloneState(s);
  duelSession.handledVersion=version;peerRoomTransactionState.activeVersion=version;busy=true;duelSession.pendingLocal=null;try{peerRoomPolishState.previewPending=null}catch{}
  if(!lm||!Number.isInteger(Number(lm.column))){hoverCol=null;peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return}
  const column=Number(lm.column),ownType=samePending&&pending?.type?pending.type:lm.type,duration=Math.max(1,Number(payload.peerPresentation.duration)||peerRoomPresentationSyncDropMs());
  const tx={version,before,after,events,lm,column,ownType,duration,presentation:payload.peerPresentation};
  const receivedAt=Date.now(),targetAt=peerRoomPresentationSyncLocalTarget(payload.peerPresentation);peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt,targetAt,scheduledWaitMs:Math.max(0,targetAt-receivedAt),stagedAt:null,commitTargetAt:targetAt+duration};
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{};peerRoomPresentationSyncCancelSchedule('dropStart');peerRoomPresentationSyncCancelSchedule('dropCommit');
  peerRoomPresentationSyncScheduleAt('dropStart',targetAt,()=>peerRoomPresentationSyncStage(tx))
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

// Peer Room events use absolute timestamps derived from the same host-authored drop target.
// Each event is scheduled from the anchor, not from the previous event callback, so one slow
// browser frame cannot permanently push the rest of a combat chain behind the other player.
function peerRoomPresentationSyncPlayEvents(events,column,presentation,done){
  const queue=prepareEvents(events);if(!queue.length){done();return}
  try{clearTimer('event')}catch{}
  const anchor=peerRoomPresentationSyncLocalEventAnchor(presentation);let index=0,offset=0;
  const next=()=>{
    if(index>=queue.length){
      peerRoomPresentationSyncScheduleAt('event',anchor+offset,()=>{activePresentation=null;overlay.classList.remove('show');done()});return
    }
    const event=queue[index],target=anchor+offset,duration=Math.max(1,Number(eventDuration(event))||1);index++;offset+=duration;
    peerRoomPresentationSyncScheduleAt('event',target,()=>{
      if(!peerRoomPresentationSyncActive()){activePresentation=null;overlay.classList.remove('show');done();return}
      activePresentation={event,column:presentationColumn(event,column)};render();try{emitFeedback(feedbackCueForEvent(event))}catch{};showEvent(event);next()
    })
  };
  next()
}
const duelFinishNetworkPresentationBeforePresentationSync=duelFinishNetworkPresentation;
duelFinishNetworkPresentation=function(events,column){
  const pending=peerRoomPresentationSyncState.pendingEventPresentation;
  if(!pending||!peerRoomPresentationSyncActive()||Number(pending.version)!==Number(duelSession.handledVersion))return duelFinishNetworkPresentationBeforePresentationSync(events,column);
  peerRoomPresentationSyncState.pendingEventPresentation=null;
  const done=()=>duelFinishNetworkPresentationBeforePresentationSync([],column);
  if(!events?.length){done();return}
  return peerRoomPresentationSyncPlayEvents(events,column,pending.presentation,done)
};
globalThis.duelFinishNetworkPresentation=duelFinishNetworkPresentation;

const peerRoomTransactionClearVisualBeforePresentationSync=peerRoomTransactionClearVisual;
peerRoomTransactionClearVisual=function(){
  try{clearTimer('peerRoomPresentationStart');clearTimer('event')}catch{};peerRoomPresentationSyncCancelAllSchedules();peerRoomPresentationSyncState.pendingEventPresentation=null;hoverCol=null;return peerRoomTransactionClearVisualBeforePresentationSync()
};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

if(peerRoom?.role==='guest'&&peerRoom.conn?.open)setTimeout(peerRoomPresentationSyncBurst,0);

globalThis.peerRoomPresentationSync={version:PEER_ROOM_PRESENTATION_SYNC_VERSION,protocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,state:peerRoomPresentationSyncState,active:peerRoomPresentationSyncActive,burst:peerRoomPresentationSyncBurst,leadMs:peerRoomPresentationSyncLeadMs,receiptLeadMs:peerRoomPresentationSyncReceiptLeadMs,localTarget:peerRoomPresentationSyncLocalTarget,eventAnchor:peerRoomPresentationSyncLocalEventAnchor,scheduleAt:peerRoomPresentationSyncScheduleAt};
