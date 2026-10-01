'use strict';
const PEER_ROOM_RENDER_SYNC_VERSION='0.20.6';
const PEER_ROOM_RENDER_SYNC_MIN_LEAD_MS=420;
const PEER_ROOM_RENDER_SYNC_EVENT_MIN_AFTER_DROP_MS=160;
const PEER_ROOM_RENDER_SYNC_EVENT_ARM_LEAD_MS=260;

const peerRoomRenderSyncEventState={current:null};
globalThis.peerRoomRenderSyncEventState=peerRoomRenderSyncEventState;

function peerRoomRenderSyncInstallStyle(){
  if(typeof document==='undefined'||document.querySelector('style[data-peer-room-render-sync]'))return;
  const style=document.createElement('style');style.dataset.peerRoomRenderSync='1';style.textContent=`
    body.peer-room-sync-prepared #board .disc.justDropped{animation:none!important;visibility:hidden!important}
    #board .disc.justDropped.peerRoomSyncedDrop{visibility:visible!important;animation:c4-peer-room-sync-drop var(--drop-duration,500ms) cubic-bezier(.18,.78,.25,1.04) var(--peer-room-sync-delay,0ms) both!important;transform-origin:center}
    @keyframes c4-peer-room-sync-drop{
      0%{transform:translateY(var(--drop-distance,-420%)) scale(.94);filter:brightness(1.08);opacity:0}
      .1%{transform:translateY(var(--drop-distance,-420%)) scale(.94);filter:brightness(1.08);opacity:1}
      68%{transform:translateY(7%) scale(1.025);opacity:1}
      84%{transform:translateY(-3%) scale(.995);opacity:1}
      100%{transform:translateY(0) scale(1);filter:none;opacity:1}
    }
  `;document.head.append(style)
}
function peerRoomRenderSyncGhost(){return document.querySelector('#board .disc.justDropped')}
function peerRoomRenderSyncClearPrepared(){
  try{document.body.classList.remove('peer-room-sync-prepared')}catch{}
  const ghost=peerRoomRenderSyncGhost();if(ghost){ghost.classList.remove('peerRoomSyncedDrop');ghost.style.removeProperty('--peer-room-sync-delay');delete ghost.dataset.peerRoomSyncTarget}
}

// Give WebKit enough preparation headroom to build/decorate the board before the shared
// visual timestamp. This changes presentation latency only; canonical move validation is
// still complete before PREPARE and neither player can mutate authority during the wait.
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
    hostPrepared:peerRoom?.role==='host',guestPrepared:false,eventsAtHost:null,scheduled:false,committed:false,complete:false
  };
  peerRoomRenderSyncCancelEventSchedules();peerRoomRenderSyncEventState.current=state;return state
}
function peerRoomRenderSyncCurrent(version=null){
  const state=peerRoomRenderSyncEventState.current;if(!state)return null;
  if(version!==null&&Number(state.version)!==Number(version))return null;
  return state
}
function peerRoomRenderSyncDispatchEvent(state,event,column){
  if(!state||state.complete||peerRoomRenderSyncEventState.current!==state)return;
  if(!state.committed&&state.tx&&Number(peerRoomTransactionState.activeVersion)===Number(state.version))peerRoomRenderSyncCommit(state.tx);
  if(!state.committed)return;
  if(!peerRoomPresentationSyncActive()){peerRoomRenderSyncFinishEvents(state);return}
  activePresentation={event,column:presentationColumn(event,column)};render();try{emitFeedback(feedbackCueForEvent(event))}catch{};showEvent(event)
}
function peerRoomRenderSyncFinishEvents(state){
  if(!state||state.complete||peerRoomRenderSyncEventState.current!==state)return;
  if(!state.committed&&state.tx&&Number(peerRoomTransactionState.activeVersion)===Number(state.version))peerRoomRenderSyncCommit(state.tx);
  if(!state.committed)return;
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
  if(peerRoom?.role!=='host'||!state||state.complete||state.scheduled||!state.queue.length||!state.hostPrepared||!state.guestPrepared)return false;
  const dropEnd=Number(state.presentation?.presentAtHost||Date.now())+Math.max(1,Number(state.presentation?.duration)||220);
  const eventsAtHost=Math.max(dropEnd+PEER_ROOM_RENDER_SYNC_EVENT_MIN_AFTER_DROP_MS,Date.now()+PEER_ROOM_RENDER_SYNC_EVENT_ARM_LEAD_MS);
  state.eventsAtHost=eventsAtHost;
  const conn=peerRoom.connections?.get?.(2);
  if(conn?.open)peerRoomSend(conn,{kind:'room-presentation-events-go',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:state.id,version:state.version,eventsAtHost});
  return peerRoomRenderSyncArmEvents(state,eventsAtHost)
}
function peerRoomRenderSyncSignalPrepared(state){
  if(!state||!state.queue.length)return;
  if(peerRoom?.role==='host'){state.hostPrepared=true;peerRoomRenderSyncMaybeStartHostEvents();return}
  if(peerRoom?.role==='guest'&&Number(peerRoom.seat)===2&&peerRoom.conn?.open){
    peerRoomSend(peerRoom.conn,{kind:'room-presentation-render-ready',protocol:PEER_ROOM_PROTOCOL,syncProtocol:PEER_ROOM_PRESENTATION_SYNC_PROTOCOL,id:state.id,version:state.version,preparedAtGuest:Date.now()})
  }
}

