// One match-controller seam for server, WebRTC and Pass & Play transports.
'use strict';
function duelRouteReady(){if(directDuel.active)return directDuelReady();return duelReady()}
function duelRouteMove(owner,type,column){if(passDuel.active)return passDuelMove(owner,type,column);if(directDuel.active)return directDuelMove(owner,type,column);return duelMove(owner,type,column)}
function duelLeaveAllToHome(){
  try{directClosePeer({notify:true})}catch{};try{passReset()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};setMatchControllerMode('arcade',{owner:H});init()
}
function duelReturnToModeHub(){
  try{directClosePeer({notify:true})}catch{};try{passReset()}catch{};try{duelClearActiveSession()}catch{};try{duelStopPolling()}catch{};openDuelHub()
}
function duelRouteNewDuel(){duelReturnToModeHub()}
globalThis.duelRouteReady=duelRouteReady;
globalThis.duelRouteMove=duelRouteMove;
globalThis.duelLeaveAllToHome=duelLeaveAllToHome;
globalThis.duelReturnToModeHub=duelReturnToModeHub;
globalThis.duelRouteNewDuel=duelRouteNewDuel;
