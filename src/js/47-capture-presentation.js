'use strict';
const C4_CAPTURE_PRESENTATION_VERSION='0.20.11';
let c4CaptureState=null,c4CaptureBoardOptions=null;
const C4_CAPTURE_CLOCK='renderEvent:captureResolve';

// Canonical state is already resolved when a network payload arrives. Keep only
// a projected visual board here, so later defenders cannot vanish before their
// own clash. Never run rules against this board or expose hidden identities.
function c4CaptureCancelClock(){
  clearTimer('c4CaptureResolve');
  if(typeof peerRoomPresentationSyncCancelSchedule==='function')peerRoomPresentationSyncCancelSchedule(C4_CAPTURE_CLOCK)
}
function c4CaptureFinish(){c4CaptureCancelClock();c4CaptureState=null}
function c4CapturePrepare(before,after,events,column){
  c4CaptureFinish();
  const first=(events||[]).find(e=>e.kind==='combat');
  if(!first?.atk||!Number.isInteger(column)||!before?.board?.[column])return;
  const board=before.board.map(col=>col.map(piece=>({...piece})));
  if(board[column].length>=ROWS)return;
  const incoming={...first.atk};
  // A combat event can reveal more than the board projection (in particular,
  // spectators see neither player's private pieces). Respect the projected
  // last move when staging the incoming checker before its combat cue.
  if(after.lastMove&&after.lastMove.owner===incoming.owner&&after.lastMove.type===null)incoming.type=null;
  board[column].push(incoming);
  c4CaptureState={board,column,moveNumber:after.moveNumber,pending:null,resolved:new Set()}
}
function c4CaptureRedraw(state){
  if(c4CaptureState!==state||!c4CaptureBoardOptions)return;
  // Rebuild only the board at resolution, leaving the combat cue and controls
  // untouched. Shared-room cue deadlines must not rebuild the whole game UI.
  renderBoardGrid({...c4CaptureBoardOptions,viewBoard:state.board})
}
function c4CaptureResolve(state,pending){
  if(c4CaptureState!==state||!pending||state.pending!==pending)return;
  c4CaptureCancelClock();state.pending=null;
  const col=state.board[state.column],index=col.findIndex(piece=>piece.id===pending.victim);
  if(index<0)return;
  col.splice(index,1);state.resolved.add(pending.victim);c4CaptureRedraw(state)
}
function c4CaptureCue(event,targetAt=Date.now()){
  const state=c4CaptureState;if(!state)return;
  // A due event may win the timer/frame race at the same deadline. Resolve the
  // previous clash before presenting the next one, exactly once.
  if(state.pending?.event===event)return;
  if(state.pending)c4CaptureResolve(state,state.pending);
  if(event?.kind!=='combat'||event.decoyContact||!['win','lose'].includes(event.o))return;
  const victim=event.o==='win'?event.def?.id:event.atk?.id;
  if(victim==null||state.resolved.has(victim))return;
  const pending={event,victim};state.pending=pending;
  const due=Number(targetAt)+eventDuration(event),resolve=()=>c4CaptureResolve(state,pending);
  if(typeof peerRoomPresentationSyncActive==='function'&&peerRoomPresentationSyncActive())peerRoomPresentationSyncScheduleAt(C4_CAPTURE_CLOCK,due,resolve);
  else scheduleTimer('c4CaptureResolve',resolve,Math.max(0,due-Date.now()))
}

const renderBoardGridBeforeCapturePresentation=renderBoardGrid;
renderBoardGrid=function(options){
  c4CaptureBoardOptions=options;
  const visual=c4CaptureState&&!dropPresentation?{...options,viewBoard:c4CaptureState.board}:options;
  return renderBoardGridBeforeCapturePresentation(visual)
};
globalThis.renderBoardGrid=renderBoardGrid;
const clearPresentationTimersBeforeCapturePresentation=clearPresentationTimers;
clearPresentationTimers=function(){c4CaptureFinish();return clearPresentationTimersBeforeCapturePresentation()};
const duelClearActiveSessionBeforeCapturePresentation=duelClearActiveSession;
duelClearActiveSession=function(){c4CaptureFinish();return duelClearActiveSessionBeforeCapturePresentation()};
globalThis.duelClearActiveSession=duelClearActiveSession;
globalThis.c4CapturePresentation={version:C4_CAPTURE_PRESENTATION_VERSION,get board(){return c4CaptureState?.board||null}};
