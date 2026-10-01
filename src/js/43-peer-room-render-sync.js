'use strict';
const PEER_ROOM_RENDER_SYNC_VERSION='0.20.6';
const PEER_ROOM_RENDER_SYNC_MIN_LEAD_MS=420;
const PEER_ROOM_RENDER_SYNC_EVENT_MIN_AFTER_DROP_MS=160;
const PEER_ROOM_RENDER_SYNC_EVENT_ARM_LEAD_MS=260;

const peerRoomRenderSyncEventState={current:null};
const peerRoomRenderSyncState={dropSequence:0,activeDrop:null,lastDrop:null};
globalThis.peerRoomRenderSyncEventState=peerRoomRenderSyncEventState;
globalThis.peerRoomRenderSyncState=peerRoomRenderSyncState;

function peerRoomRenderSyncInstallStyle(){
  if(typeof document==='undefined'||document.querySelector('style[data-peer-room-render-sync]'))return;
  const style=document.createElement('style');style.dataset.peerRoomRenderSync='1';style.textContent=`
    body.peer-room-sync-prepared #board .disc.justDropped{animation:none!important;visibility:hidden!important}
    #board .disc.justDropped.peerRoomWaapiDrop{animation:none!important;visibility:visible!important;transform-origin:center;will-change:transform,opacity,filter}
  `;document.head.append(style)
}
function peerRoomRenderSyncGhost(){return document.querySelector('#board .disc.justDropped')}
function peerRoomRenderSyncCancelDrop(){
  const active=peerRoomRenderSyncState.activeDrop;if(!active)return;
  peerRoomRenderSyncState.activeDrop=null;
  try{active.animation?.cancel?.()}catch{}
}
function peerRoomRenderSyncClearPrepared(){
  try{document.body.classList.remove('peer-room-sync-prepared')}catch{}
  const ghost=peerRoomRenderSyncGhost();if(ghost){ghost.classList.remove('peerRoomWaapiDrop');delete ghost.dataset.peerRoomSyncTarget;delete ghost.dataset.peerRoomSyncDropId}
}

const peerRoomPresentationSyncReceiptLeadBeforeRenderSync=peerRoomPresentationSyncReceiptLeadMs;
peerRoomPresentationSyncReceiptLeadMs=function(conn,observedDownlink=0){
  return Math.max(PEER_ROOM_RENDER_SYNC_MIN_LEAD_MS,peerRoomPresentationSyncReceiptLeadBeforeRenderSync(conn,observedDownlink))
};
globalThis.peerRoomPresentationSyncReceiptLeadMs=peerRoomPresentationSyncReceiptLeadMs;
if(globalThis.peerRoomPresentationSync)globalThis.peerRoomPresentationSync.receiptLeadMs=peerRoomPresentationSyncReceiptLeadMs;

