'use strict';
const PEER_ROOM_MATCH_VERSION='0.20.0';
const PEER_ROOM_MATCH_STORAGE='clash4.peerRoomMatch.v1';

let peerRoomMatch={
  phase:'lobby',matchId:'',authority:null,lastPayload:null,spectator:false,watching:true,returning:false
};
globalThis.peerRoomMatch=peerRoomMatch;

function peerRoomMatchEl(id){return document.getElementById(id)}
function peerRoomMatchOwnerForSeat(seat){return Number(seat)===1?H:Number(seat)===2?A:null}
function peerRoomMatchSeat2Online(){return !!peerRoom?.seats?.find?.(s=>s.seat===2&&s.connected)}
function peerRoomMatchPlayers(){return[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:peerRoomMatchSeat2Online()}]}
function peerRoomMatchSafeSet(key,value){try{localStorage.setItem(key,value)}catch{}}
function peerRoomMatchSafeRemove(key){try{localStorage.removeItem(key)}catch{}}
function peerRoomMatchPersist(){
  if(peerRoom?.role!=='host')return;
  if(peerRoomMatch.phase!=='active'||!peerRoomMatch.authority){peerRoomMatchSafeRemove(PEER_ROOM_MATCH_STORAGE);return}
  const snapshot={version:1,hostId:peerRoom.hostId,roomId:peerRoom.roomId,matchId:peerRoomMatch.matchId,authority:peerRoomMatch.authority,savedAt:Date.now()};
  peerRoomMatchSafeSet(PEER_ROOM_MATCH_STORAGE,JSON.stringify(snapshot))
}
function peerRoomMatchReadSnapshot(){
  try{const raw=localStorage.getItem(PEER_ROOM_MATCH_STORAGE);if(!raw)return null;const data=JSON.parse(raw);if(data?.version!==1||!data?.matchId||!data?.authority?.state)return null;return data}catch{return null}
}
function peerRoomMatchClearPersisted(){peerRoomMatchSafeRemove(PEER_ROOM_MATCH_STORAGE)}

function peerRoomMatchSpectatorPayload(state,version,events=[]){
  const revealAll=!!(state&&(state.winner||state.draw));
  const ps=projectDuelState(state,H,{revealAll});
  if(!revealAll){
    ps.board=ps.board.map(col=>col.map(piece=>({...piece,type:null})));
    if(ps.lastMove)ps.lastMove={...ps.lastMove,type:null};
    ps.inventory={self:Object.fromEntries(T.map(type=>[type,0])),opponentTotal:0}
  }
  return{ok:true,phase:'active',status:'active',seat:H,players:peerRoomMatchPlayers(),version,state:ps,events:projectEventsForViewer(events,H),updates:[],historyGap:false,spectator:true}
}
function peerRoomMatchPayloadForSeat(seat,events=[]){
  const auth=peerRoomMatch.authority;if(!auth)return null;
  const n=Number(seat);
  if(n===1)return localDuelPayload(auth.state,H,auth.version,events,peerRoomMatchPlayers());
  if(n===2)return localDuelPayload(auth.state,A,auth.version,events,peerRoomMatchPlayers());
  return peerRoomMatchSpectatorPayload(auth.state,auth.version,events)
}
function peerRoomMatchSendSeat(seat,conn,events=[],kind='room-match-payload'){
  const payload=peerRoomMatchPayloadForSeat(seat,events);if(!payload)return;
  peerRoomSend(conn,{kind,protocol:PEER_ROOM_PROTOCOL,matchId:peerRoomMatch.matchId,payload})
}
function peerRoomMatchBroadcast(events=[],kind='room-match-payload'){
  if(peerRoom?.role!=='host'||peerRoomMatch.phase!=='active'||!peerRoomMatch.authority)return;
  for(const [seat,conn] of peerRoom.connections)peerRoomMatchSendSeat(seat,conn,events,kind);
  const hostPayload=peerRoomMatchPayloadForSeat(1,events);peerRoomMatchEnterPayload(hostPayload,peerRoomMatch.matchId,1);
  peerRoomMatchPersist()
}

