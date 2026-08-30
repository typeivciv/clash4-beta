// One match-controller seam for server, WebRTC and Pass & Play transports.
'use strict';
function duelRouteReady(){if(directDuel.active)return directDuelReady();return duelReady()}
function duelRouteMove(owner,type,column){if(passDuel.active)return passDuelMove(owner,type,column);if(directDuel.active)return directDuelMove(owner,type,column);return duelMove(owner,type,column)}
function duelLeaveAllToHome(){
  try{directClosePeer({notify:true})}catch{};try{passReset()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};setMatchControllerMode('arcade',{owner:H});init()
}
function duelResetCompletedMatchUi(){
  try{clearPresentationTimers()}catch{};try{clearTimer('replay')}catch{};
  try{resetMatchRuntime(H,{isReady:false})}catch{};
  postMatchView='none';replayPhase='idle';replayVisualState=null;replayStepIndex=-1;dropPresentation=null;finishReplay=null;busy=false;ready=false;
  try{end.classList.remove('show','duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter')}catch{};
  try{coinOverlay.classList.add('show')}catch{}
}
function duelReturnToModeHub({notify=true}={}){
  // Clear the terminal game before transport teardown. Otherwise a late render can
  // resurrect the completed result screen while the Duel hub is opening.
  duelResetCompletedMatchUi();
  try{directClosePeer({notify})}catch{};try{passReset()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};
  setMatchControllerMode('duel',{owner:H});coinOverlay.classList.add('show');openDuelHub();queueFit()
}
function duelRouteNewDuel(){duelReturnToModeHub({notify:true})}
globalThis.duelRouteReady=duelRouteReady;
globalThis.duelRouteMove=duelRouteMove;
globalThis.duelLeaveAllToHome=duelLeaveAllToHome;
globalThis.duelResetCompletedMatchUi=duelResetCompletedMatchUi;
globalThis.duelReturnToModeHub=duelReturnToModeHub;
globalThis.duelRouteNewDuel=duelRouteNewDuel;