function peerRoomRenderSyncEventTarget(presentation){
  const hostAt=Number(presentation?.presentAtHost),duration=Math.max(1,Number(presentation?.duration)||220);
  if(!Number.isFinite(hostAt))return null;
  return hostAt+duration+PEER_ROOM_RENDER_SYNC_EVENT_MIN_AFTER_DROP_MS
}
function peerRoomRenderSyncLocalHostTime(hostAt){
  const at=Number(hostAt);if(!Number.isFinite(at))return Date.now();
  if(peerRoom?.role==='guest'&&peerRoomPresentationSyncState.synced)return at+Number(peerRoomPresentationSyncState.offsetMs||0);
  return at
}
function peerRoomRenderSyncCancelEventSchedules(){
  try{for(const name of [...peerRoomPresentationSyncState.schedules.keys()])if(String(name).startsWith('renderEvent:'))peerRoomPresentationSyncCancelSchedule(name)}catch{}
}
function peerRoomRenderSyncResetEventState(){
  peerRoomRenderSyncCancelEventSchedules();
  peerRoomRenderSyncEventState.current=null
}
function peerRoomRenderSyncCreateEventState(tx){
  const queue=prepareEvents(tx.events||[]),state={
    id:String(tx.presentation?.id||''),version:tx.version,tx,events:tx.events||[],queue,column:tx.column,presentation:tx.presentation,
    hostCommitReady:false,guestCommitReady:false,hostCommitAt:null,guestCommitAt:null,eventsAtHost:null,scheduled:false,committed:false,complete:false
  };
  peerRoomRenderSyncCancelEventSchedules();peerRoomRenderSyncEventState.current=state;return state
}
function peerRoomRenderSyncCurrent(version=null){
  const state=peerRoomRenderSyncEventState.current;if(!state)return null;
  if(version!==null&&Number(state.version)!==Number(version))return null;
  return state
}
function peerRoomRenderSyncDispatchEvent(state,event,column){
  if(!state||state.complete||peerRoomRenderSyncEventState.current!==state||!state.committed)return;
  if(!peerRoomPresentationSyncActive()){peerRoomRenderSyncFinishEvents(state);return}
  activePresentation={event,column:presentationColumn(event,column)};render();try{emitFeedback(feedbackCueForEvent(event))}catch{};showEvent(event)
}
function peerRoomRenderSyncFinishEvents(state){
  if(!state||state.complete||peerRoomRenderSyncEventState.current!==state||!state.committed)return;
  state.complete=true;peerRoomRenderSyncCancelEventSchedules();activePresentation=null;overlay.classList.remove('show');
  peerRoomRenderSyncEventState.current=null;
  duelFinishNetworkPresentationBeforeRenderEventSync([],state.column)
}
function peerRoomRenderSyncArmEvents(state,eventsAtHost){
  if(!state||state.complete||state.scheduled||!state.queue.length)return false;
  const hostAt=Number(eventsAtHost);if(!Number.isFinite(hostAt))return false;
  state.eventsAtHost=hostAt;state.scheduled=true;
  let offset=0;
  for(let i=0;i<state.queue.length;i++){
    const event=state.queue[i],target=peerRoomRenderSyncLocalHostTime(hostAt+offset),duration=Math.max(1,Number(eventDuration(event))||1);
    peerRoomPresentationSyncScheduleAt(`renderEvent:${state.version}:${i}`,target,()=>peerRoomRenderSyncDispatchEvent(state,event,state.column));
    offset+=duration
  }
  const endTarget=peerRoomRenderSyncLocalHostTime(hostAt+offset);
  peerRoomPresentationSyncScheduleAt(`renderEvent:${state.version}:end`,endTarget,()=>peerRoomRenderSyncFinishEvents(state));
  return true
}
function peerRoomRenderSyncMaybeStartHostEvents(){
  const state=peerRoomRenderSyncCurrent();
  if(peerRoom?.role!=='host'||!state||state.complete||state.scheduled||!state.queue.length||!state.hostCommitReady||!state.guestCommitReady)return false;
  const dropEnd=Number(state.presentation?.presentAtHost||Date.now())+Math.max(1,Number(state.presentation?.duration)||220);
  const eventsAtHost=Math.max(dropEnd+PEER_ROOM_RENDER_SYNC_EVENT_MIN_AFTER_DROP_MS,Date.now()+PEER_ROOM_RENDER_SYNC_EVENT_ARM_LEAD_MS);
  state.eventsAtHost=eventsAtHost;
  const conn=peerRoom.connections?.get?.(2);
  if(conn?.open)peerRoomSend(conn,{kind:'room-presentation-events-go',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:state.id,version:state.version,eventsAtHost});
  return peerRoomRenderSyncArmEvents(state,eventsAtHost)
}
function peerRoomRenderSyncSignalCommitReady(state){
  if(!state||!state.queue.length||!state.committed)return;
  const at=Date.now();
  if(peerRoom?.role==='host'){
    state.hostCommitReady=true;state.hostCommitAt=at;peerRoomRenderSyncMaybeStartHostEvents();return
  }
  if(peerRoom?.role==='guest'&&Number(peerRoom.seat)===2&&peerRoom.conn?.open){
    state.guestCommitAt=at;
    peerRoomSend(peerRoom.conn,{kind:'room-presentation-commit-ready',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:state.id,version:state.version,committedAtGuest:at})
  }
}