function peerRoomMatchEnsureLobbyCard(){
  const live=peerRoomMatchEl('peerRoomLive');if(!live||peerRoomMatchEl('peerRoomGame'))return;
  const seats=peerRoomMatchEl('peerRoomSeats')?.closest?.('.peerRoomSection');
  const section=document.createElement('section');section.id='peerRoomGame';section.className='peerRoomGame';
  section.innerHTML=`<div class="peerRoomGameHead"><div><span>SHARED GAME</span><strong>Clash 4 Match</strong></div><span id="peerRoomGameBadge" class="peerRoomGameBadge">LOBBY</span></div>
    <p id="peerRoomGameCopy">Connect Player 2 to start a shared Clash 4 match.</p>
    <div class="peerRoomGameActions"><button id="peerRoomStartGame" class="duelPrimary" type="button">Start Match</button><button id="peerRoomViewGame" type="button" hidden>View Live Match</button></div>
    <small id="peerRoomGameRole">Player 1 and Player 2 play. Players 3–4 spectate this same board.</small>`;
  if(seats)live.insertBefore(section,seats);else live.prepend(section);
  peerRoomMatchEl('peerRoomStartGame')?.addEventListener('click',peerRoomMatchStart);
  peerRoomMatchEl('peerRoomViewGame')?.addEventListener('click',peerRoomMatchViewLive)
}
function peerRoomMatchRenderLobby(){
  peerRoomMatchEnsureLobbyCard();
  const section=peerRoomMatchEl('peerRoomGame'),badge=peerRoomMatchEl('peerRoomGameBadge'),copy=peerRoomMatchEl('peerRoomGameCopy'),start=peerRoomMatchEl('peerRoomStartGame'),view=peerRoomMatchEl('peerRoomViewGame'),role=peerRoomMatchEl('peerRoomGameRole');
  if(!section)return;
  const seat=Number(peerRoom?.seat||0),active=peerRoomMatch.phase==='active';
  section.dataset.phase=active?'active':'lobby';
  if(active){
    if(badge)badge.textContent='MATCH LIVE';
    if(start)start.hidden=true;
    const canView=seat>2&&!peerRoomMatch.watching&&!!peerRoomMatch.lastPayload;
    if(view){view.hidden=!canView;view.textContent=peerRoomMatch.lastPayload?.state?.winner||peerRoomMatch.lastPayload?.state?.draw?'View Result':'View Live Match'}
    if(copy)copy.textContent=seat>2?(peerRoomMatch.watching?'You are spectating the shared match.':'A shared match is in progress. You can return to it any time.'):'The shared Player 1 vs Player 2 match is in progress.';
    if(role)role.textContent=seat>2?'Spectator seat · your room connection stays active.':'Player 1 and Player 2 are playing from the same host-authoritative game state.';
    return
  }
  if(badge)badge.textContent='LOBBY';if(view)view.hidden=true;
  if(peerRoom?.role==='host'){
    const ready=peerRoomMatchSeat2Online();if(start){start.hidden=false;start.disabled=!ready;start.textContent=ready?'Start Shared Match':'Waiting for Player 2'}
    if(copy)copy.textContent=ready?'Player 2 is connected. Start the shared Clash 4 match when ready.':'Connect Player 2 to enable the shared game.';
    if(role)role.textContent='You are Player 1 · Players 3–4 join as spectators.'
  }else{
    if(start)start.hidden=true;
    if(copy)copy.textContent=seat===2?'You are Player 2. Waiting for the host to start the shared match.':'You are a spectator. The host can start Player 1 vs Player 2 while you watch.';
    if(role)role.textContent=seat===2?'Your moves will be validated by Player 1’s host browser.':'You will receive a Fog-safe spectator projection of the same match.'
  }
}

