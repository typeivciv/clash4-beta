'use strict';
const PEER_ROOM_RENDER_SYNC_VERSION='0.20.6';
const PEER_ROOM_RENDER_SYNC_MIN_LEAD_MS=420;

function peerRoomRenderSyncInstallStyle(){
  if(typeof document==='undefined'||document.querySelector('style[data-peer-room-render-sync]'))return;
  const style=document.createElement('style');style.dataset.peerRoomRenderSync='1';style.textContent=`
    body.peer-room-sync-prepared #board .disc.justDropped{animation-play-state:paused!important;visibility:hidden!important}
  `;document.head.append(style)
}
function peerRoomRenderSyncGhost(){return document.querySelector('#board .disc.justDropped')}
function peerRoomRenderSyncClearPrepared(){
  try{document.body.classList.remove('peer-room-sync-prepared')}catch{}
  const ghost=peerRoomRenderSyncGhost();if(ghost){ghost.style.removeProperty('animation-play-state');ghost.style.removeProperty('visibility')}
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

function peerRoomRenderSyncPrepare(tx,targetAt){
  if(peerRoomTransactionState.activeVersion!==tx.version)return false;
  const prepStarted=Date.now();hoverCol=null;
  peerRoomRenderSyncInstallStyle();document.body.classList.add('peer-room-sync-prepared');
  dropPresentation={before:tx.before,owner:tx.lm.owner,type:tx.lm.owner===H?tx.ownType:null,column:tx.column,targetRow:dropTargetRow(tx.before,tx.column),moveNumber:tx.after.moveNumber,duration:tx.duration};
  // This is deliberately early. The expensive 8x6 board/HUD rebuild is removed from the
  // synchronized instant; the shared timestamp only reveals and releases an existing disc.
  render();
  const ghost=peerRoomRenderSyncGhost();if(ghost){ghost.style.animationPlayState='paused';ghost.style.visibility='hidden'}
  tx.preparedGhost=ghost;tx.targetAt=targetAt;
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,preparedAt:Date.now(),prepareCostMs:Date.now()-prepStarted,commitTargetAt:targetAt+tx.duration};
  return true
}
function peerRoomRenderSyncStart(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  let ghost=tx.preparedGhost;if(!ghost?.isConnected)ghost=peerRoomRenderSyncGhost();
  document.body.classList.remove('peer-room-sync-prepared');
  if(ghost){ghost.style.visibility='visible';ghost.style.animationPlayState='running'}
  peerRoomPresentationSyncState.lastPresentation={...peerRoomPresentationSyncState.lastPresentation,stagedAt:Date.now(),renderAfterStageMs:0};
  try{emitFeedback('drop')}catch{}
}
function peerRoomRenderSyncCommit(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomRenderSyncClearPrepared();
  peerRoomPresentationSyncState.pendingEventPresentation={id:String(tx.presentation?.id||''),version:tx.version,presentation:{...tx.presentation}};
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
  peerRoomPresentationSyncState.lastPresentation={id:String(payload.peerPresentation.id||''),version,receivedAt,targetAt,scheduledWaitMs:Math.max(0,targetAt-receivedAt),preparedAt:null,prepareCostMs:null,stagedAt:null,commitTargetAt:targetAt+duration};
  try{clearTimer('peerRoomPresentationStart');clearTimer('peerRoomMoveTransaction')}catch{}
  try{peerRoomPresentationSyncCancelSchedule('dropStart');peerRoomPresentationSyncCancelSchedule('dropCommit')}catch{}
  if(!peerRoomRenderSyncPrepare(tx,targetAt))return;
  peerRoomPresentationSyncScheduleAt('dropStart',targetAt,()=>peerRoomRenderSyncStart(tx));
  peerRoomPresentationSyncScheduleAt('dropCommit',targetAt+duration,()=>peerRoomRenderSyncCommit(tx))
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

const peerRoomTransactionClearVisualBeforeRenderSync=peerRoomTransactionClearVisual;
peerRoomTransactionClearVisual=function(){peerRoomRenderSyncClearPrepared();return peerRoomTransactionClearVisualBeforeRenderSync()};
globalThis.peerRoomTransactionClearVisual=peerRoomTransactionClearVisual;if(globalThis.peerRoomTransaction)globalThis.peerRoomTransaction.clearVisual=peerRoomTransactionClearVisual;

peerRoomRenderSyncInstallStyle();
globalThis.peerRoomRenderSync={version:PEER_ROOM_RENDER_SYNC_VERSION,prepare:peerRoomRenderSyncPrepare,start:peerRoomRenderSyncStart,clear:peerRoomRenderSyncClearPrepared};