function peerRoomRenderSyncPrepare(tx,targetAt){
  if(peerRoomTransactionState.activeVersion!==tx.version)return false;
  const prepStarted=Date.now();hoverCol=null;
  peerRoomRenderSyncInstallStyle();document.body.classList.add('peer-room-sync-prepared');
  dropPresentation={before:tx.before,owner:tx.lm.owner,type:tx.lm.owner===H?tx.ownType:null,column:tx.column,targetRow:dropTargetRow(tx.before,tx.column),moveNumber:tx.after.moveNumber,duration:tx.duration};
  // Build the expensive 8x6 board before the shared clock. While this render runs the
  // prepared class prevents the normal justDropped animation from starting at all.
  render();
  const ghost=peerRoomRenderSyncGhost();
  const configuredAt=Date.now(),delay=Math.max(0,targetAt-configuredAt);
  if(ghost){
    ghost.dataset.peerRoomSyncTarget=String(targetAt);
    ghost.style.setProperty('--peer-room-sync-delay',`${delay}ms`);
    ghost.classList.add('peerRoomSyncedDrop');
    // Releasing the preparation class starts a CSS animation with a positive delay. The
    // browser animation timeline, rather than a JavaScript wake-up, now owns the exact start.
    document.body.classList.remove('peer-room-sync-prepared')
  }else document.body.classList.remove('peer-room-sync-prepared');
  tx.preparedGhost=ghost;tx.targetAt=targetAt;
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,preparedAt:configuredAt,prepareCostMs:configuredAt-prepStarted,cssDelayMs:delay,cssTargetAt:targetAt,commitTargetAt:targetAt+tx.duration,eventTargetAt:peerRoomRenderSyncEventTarget(tx.presentation)};
  peerRoomRenderSyncSignalPrepared(peerRoomRenderSyncCurrent(tx.version));
  return true
}
function peerRoomRenderSyncStart(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,feedbackAt:Date.now()};
  try{emitFeedback('drop')}catch{}
}
function peerRoomRenderSyncCommit(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomRenderSyncClearPrepared();
  peerRoomPresentationSyncState.pendingEventPresentation=null;
  peerRoomTransactionCommit(tx)
}