function peerRoomRenderSyncDistance(ghost){
  try{return getComputedStyle(ghost).getPropertyValue('--drop-distance').trim()||'-420%'}catch{return'-420%'}
}
function peerRoomRenderSyncCreateDropAnimation(tx,ghost,targetAt){
  if(!ghost||typeof ghost.animate!=='function')return null;
  const createdAt=Date.now(),delay=Math.max(0,targetAt-createdAt),distance=peerRoomRenderSyncDistance(ghost),dropId=`prd_${tx.version}_${++peerRoomRenderSyncState.dropSequence}`;
  ghost.dataset.peerRoomSyncTarget=String(targetAt);ghost.dataset.peerRoomSyncDropId=dropId;ghost.classList.add('peerRoomWaapiDrop');
  document.body.classList.remove('peer-room-sync-prepared');
  const animation=ghost.animate([
    {offset:0,transform:`translateY(${distance}) scale(.94)`,filter:'brightness(1.08)',opacity:0},
    {offset:.001,transform:`translateY(${distance}) scale(.94)`,filter:'brightness(1.08)',opacity:1},
    {offset:.68,transform:'translateY(7%) scale(1.025)',filter:'brightness(1.02)',opacity:1},
    {offset:.84,transform:'translateY(-3%) scale(.995)',filter:'none',opacity:1},
    {offset:1,transform:'translateY(0) scale(1)',filter:'none',opacity:1}
  ],{duration:tx.duration,delay,easing:'cubic-bezier(.18,.78,.25,1.04)',fill:'both'});
  const active={id:dropId,version:tx.version,targetAt,duration:tx.duration,createdAt,delay,animation,ghost,finished:false};
  peerRoomRenderSyncState.activeDrop=active;peerRoomRenderSyncState.lastDrop={id:dropId,version:tx.version,targetAt,duration:tx.duration,createdAt,delay,finishedAt:null};
  try{document.dispatchEvent(new CustomEvent('peer-room-drop-created',{detail:{id:dropId,version:tx.version,targetAt,duration:tx.duration,createdAt,delay}}))}catch{}
  animation.finished.then(()=>{
    if(active.finished)return;active.finished=true;const finishedAt=Date.now();
    if(peerRoomRenderSyncState.lastDrop?.id===dropId)peerRoomRenderSyncState.lastDrop={...peerRoomRenderSyncState.lastDrop,finishedAt};
    try{document.dispatchEvent(new CustomEvent('peer-room-drop-finished',{detail:{id:dropId,version:tx.version,targetAt,finishedAt}}))}catch{}
    if(peerRoomRenderSyncState.activeDrop===active)peerRoomRenderSyncState.activeDrop=null;
    peerRoomRenderSyncCommit(tx)
  }).catch(()=>{});
  return active
}
function peerRoomRenderSyncPrepare(tx,targetAt){
  if(peerRoomTransactionState.activeVersion!==tx.version)return false;
  const prepStarted=Date.now();hoverCol=null;
  peerRoomRenderSyncInstallStyle();document.body.classList.add('peer-room-sync-prepared');
  dropPresentation={before:tx.before,owner:tx.lm.owner,type:tx.lm.owner===H?tx.ownType:null,column:tx.column,targetRow:dropTargetRow(tx.before,tx.column),moveNumber:tx.after.moveNumber,duration:tx.duration};
  render();
  const ghost=peerRoomRenderSyncGhost(),configuredAt=Date.now();
  tx.preparedGhost=ghost;tx.targetAt=targetAt;
  const active=peerRoomRenderSyncCreateDropAnimation(tx,ghost,targetAt);
  if(!active){
    document.body.classList.remove('peer-room-sync-prepared');
    peerRoomPresentationSyncScheduleAt('dropCommitFallback',targetAt+tx.duration,()=>peerRoomRenderSyncCommit(tx))
  }
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,preparedAt:configuredAt,prepareCostMs:configuredAt-prepStarted,animationEngine:active?'waapi':'fallback',waapiDelayMs:active?.delay??null,cssTargetAt:targetAt,commitTargetAt:targetAt+tx.duration,eventTargetAt:peerRoomRenderSyncEventTarget(tx.presentation)};
  return true
}
function peerRoomRenderSyncStart(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,feedbackAt:Date.now()};
  try{emitFeedback('drop')}catch{}
}
function peerRoomRenderSyncCommit(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  const state=peerRoomRenderSyncCurrent(tx.version);
  peerRoomRenderSyncClearPrepared();
  peerRoomPresentationSyncState.pendingEventPresentation=null;
  peerRoomTransactionCommit(tx);
  if(state&&state.committed)peerRoomRenderSyncSignalCommitReady(state)
}

