'use strict';
const PEER_ROOM_TRANSACTION_VERSION='0.20.4';

const peerRoomTransactionState={activeVersion:0,rematchVotes:{1:false,2:false},rematchStarting:false};
globalThis.peerRoomTransactionState=peerRoomTransactionState;

function peerRoomTransactionActive(){
  const seat=Number(globalThis.peerRoom?.seat||0);
  return !!(globalThis.peerRoomMatch?.phase==='active'&&!globalThis.peerRoomMatch?.spectator&&(seat===1||seat===2)&&document.body.classList.contains('peer-room-match-active'))
}
function peerRoomTransactionNow(){return globalThis.performance?.now?.()??Date.now()}
function peerRoomTransactionDropMs(){return Math.max(1,Number(globalThis.TIMING?.drop)||220)}
function peerRoomTransactionClearVisual(){
  try{clearTimer('peerRoomMoveTransaction')}catch{}
  try{clearTimer('peerRoomOptimisticDrop')}catch{}
  dropPresentation=null;
  try{peerRoomPolishState.previewPending=null}catch{}
  peerRoomTransactionState.activeVersion=0
}

// Both P1 and P2 begin their own local drop immediately. The host still owns validation;
// this preview is presentation only and never mutates canonical state.
const peerRoomMatchMoveBeforeTransaction=peerRoomMatchMove;
peerRoomMatchMove=function(owner,type,column){
  if(!peerRoomTransactionActive())return peerRoomMatchMoveBeforeTransaction(owner,type,column);
  if(peerRoomMatch.phase!=='active'||peerRoomMatch.spectator||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  const pending={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion,peerRoomTransaction:true,previewStartedAt:peerRoomTransactionNow()};
  duelSession.pendingLocal=pending;
  try{peerRoomPolishState.previewPending=pending}catch{}
  busy=true;
  dropPresentation={before:pending.before,owner:H,type,column:c,targetRow:dropTargetRow(pending.before,c),moveNumber:(s.moveNumber||0)+1,duration:peerRoomTransactionDropMs()};
  render();try{emitFeedback('drop')}catch{}
  if(Number(peerRoom.seat)===1)peerRoomMatchAuthorityMove(H,type,c);
  else if(Number(peerRoom.seat)===2&&peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-match-move',protocol:PEER_ROOM_PROTOCOL,type,column:c,baseVersion:duelSession.handledVersion})
};
globalThis.peerRoomMatchMove=peerRoomMatchMove;

function peerRoomTransactionRecord(before,after,events,lm){
  addEventsToStats(events);
  if(lm){publicMoveHistory.push(publicMoveLog(lm.owner,events));if(publicMoveHistory.length>24)publicMoveHistory.shift()}
  recentInteractions.push({before,after:cloneState(after),events:events.map(e=>({...e})),owner:lm?.owner??A,type:lm?.type??null,column:lm?.column??0,moveNumber:after.moveNumber});
  if(recentInteractions.length>2)recentInteractions.shift()
}
function peerRoomTransactionCommit(tx){
  if(peerRoomTransactionState.activeVersion!==tx.version)return;
  peerRoomTransactionState.activeVersion=0;
  dropPresentation=null;
  s=tx.after;
  peerRoomTransactionRecord(tx.before,tx.after,tx.events,tx.lm);
  render();
  duelFinishNetworkPresentation(tx.events,tx.lm?.column??null)
}

// One authoritative payload equals one visual transaction. The visible board stays on the
// pre-move state until the single drop completes. This fixes the host's snap-to-final-board
// behavior and prevents an optimistic P2 drop from being replayed on confirmation.
const duelApplyActiveUpdateBeforeTransaction=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomTransactionActive())return duelApplyActiveUpdateBeforeTransaction(payload);
  const version=Number(payload?.version);if(!Number.isFinite(version)||version<=duelSession.handledVersion||!payload?.state)return;
  const pending=duelSession.pendingLocal;
  const after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  const samePending=!!(pending?.peerRoomTransaction&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const before=samePending?pending.before:cloneState(s);
  duelSession.handledVersion=version;peerRoomTransactionState.activeVersion=version;busy=true;hoverCol=null;
  duelSession.pendingLocal=null;try{peerRoomPolishState.previewPending=null}catch{}

  if(!lm||!Number.isInteger(Number(lm.column))){
    peerRoomTransactionState.activeVersion=0;s=after;peerRoomTransactionRecord(before,after,events,lm);render();duelFinishNetworkPresentation(events,null);return
  }

  const column=Number(lm.column),duration=peerRoomTransactionDropMs();
  if(samePending&&dropPresentation){
    // The confirmation adopts the checker that is already falling. Do not render here:
    // rebuilding that ghost disc restarts its CSS animation and creates a double drop.
    const elapsed=Math.max(0,peerRoomTransactionNow()-Number(pending.previewStartedAt||peerRoomTransactionNow()));
    const remaining=Math.max(0,duration-elapsed);
    try{clearTimer('peerRoomMoveTransaction')}catch{}
    scheduleTimer('peerRoomMoveTransaction',()=>peerRoomTransactionCommit({version,before,after,events,lm}),remaining);
    return
  }

  // Remote/confirmed move: stage one fall against the last visible state, then commit.
  dropPresentation={before,owner:lm.owner,type:lm.owner===H?lm.type:null,column,targetRow:dropTargetRow(before,column),moveNumber:after.moveNumber,duration};
  render();try{emitFeedback('drop')}catch{}
  try{clearTimer('peerRoomMoveTransaction')}catch{}
  scheduleTimer('peerRoomMoveTransaction',()=>peerRoomTransactionCommit({version,before,after,events,lm}),duration)
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

// The 0.20.2/0.20.3 wrappers intentionally refreshed colors/chrome after every payload,
// but their final render rebuilt the falling-disc node. Own the Peer Room entry seam here
// so confirmation cannot restart a local drop or erase the host's staged remote drop.
const peerRoomMatchEnterPayloadBeforeTransaction=peerRoomMatchEnterPayload;
peerRoomMatchEnterPayload=function(payload,matchId,seat=peerRoom?.seat){
  if(!payload?.state)return;
  const first=peerRoomMatch.matchId!==matchId||!duelSession.active;
  peerRoomMatch.phase='active';peerRoomMatch.matchId=matchId||peerRoomMatch.matchId;peerRoomMatch.lastPayload=payload;peerRoomMatch.spectator=Number(seat)>2;
  if(peerRoomMatch.spectator&&!peerRoomMatch.watching)return;
  peerRoomMatchPrepareGameShell(seat);
  if(first){duelSession.active=false;duelSession.phase='active';duelSession.version=-1;duelSession.handledVersion=-1;duelSession.pendingLocal=null;duelSession.deferredPayloads=[]}
  duelApplyPayload(payload);
  try{directConnectionBadge('online',peerRoomMatch.spectator?'Peer Room · Spectating':'Peer Room · Live')}catch{}
  if(peerRoomMatch.spectator){ready=true;busy=false;try{msg(payload.state.winner||payload.state.draw?'Shared match complete.':'Spectating Player 1 vs Player 2.')}catch{}}
  try{peerRoomPolishApplyGameColors()}catch{}
  try{peerRoomPolishSyncMatchChrome()}catch{}
  try{peerRoomPresentationSyncUtilities()}catch{}
  try{peerRoomRuntimeEnterChat()}catch{}
};
globalThis.peerRoomMatchEnterPayload=peerRoomMatchEnterPayload;

function peerRoomRematchReset(){peerRoomTransactionState.rematchVotes={1:false,2:false};peerRoomTransactionState.rematchStarting=false}
function peerRoomRematchTerminal(){return peerRoomTransactionActive()&&!!(s?.winner||s?.draw)}
function peerRoomRematchUiState(){
  const seat=Number(peerRoom?.seat||0),otherSeat=seat===1?2:1,v=peerRoomTransactionState.rematchVotes;
  return{active:peerRoomRematchTerminal(),seat,localVoted:!!v[seat],remoteVoted:!!v[otherSeat],starting:peerRoomTransactionState.rematchStarting}
}
globalThis.peerRoomRematchUiState=peerRoomRematchUiState;
function peerRoomRematchBroadcastState(){
  if(peerRoom?.role!=='host')return;
  peerRoomBroadcast({kind:'room-rematch-state',protocol:PEER_ROOM_PROTOCOL,votes:{...peerRoomTransactionState.rematchVotes},starting:peerRoomTransactionState.rematchStarting});
  try{duelPostMatchActionControls()}catch{}
}
function peerRoomRematchPrepareClient(){
  peerRoomTransactionClearVisual();
  try{clearPresentationTimers()}catch{}
  activePresentation=null;busy=false;hoverCol=null;postMatchView='none';finishReplay=null;replayPhase='idle';replayVisualState=null;replayStepIndex=-1;
  duelSession.active=false;duelSession.phase='active';duelSession.version=-1;duelSession.handledVersion=-1;duelSession.pendingLocal=null;duelSession.deferredPayloads=[];
  try{end.classList.remove('show','duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter')}catch{}
}
function peerRoomRematchTryStart(){
  if(peerRoom?.role!=='host'||peerRoomTransactionState.rematchStarting||!peerRoomTransactionState.rematchVotes[1]||!peerRoomTransactionState.rematchVotes[2])return;
  peerRoomTransactionState.rematchStarting=true;peerRoomRematchBroadcastState();
  peerRoomMatch.matchId=`prm_${peerRoomRandom(12)}`;peerRoomMatch.phase='active';peerRoomMatch.watching=true;peerRoomMatch.authority={state:makeLocalDuelState(randomDuelStarter()),version:1};peerRoomMatch.lastPayload=null;
  peerRoomRematchPrepareClient();
  peerRoomMatchBroadcast([],'room-rematch-start');
  peerRoomRematchReset();
  try{peerRoomStatus('Rematch started · same room, same players.','ok')}catch{}
}
function peerRoomRematchRequest(){
  if(!peerRoomRematchTerminal()||peerRoomTransactionState.rematchStarting)return false;
  const seat=Number(peerRoom.seat||0);if(seat!==1&&seat!==2)return false;
  if(peerRoomTransactionState.rematchVotes[seat])return true;
  peerRoomTransactionState.rematchVotes[seat]=true;
  if(peerRoom.role==='host'){peerRoomRematchBroadcastState();peerRoomRematchTryStart()}
  else if(peerRoom.role==='guest'&&peerRoom.conn?.open){peerRoomSend(peerRoom.conn,{kind:'room-rematch-request',protocol:PEER_ROOM_PROTOCOL});try{duelPostMatchActionControls()}catch{}}
  try{msg('Rematch requested — waiting for the other player.')}catch{};return true
}
globalThis.peerRoomRematchRequest=peerRoomRematchRequest;

const peerRoomHostMessageBeforeTransaction=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-rematch-request'){
    if(Number(conn?.__peerRoomSeat)!==2||!peerRoomRematchTerminal())return;
    peerRoomTransactionState.rematchVotes[2]=true;peerRoomRematchBroadcastState();peerRoomRematchTryStart();return
  }
  return peerRoomHostMessageBeforeTransaction(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforeTransaction=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-rematch-state'){
    peerRoomTransactionState.rematchVotes={1:!!data.votes?.[1],2:!!data.votes?.[2]};peerRoomTransactionState.rematchStarting=!!data.starting;try{duelPostMatchActionControls()}catch{};return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-rematch-start'&&data.payload){
    peerRoomRematchPrepareClient();peerRoomRematchReset();peerRoomMatch.watching=true;peerRoomMatchEnterPayload(data.payload,data.matchId,peerRoom.seat);try{msg('Rematch started.')}catch{};return
  }
  return peerRoomGuestMessageBeforeTransaction(data)
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

function peerRoomRematchActionControls(rematchButtons,newMatchButtons){
  if(!peerRoomRematchTerminal())return false;
  const seat=Number(peerRoom.seat||0),state=peerRoomRematchUiState();
  const set=(button,text,disabled=false)=>{if(!button)return;button.hidden=false;button.textContent=text;button.disabled=disabled;button.setAttribute('aria-label',text);button.title=text};
  if(seat===1||seat===2){
    const label=state.starting?'Starting…':state.localVoted?'Waiting…':state.remoteVoted?'Accept Rematch':'Rematch';
    for(const button of rematchButtons)set(button,label,state.starting||state.localVoted)
  }else for(const button of rematchButtons)set(button,'Waiting for Players',true);
  for(const button of newMatchButtons)set(button,'Return to Lobby',false);
  return true
}
globalThis.peerRoomRematchActionControls=peerRoomRematchActionControls;
globalThis.peerRoomRematchHandleClick=function(){return peerRoomRematchRequest()};
globalThis.peerRoomRematchHandleLobbyClick=function(){if(peerRoomMatch?.phase!=='active')return false;peerRoomMatchRequestLobby();return true};

const peerRoomMatchStartBeforeTransaction=peerRoomMatchStart;
peerRoomMatchStart=function(){peerRoomRematchReset();return peerRoomMatchStartBeforeTransaction()};
globalThis.peerRoomMatchStart=peerRoomMatchStart;
const peerRoomMatchReturnLocalLobbyBeforeTransaction=peerRoomMatchReturnLocalLobby;
peerRoomMatchReturnLocalLobby=function(options={}){peerRoomTransactionClearVisual();peerRoomRematchReset();return peerRoomMatchReturnLocalLobbyBeforeTransaction(options)};
globalThis.peerRoomMatchReturnLocalLobby=peerRoomMatchReturnLocalLobby;

peerRoomRematchReset();
globalThis.peerRoomTransaction={version:PEER_ROOM_TRANSACTION_VERSION,active:peerRoomTransactionActive,clearVisual:peerRoomTransactionClearVisual,requestRematch:peerRoomRematchRequest};