function peerRoomMatchPrepareGameShell(seat){
  try{setVisible(duelEntryPanel,false);setVisible(duelWaitingPanel,false)}catch{}
  const panel=peerRoomMatchEl('peerRoomPanel');if(panel)panel.hidden=true;
  duelSession.seat=Number(seat)===2?A:H;
  setMatchControllerMode('duel',{owner:H});
  document.body.classList.toggle('peer-room-spectator',Number(seat)>2);
  document.body.classList.add('peer-room-match-active')
}
function peerRoomMatchEnterPayload(payload,matchId,seat=peerRoom?.seat){
  if(!payload?.state)return;
  const first=peerRoomMatch.matchId!==matchId||!duelSession.active;
  peerRoomMatch.phase='active';peerRoomMatch.matchId=matchId||peerRoomMatch.matchId;peerRoomMatch.lastPayload=payload;peerRoomMatch.spectator=Number(seat)>2;
  if(peerRoomMatch.spectator&&!peerRoomMatch.watching)return;
  peerRoomMatchPrepareGameShell(seat);
  if(first){duelSession.active=false;duelSession.phase='active';duelSession.version=-1;duelSession.handledVersion=-1;duelSession.pendingLocal=null;duelSession.deferredPayloads=[]}
  duelApplyPayload(payload);
  try{directConnectionBadge('online',peerRoomMatch.spectator?'Peer Room · Spectating':'Peer Room · Live')}catch{}
  if(peerRoomMatch.spectator){ready=true;busy=false;try{msg(payload.state.winner||payload.state.draw?'Shared match complete.':'Spectating Player 1 vs Player 2.')}catch{}}
}
function peerRoomMatchViewLive(){if(!peerRoomMatch.lastPayload)return;peerRoomMatch.watching=true;peerRoomMatchEnterPayload(peerRoomMatch.lastPayload,peerRoomMatch.matchId,peerRoom.seat)}

function peerRoomMatchStart(){
  if(peerRoom?.role!=='host'||peerRoomMatch.phase==='active'||!peerRoomMatchSeat2Online())return;
  peerRoomMatch.matchId=`prm_${peerRoomRandom(12)}`;peerRoomMatch.phase='active';peerRoomMatch.watching=true;peerRoomMatch.authority={state:makeLocalDuelState(randomDuelStarter()),version:1};peerRoomMatch.lastPayload=null;
  peerRoomStatus('Starting shared Clash 4 match…','ok');peerRoomMatchBroadcast([],'room-match-start')
}
globalThis.peerRoomMatchStart=peerRoomMatchStart;

