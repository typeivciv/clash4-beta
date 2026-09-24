'use strict';
const PEER_ROOM_RENDER_SYNC_VERSION='0.20.6';
const PEER_ROOM_RENDER_SYNC_MIN_LEAD_MS=420;
// 41 already adds a 48 ms event gap. Shift only the event presentation by another
// 292 ms so the total post-drop resolution beat is 340 ms without changing drop time.
const PEER_ROOM_RENDER_SYNC_EVENT_EXTRA_MS=292;
const PEER_ROOM_RENDER_SYNC_EVENT_GAP_MS=340;

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

function peerRoomRenderSyncEventPresentation(presentation){
  const out={...(presentation||{})},hostAt=Number(out.presentAtHost);
  if(Number.isFinite(hostAt))out.presentAtHost=hostAt+PEER_ROOM_RENDER_SYNC_EVENT_EXTRA_MS;
  return out
}
function peerRoomRenderSyncEventTarget(presentation){
  const hostAt=Number(presentation?.presentAtHost),duration=Math.max(1,Number(presentation?.duration)||220);
  if(!Number.isFinite(hostAt))return null;
  return hostAt+duration+PEER_ROOM_RENDER_SYNC_EVENT_GAP_MS
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
  return true
}
function peerRoomRenderSyncStart(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  // Audio/haptic feedback can tolerate a late JS wake. The checker itself is already owned
  // by the CSS animation clock and does not depend on this callback for visual timing.
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,feedbackAt:Date.now()};
  try{emitFeedback('drop')}catch{}
}
function peerRoomRenderSyncCommit(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomRenderSyncClearPrepared();
  peerRoomPresentationSyncState.pendingEventPresentation={
    id:String(tx.presentation?.id||''),version:tx.version,
    presentation:peerRoomRenderSyncEventPresentation(tx.presentation)
  };
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
    peerRoomRenderSyncClearPrepared();hoverCol=null;peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return
  }
  const column=Number(lm.column),ownType=samePending&&pending?.type?pending.type:lm.type,duration=Math.max(1,Number(payload.peerPresentation.duration)||peerRoomPresentationSyncDropMs());
  const tx={version,before,after,events,lm,column,ownType,duration,presentation:payload.peerPresentation};
  const receivedAt=Date.now(),targetAt=peerRoomPresentationSyncLocalTarget(payload.peerPresentation);
  peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt,targetAt,scheduledWaitMs:Math.max(0,targetAt-receivedAt),preparedAt:null,prepareCostMs:null,feedbackAt:null,commitTargetAt:targetAt+duration,eventTargetAt:peerRoomRenderSyncEventTarget(payload.peerPresentation)};
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{}
  try{peerRoomPresentationSyncCancelSchedule('dropStart');peerRoomPresentationSyncCancelSchedule('dropCommit')}catch{}
  if(!peerRoomRenderSyncPrepare(tx,targetAt))return;
  // Only feedback and commit need JS callbacks now; visual drop start is CSS-scheduled.
  peerRoomPresentationSyncScheduleAt('dropStart',targetAt,()=>peerRoomRenderSyncStart(tx));
  peerRoomPresentationSyncScheduleAt('dropCommit',targetAt+duration,()=>peerRoomRenderSyncCommit(tx))
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

const peerRoomTransactionClearVisualBeforeRenderSync=peerRoomTransactionClearVisual;
peerRoomTransactionClearVisual=function(){peerRoomRenderSyncClearPrepared();return peerRoomTransactionClearVisualBeforeRenderSync()};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

peerRoomRenderSyncInstallStyle();
globalThis.peerRoomRenderSync={version:PEER_ROOM_RENDER_SYNC_VERSION,prepare:peerRoomRenderSyncPrepare,start:peerRoomRenderSyncStart,clear:peerRoomRenderSyncClearPrepared,eventGapMs:PEER_ROOM_RENDER_SYNC_EVENT_GAP_MS,eventPresentation:peerRoomRenderSyncEventPresentation};