const duelApplyActiveUpdateBeforeRenderSync=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomPresentationSyncActive()||!payload?.peerPresentation)return duelApplyActiveUpdateBeforeRenderSync(payload);
  const version=Number(payload.version);if(!Number.isFinite(version)||version<=duelSession.handledVersion||!payload.state)return;
  const pending=duelSession.pendingLocal,after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  const samePending=!!(pending?.peerRoomSynchronized&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const before=samePending?pending.before:cloneState(s);
  duelSession.handledVersion=version;peerRoomTransactionState.activeVersion=version;busy=true;duelSession.pendingLocal=null;try{peerRoomPolishState.previewPending=null}catch{}
  if(!lm||!Number.isInteger(Number(lm.column))){
    peerRoomRenderSyncCancelDrop();peerRoomRenderSyncClearPrepared();peerRoomRenderSyncResetEventState();hoverCol=null;peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return
  }
  const column=Number(lm.column),ownType=samePending&&pending?.type?pending.type:lm.type,duration=Math.max(1,Number(payload.peerPresentation.duration)||peerRoomPresentationSyncDropMs());
  const tx={version,before,after,events,lm,column,ownType,duration,presentation:payload.peerPresentation};
  const receivedAt=Date.now(),targetAt=peerRoomPresentationSyncLocalTarget(payload.peerPresentation);
  peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt,targetAt,scheduledWaitMs:Math.max(0,targetAt-receivedAt),preparedAt:null,prepareCostMs:null,feedbackAt:null,commitTargetAt:targetAt+duration,eventTargetAt:peerRoomRenderSyncEventTarget(payload.peerPresentation)};
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{}
  try{peerRoomPresentationSyncCancelSchedule('dropStart');peerRoomPresentationSyncCancelSchedule('dropCommit');peerRoomPresentationSyncCancelSchedule('dropCommitFallback')}catch{}
  peerRoomRenderSyncCancelDrop();peerRoomRenderSyncCreateEventState(tx);
  if(!peerRoomRenderSyncPrepare(tx,targetAt))return;
  peerRoomPresentationSyncScheduleAt('dropStart',targetAt,()=>peerRoomRenderSyncStart(tx))
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

const duelFinishNetworkPresentationBeforeRenderEventSync=duelFinishNetworkPresentation;
duelFinishNetworkPresentation=function(events,column){
  const state=peerRoomRenderSyncCurrent(duelSession.handledVersion);
  if(!state)return duelFinishNetworkPresentationBeforeRenderEventSync(events,column);
  state.committed=true;state.column=column;
  peerRoomPresentationSyncState.pendingEventPresentation=null;
  if(!events?.length||!state.queue.length){peerRoomRenderSyncEventState.current=null;peerRoomRenderSyncCancelEventSchedules();return duelFinishNetworkPresentationBeforeRenderEventSync([],column)}
};
globalThis.duelFinishNetworkPresentation=duelFinishNetworkPresentation;

const peerRoomHostMessageBeforeRenderSync=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-commit-ready'){
    if(Number(conn?.__peerRoomSeat)!==2)return;
    const state=peerRoomRenderSyncCurrent(Number(data.version));if(!state||String(data.id||'')!==state.id)return;
    state.guestCommitReady=true;state.guestCommitAt=Number(data.committedAtGuest)||Date.now();peerRoomRenderSyncMaybeStartHostEvents();return
  }
  return peerRoomHostMessageBeforeRenderSync(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforeRenderSync=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-events-go'){
    const state=peerRoomRenderSyncCurrent(Number(data.version));if(!state||String(data.id||'')!==state.id)return;
    peerRoomRenderSyncArmEvents(state,Number(data.eventsAtHost));return
  }
  return peerRoomGuestMessageBeforeRenderSync(data)
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

const peerRoomTransactionClearVisualBeforeRenderSync=peerRoomTransactionClearVisual;
peerRoomTransactionClearVisual=function(){peerRoomRenderSyncCancelDrop();peerRoomRenderSyncClearPrepared();peerRoomRenderSyncResetEventState();return peerRoomTransactionClearVisualBeforeRenderSync()};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

peerRoomRenderSyncInstallStyle();
globalThis.peerRoomRenderSync={version:PEER_ROOM_RENDER_SYNC_VERSION,prepare:peerRoomRenderSyncPrepare,start:peerRoomRenderSyncStart,clear:peerRoomRenderSyncClearPrepared,eventState:peerRoomRenderSyncEventState,state:peerRoomRenderSyncState,eventTarget:peerRoomRenderSyncEventTarget,armEvents:peerRoomRenderSyncArmEvents};