function peerRoomMatchAuthorityMove(owner,type,column){
  const auth=peerRoomMatch.authority;if(peerRoom?.role!=='host'||peerRoomMatch.phase!=='active'||!auth)return;
  const q=applyLocalDuelMove(auth.state,owner,type,column);
  if(q.error){
    if(owner===A){const conn=peerRoom.connections.get(2);peerRoomSend(conn,{kind:'room-match-error',protocol:PEER_ROOM_PROTOCOL,error:q.error})}
    else{duelSession.pendingLocal=null;busy=false;try{render();msg(humanizeDuelError(q.error))}catch{}}
    return
  }
  auth.state=q.state;auth.version++;peerRoomMatchBroadcast(q.events,'room-match-payload')
}
function peerRoomMatchMove(owner,type,column){
  if(peerRoomMatch.phase!=='active'||peerRoomMatch.spectator||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  duelSession.pendingLocal={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion};busy=true;render();
  if(Number(peerRoom.seat)===1)peerRoomMatchAuthorityMove(H,type,c);
  else if(Number(peerRoom.seat)===2&&peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-match-move',protocol:PEER_ROOM_PROTOCOL,type,column:c,baseVersion:duelSession.handledVersion})
}

function peerRoomMatchReturnLocalLobby({keepLive=false}={}){
  try{duelResetCompletedMatchUi()}catch{};try{duelClearActiveSession()}catch{};
  document.body.classList.remove('peer-room-match-active','peer-room-spectator');
  setMatchControllerMode('duel',{owner:H});setIntroScreen('duel');
  const panel=peerRoomMatchEl('peerRoomPanel'),entry=peerRoomMatchEl('duelEntryPanel');if(entry)entry.hidden=false;if(panel)panel.hidden=false;
  const hub=peerRoomMatchEl('duelModeHub'),online=peerRoomMatchEl('duelOnlinePanel'),direct=peerRoomMatchEl('duelDirectPanel');if(hub)hub.hidden=true;if(online)online.hidden=true;if(direct)direct.hidden=true;
  if(Number(peerRoom.seat)>2&&keepLive)peerRoomMatch.watching=false;
  peerRoomRender();peerRoomMatchRenderLobby();queueFit()
}
function peerRoomMatchReturnAllToLobby(reason='Match ended.'){ 
  if(peerRoom?.role!=='host')return;
  peerRoomMatch.phase='lobby';peerRoomMatch.authority=null;peerRoomMatch.lastPayload=null;peerRoomMatch.matchId='';peerRoomMatch.watching=true;peerRoomMatchClearPersisted();
  peerRoomBroadcast({kind:'room-match-lobby',protocol:PEER_ROOM_PROTOCOL,reason});peerRoomMatchReturnLocalLobby();peerRoomStatus(`${reason} Room stays connected.`,'ok')
}
function peerRoomMatchRequestLobby(){
  if(peerRoomMatch.phase!=='active'){peerRoomMatchReturnLocalLobby();return}
  if(Number(peerRoom.seat)>2){peerRoomMatchReturnLocalLobby({keepLive:true});peerRoomStatus('You returned to the lobby. The shared match is still live.','ok');return}
  if(peerRoom?.role==='host'){peerRoomMatchReturnAllToLobby('Returned to lobby.');return}
  if(peerRoom?.role==='guest'&&peerRoom.conn?.open){peerRoomSend(peerRoom.conn,{kind:'room-match-return',protocol:PEER_ROOM_PROTOCOL});peerRoomStatus('Returning the shared match to the room lobby…','warn')}
}
globalThis.peerRoomMatchRequestLobby=peerRoomMatchRequestLobby;

const peerRoomHostMessageBeforeMatch=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-match-move'){
    if(conn.__peerRoomSeat===2)peerRoomMatchAuthorityMove(A,data.type,data.column);return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-match-return'){
    if(conn.__peerRoomSeat===2)peerRoomMatchReturnAllToLobby('Player 2 returned to lobby.');return
  }
  return peerRoomHostMessageBeforeMatch(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforeMatch=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&['room-match-start','room-match-payload'].includes(data.kind)&&data.payload){
    peerRoomMatch.watching=true;peerRoomMatchEnterPayload(data.payload,data.matchId,peerRoom.seat);return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data.kind==='room-match-error'){
    duelSession.pendingLocal=null;busy=false;try{render();msg(humanizeDuelError(data.error))}catch{};return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data.kind==='room-match-lobby'){
    peerRoomMatch.phase='lobby';peerRoomMatch.matchId='';peerRoomMatch.lastPayload=null;peerRoomMatch.watching=true;peerRoomMatchReturnLocalLobby();peerRoomStatus(`${data.reason||'Returned to lobby.'} Room stays connected.`,'ok');return
  }
  const result=peerRoomGuestMessageBeforeMatch(data);
  if(data?.kind==='room-welcome'||data?.kind==='room-state')requestAnimationFrame(peerRoomMatchRenderLobby);
  return result
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

// Keep the host join callback light. Seat assignment and welcome happen immediately;
// roster persistence/rendering and an in-progress match snapshot move to the next frame.
const peerRoomHostAssignBeforeMatch=peerRoomHostAssign;
peerRoomHostAssign=function(conn,clientKey){
  if(peerRoom.blocked.has(clientKey)){peerRoomSend(conn,{kind:'room-kicked',protocol:PEER_ROOM_PROTOCOL,reason:'Removed by host'});setTimeout(()=>{try{conn.close()}catch{}},40);return null}
  let seat=peerRoom.seatByClient.get(clientKey)||null;
  if(!seat){const open=peerRoom.seats.find(s=>s.seat>1&&!s.reserved);if(!open){peerRoomSend(conn,{kind:'room-full',protocol:PEER_ROOM_PROTOCOL});setTimeout(()=>{try{conn.close()}catch{}},40);return null}seat=open.seat;open.clientKey=clientKey;open.reserved=true;peerRoom.seatByClient.set(clientKey,seat)}
  const old=peerRoom.connections.get(seat);if(old&&old!==conn)try{old.close()}catch{}
  const record=peerRoom.seats.find(s=>s.seat===seat);record.connected=true;record.reserved=true;conn.__peerRoomSeat=seat;conn.__peerRoomClientKey=clientKey;peerRoom.connections.set(seat,conn);
  peerRoomSend(conn,{kind:'room-welcome',protocol:PEER_ROOM_PROTOCOL,seat,roomId:peerRoom.roomId,state:peerRoomPublicState(),projection:peerRoomProjectionFor(seat),chat:peerRoom.chat.slice(-PEER_ROOM_CHAT_MAX)});
  const finish=()=>{peerRoomBroadcastState();peerRoomStatus(`Player ${seat} connected.`,'ok');peerRoomMatchRenderLobby();if(peerRoomMatch.phase==='active'&&peerRoomMatch.authority)peerRoomMatchSendSeat(seat,conn,[],'room-match-start')};
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(finish);else setTimeout(finish,0);
  return seat
};
globalThis.peerRoomHostAssign=peerRoomHostAssign;

const peerRoomRenderBeforeMatch=peerRoomRender;
peerRoomRender=function(){const out=peerRoomRenderBeforeMatch();peerRoomMatchRenderLobby();return out};
globalThis.peerRoomRender=peerRoomRender;

const duelRouteMoveBeforePeerRoom=duelRouteMove;
duelRouteMove=function(owner,type,column){if(peerRoomMatch.phase==='active'&&peerRoom?.active){if(peerRoomMatch.spectator)return;return peerRoomMatchMove(owner,type,column)}return duelRouteMoveBeforePeerRoom(owner,type,column)};
globalThis.duelRouteMove=duelRouteMove;

const duelRouteNewDuelBeforePeerRoom=duelRouteNewDuel;
duelRouteNewDuel=function(){if(peerRoom?.active&&peerRoomMatch.phase==='active')return peerRoomMatchRequestLobby();return duelRouteNewDuelBeforePeerRoom()};
globalThis.duelRouteNewDuel=duelRouteNewDuel;
const duelLeaveAllToHomeBeforePeerRoom=duelLeaveAllToHome;
duelLeaveAllToHome=function(){if(peerRoom?.active&&peerRoomMatch.phase==='active')return peerRoomMatchRequestLobby();return duelLeaveAllToHomeBeforePeerRoom()};
globalThis.duelLeaveAllToHome=duelLeaveAllToHome;

if(typeof duelPostMatchActionControls==='function'){
  const duelPostMatchActionControlsBeforePeerRoom=duelPostMatchActionControls;
  duelPostMatchActionControls=function(){
    const out=duelPostMatchActionControlsBeforePeerRoom();
    if(peerRoom?.active&&peerRoomMatch.phase==='active'){
      for(const button of [restartBottom,reviewRestart,sidebarRematch,homeBottom,reviewHome,sidebarHome]){if(!button)continue;button.textContent='Return to Lobby';button.disabled=false;button.setAttribute('aria-label','Return to Peer Room lobby');button.title='Return to the connected Peer Room lobby'}
    }
    return out
  };
  globalThis.duelPostMatchActionControls=duelPostMatchActionControls
}

function peerRoomMatchTryRestore(){
  if(peerRoom?.role!=='host'||peerRoomMatch.phase==='active')return;
  const snap=peerRoomMatchReadSnapshot();if(!snap||snap.hostId!==peerRoom.hostId||snap.roomId!==peerRoom.roomId)return;
  peerRoomMatch.matchId=snap.matchId;peerRoomMatch.authority=snap.authority;peerRoomMatch.phase='active';peerRoomMatch.watching=true;
  peerRoomStatus('Recovered the shared match. Reconnecting players can resume.','warn');
  setTimeout(()=>peerRoomMatchBroadcast([],'room-match-start'),0)
}

function peerRoomMatchInstall(){
  peerRoomMatchEnsureLobbyCard();peerRoomMatchRenderLobby();
  const oldRestore=globalThis.peerRoomRestoreHost;
  if(typeof oldRestore==='function'&&!oldRestore.__peerRoomMatchWrapped){
    const wrapped=function(snapshot){const result=oldRestore(snapshot);setTimeout(peerRoomMatchTryRestore,250);return result};wrapped.__peerRoomMatchWrapped=true;peerRoomRestoreHost=wrapped;globalThis.peerRoomRestoreHost=wrapped
  }
}

peerRoomMatchInstall();
globalThis.peerRoomMatchApi={version:PEER_ROOM_MATCH_VERSION,start:peerRoomMatchStart,returnLobby:peerRoomMatchRequestLobby,view:peerRoomMatchViewLive,authorityMove:peerRoomMatchAuthorityMove};
