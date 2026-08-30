// One match-controller seam for server, WebRTC and Pass & Play transports.
'use strict';
function duelRouteReady(){if(globalThis.directDuelIsActive?.())return directDuelReady();return duelReady()}
function duelRouteMove(owner,type,column){if(globalThis.passDuelIsActive?.())return passDuelMove(owner,type,column);if(globalThis.directDuelIsActive?.())return directDuelMove(owner,type,column);return duelMove(owner,type,column)}
function duelLeaveAllToHome(){
  try{globalThis.directClosePeer?.({notify:true})}catch{};try{globalThis.passReset?.()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};setMatchControllerMode('arcade',{owner:H});init()
}
function duelReturnToModeHub(){
  try{globalThis.directClosePeer?.({notify:true})}catch{};try{globalThis.passReset?.()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};openDuelHub()
}
function duelRouteNewDuel(){duelReturnToModeHub()}
globalThis.duelRouteReady=duelRouteReady;
globalThis.duelRouteMove=duelRouteMove;
globalThis.duelLeaveAllToHome=duelLeaveAllToHome;
globalThis.duelReturnToModeHub=duelReturnToModeHub;
globalThis.duelRouteNewDuel=duelRouteNewDuel;