// Replace only the active Peer Room presentation seam. Direct Duel, Hosted Room, Solo and
// Pass & Play continue through the previously proven client path unchanged.
const duelApplyActiveUpdateBeforeRenderSync=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomPresentationSyncActive()||!payload?.peerPresentation)return duelApplyActiveUpdateBeforeRenderSync(payload);
  const version=Number(payload.version);if(!Number.isFinite(version)||version<=duelSession.handledVersion||!payload.state)return;
  const pending=duelSession.pendingLocal,after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  const samePending=!!(pending?.peerRoomSynchronized&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const before=samePending?pending.before:cloneState(s);
  duelSession.handledVersion=version;peerRoomTransactionState.activeVersion=version;busy=true;duelSession.pendingLocal=null;try{peerRoomPolishState.previewPending=null}catch{}
  if(!lm||!Number.isInteger(Number(lm.column))){
    peerRoomRenderSyncClearPrepared();peerRoomRenderSyncResetEventState();hoverCol=null;peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return
  }
  const column=Number(lm.column),ownType=samePending&&pending?.type?pending.type:lm.type,duration=Math.max(1,Number(payload.peerPresentation.duration)||peerRoomPresentationSyncDropMs());
  const tx={version,before,after,events,lm,column,ownType,duration,presentation:payload.peerPresentation};
  const receivedAt=Date.now(),targetAt=peerRoomPresentationSyncLocalTarget(payload.peerPresentation);
  peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt,targetAt,scheduledWaitMs:Math.max(0,targetAt-receivedAt),preparedAt:null,prepareCostMs:null,feedbackAt:null,commitTargetAt:targetAt+duration,eventTargetAt:peerRoomRenderSyncEventTarget(payload.peerPresentation)};
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{}
  try{peerRoomPresentationSyncCancelSchedule('dropStart');peerRoomPresentationSyncCancelSchedule('dropCommit')}catch{}
  peerRoomRenderSyncCreateEventState(tx);
  if(!peerRoomRenderSyncPrepare(tx,targetAt))return;
  // Only feedback and commit need JS callbacks now; visual drop start is CSS-scheduled.
  peerRoomPresentationSyncScheduleAt('dropStart',targetAt,()=>peerRoomRenderSyncStart(tx));
  peerRoomPresentationSyncScheduleAt('dropCommit',targetAt+duration,()=>peerRoomRenderSyncCommit(tx))
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

// Hold the turn in busy state after canonical commit until the shared event timeline finishes.
// If there are no presentation events, continue immediately through the proven Duel path.
const duelFinishNetworkPresentationBeforeRenderEventSync=duelFinishNetworkPresentation;
duelFinishNetworkPresentation=function(events,column){
  const state=peerRoomRenderSyncCurrent(duelSession.handledVersion);
  if(!state)return duelFinishNetworkPresentationBeforeRenderEventSync(events,column);
  state.committed=true;state.column=column;
  peerRoomPresentationSyncState.pendingEventPresentation=null;
  if(!events?.length||!state.queue.length){peerRoomRenderSyncEventState.current=null;peerRoomRenderSyncCancelEventSchedules();return duelFinishNetworkPresentationBeforeRenderEventSync([],column)}
  // The event GO can arrive before or after drop commit. Either way, the pre-armed absolute
  // timeline owns the visuals, so this callback deliberately does not start local playEvents().
  if(peerRoom?.role==='host')peerRoomRenderSyncMaybeStartHostEvents();
};
globalThis.duelFinishNetworkPresentation=duelFinishNetworkPresentation;

const peerRoomHostMessageBeforeRenderSync=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.syncProtocol===PEER_ROOM_PRESENTATION_SYNC_PROTOCOL&&data?.kind==='room-presentation-render-ready'){
    if(Number(conn?.__peerRoomSeat)!==2)return;
    const state=peerRoomRenderSyncCurrent(Number(data.version));if(!state||String(data.id||'')!==state.id)return;
    state.guestPrepared=true;peerRoomRenderSyncMaybeStartHostEvents();return
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
peerRoomTransactionClearVisual=function(){peerRoomRenderSyncClearPrepared();peerRoomRenderSyncResetEventState();return peerRoomTransactionClearVisualBeforeRenderSync()};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

peerRoomRenderSyncInstallStyle();
globalThis.peerRoomRenderSync={version:PEER_ROOM_RENDER_SYNC_VERSION,prepare:peerRoomRenderSyncPrepare,start:peerRoomRenderSyncStart,clear:peerRoomRenderSyncClearPrepared,eventState:peerRoomRenderSyncEventState,eventTarget:peerRoomRenderSyncEventTarget,armEvents:peerRoomRenderSyncArmEvents};
