// Private Duel client adapter. The server remains authoritative; this file only
// transports commands and maps each private projection into the existing local UI.
'use strict';
const DUEL_SERVER_KEY='clash4-duel-server-v1';
const DUEL_SESSION_KEY='clash4-duel-session-v1';
const DUEL_POLL_MS=800;
let duelSession={server:'',code:'',token:'',seat:null,phase:'idle',version:-1,handledVersion:-1,pollTimer:null,polling:false,active:false,pendingLocal:null,deferredPayload:null};

function normalizeDuelServer(value){return String(value||'').trim().replace(/\/+$/,'')}
function initialDuelServer(){
  const q=new URLSearchParams(location.search).get('duelServer');
  if(q){const v=normalizeDuelServer(q);try{localStorage.setItem(DUEL_SERVER_KEY,v)}catch{};return v}
  try{const saved=localStorage.getItem(DUEL_SERVER_KEY);if(saved)return normalizeDuelServer(saved)}catch{}
  if(['localhost','127.0.0.1'].includes(location.hostname))return `${location.protocol}//${location.hostname}:8787`;
  return ''
}
function saveDuelServer(value){
  duelSession.server=normalizeDuelServer(value);duelServerInput.value=duelSession.server;
  try{if(duelSession.server)localStorage.setItem(DUEL_SERVER_KEY,duelSession.server);else localStorage.removeItem(DUEL_SERVER_KEY)}catch{}
  updateDuelConnectionBadge(duelSession.server?'checking':'offline');
  if(duelSession.server)duelHealthCheck()
}
function saveDuelSession(){try{sessionStorage.setItem(DUEL_SESSION_KEY,JSON.stringify({server:duelSession.server,code:duelSession.code,token:duelSession.token,seat:duelSession.seat}))}catch{}}
function loadDuelSession(){try{return JSON.parse(sessionStorage.getItem(DUEL_SESSION_KEY)||'null')}catch{return null}}
function duelClearActiveSession(){
  duelStopPolling();duelSession={...duelSession,code:'',token:'',seat:null,phase:'idle',version:-1,handledVersion:-1,active:false,pendingLocal:null,deferredPayload:null};
  try{sessionStorage.removeItem(DUEL_SESSION_KEY)}catch{}
}
globalThis.duelClearActiveSession=duelClearActiveSession;
function duelStopPolling(){if(duelSession.pollTimer)clearTimeout(duelSession.pollTimer);duelSession.pollTimer=null;duelSession.polling=false}
globalThis.duelStopPolling=duelStopPolling;
function updateDuelConnectionBadge(state){
  duelConnectionBadge.className='duelConnectionBadge '+(state==='online'?'online':state==='error'?'error':'offline');
  duelConnectionBadge.textContent=state==='online'?'Server online':state==='error'?'Server unavailable':duelSession.server?'Checking server':'Server not set'
}
function duelStatus(text,{error=false}={}){duelEntryStatus.textContent=text||'';duelEntryStatus.classList.toggle('error',error)}
function humanizeDuelError(error){return({
  'lobby-not-found':'Room code not found.','lobby-full':'That lobby already has two players.','invalid-player-token':'This Duel session is no longer valid.','not-your-turn':"It isn't your turn yet.",'blocked':'That column is protected this turn.','full':'That column is full.','inventory':'You are out of that piece.','match-not-active':'The match has not started yet.','match-complete':'That match is already complete.'
}[error]||String(error||'Network request failed.').replaceAll('-',' '))}
async function duelRequest(path,{method='GET',body=null,token=duelSession.token}={}){
  if(!duelSession.server)throw new Error('duel-server-not-configured');
  const headers={'content-type':'application/json'};if(token)headers.authorization='Bearer '+token;
  const res=await fetch(duelSession.server+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok){const err=new Error(data.error||`http-${res.status}`);err.status=res.status;err.payload=data;throw err}
  return data
}
async function duelHealthCheck(){
  if(!duelSession.server){updateDuelConnectionBadge('offline');return false}
  try{await duelRequest('/api/health',{token:''});updateDuelConnectionBadge('online');duelStatus('');return true}
  catch{updateDuelConnectionBadge('error');duelStatus('Could not reach the Duel server. Check the server URL.',{error:true});return false}
}
function resetDuelLobbyUi(){
  setVisible(duelEntryPanel,true);setVisible(duelWaitingPanel,false);setVisible(duelJoinForm,false);duelCodeInput.value='';duelStatus('');duelReadyButton.disabled=false;duelReadyButton.textContent="I'm Ready";
  duelYouReady.textContent='Not ready';duelYouReady.classList.remove('ready');duelOpponentReady.textContent='Waiting…';duelOpponentReady.classList.remove('ready')
}
function openDuelLobby(){
  setMatchControllerMode('duel',{owner:H});setIntroScreen('duel');resetDuelLobbyUi();duelServerInput.value=duelSession.server;
  const saved=loadDuelSession();
  if(saved?.server&&saved?.code&&saved?.token){duelSession={...duelSession,...saved,active:false,phase:'lobby'};duelServerInput.value=duelSession.server;duelRestoreSession();return}
  duelHealthCheck()
}
globalThis.openDuelLobby=openDuelLobby;
function showDuelWaiting(){setVisible(duelEntryPanel,false);setVisible(duelWaitingPanel,true);duelLobbyCode.textContent=duelSession.code||'------';duelSeatLabel.textContent=duelSession.seat===H?'Player 1':'Player 2';queueFit()}
async function duelCreateLobby(){
  duelStatus('Creating room…');if(!await duelHealthCheck())return;
  try{const p=await duelRequest('/api/lobbies',{method:'POST',body:{},token:''});duelSession.code=p.code;duelSession.token=p.token;duelSession.seat=p.seat;duelSession.phase='lobby';saveDuelSession();showDuelWaiting();duelWaitingCopy.textContent='Share the room code with the other player.';await duelPollOnce();duelStartPolling()}
  catch(e){duelStatus(humanizeDuelError(e.message),{error:true})}
}
async function duelJoinLobby(){
  const code=duelCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);duelCodeInput.value=code;
  if(code.length!==6){duelStatus('Enter the full 6-character room code.',{error:true});return}
  duelStatus('Joining room…');if(!await duelHealthCheck())return;
  try{const p=await duelRequest(`/api/lobbies/${encodeURIComponent(code)}/join`,{method:'POST',body:{},token:''});duelSession.code=p.code;duelSession.token=p.token;duelSession.seat=p.seat;duelSession.phase='lobby';saveDuelSession();showDuelWaiting();duelWaitingCopy.textContent='Connected. Both players must press Ready.';await duelPollOnce();duelStartPolling()}
  catch(e){duelStatus(humanizeDuelError(e.message),{error:true})}
}
async function duelRestoreSession(){
  showDuelWaiting();duelWaitingCopy.textContent='Restoring this private session…';
  try{await duelPollOnce();duelStartPolling()}
  catch{duelClearActiveSession();resetDuelLobbyUi();duelStatus('The previous room could not be restored. Create or join a new one.',{error:true})}
}
async function duelReady(){
  duelReadyButton.disabled=true;duelReadyButton.textContent='Ready ✓';
  try{const p=await duelRequest(`/api/lobbies/${duelSession.code}/ready`,{method:'POST',body:{}});duelApplyPayload(p)}
  catch(e){duelReadyButton.disabled=false;duelReadyButton.textContent="I'm Ready";duelStatus(humanizeDuelError(e.message),{error:true})}
}
function duelStartPolling(){duelStopPolling();duelSession.polling=true;const loop=async()=>{if(!duelSession.polling)return;let delay=DUEL_POLL_MS;try{await duelPollOnce()}catch(e){if(e.status===404||e.status===401){duelStopPolling();duelStatus(humanizeDuelError(e.message),{error:true});return}updateDuelConnectionBadge('error');if(e.status===429)delay=2000}duelSession.pollTimer=setTimeout(loop,delay)};duelSession.pollTimer=setTimeout(loop,DUEL_POLL_MS)}
async function duelPollOnce(){if(!duelSession.code||!duelSession.token)return;const p=await duelRequest(`/api/lobbies/${duelSession.code}`);duelApplyPayload(p);return p}

function duelMapOwner(owner){if(owner!==H&&owner!==A)return owner;return duelSession.seat===A?other(owner):owner}
function duelMapCooldown(cd){return cd?{...cd,protectedOwner:duelMapOwner(cd.protectedOwner),blockedOwner:duelMapOwner(cd.blockedOwner)}:cd}
function duelMapEvent(e){
  const out={...e};if(out.owner)out.owner=duelMapOwner(out.owner);if(out.atk)out.atk={...out.atk,owner:duelMapOwner(out.atk.owner)};if(out.def)out.def={...out.def,owner:duelMapOwner(out.def.owner)};if(out.cooldown)out.cooldown=duelMapCooldown(out.cooldown);return out
}
function opponentInventoryPlaceholder(total){return{rock:Number(total)||0,paper:0,scissors:0,decoy:0}}
function duelProjectedStateToUi(ps){
  return{
    board:ps.board.map(col=>col.map(piece=>({...piece,owner:duelMapOwner(piece.owner)}))),
    inv:{human:{...ps.inventory.self},ai:opponentInventoryPlaceholder(ps.inventory.opponentTotal)},
    turn:duelMapOwner(ps.turn),winner:ps.winner?duelMapOwner(ps.winner):null,winReason:ps.winReason||null,clashmate:ps.clashmate?{...ps.clashmate,owner:duelMapOwner(ps.clashmate.owner)}:null,draw:!!ps.draw,nextId:999999,moveNumber:ps.moveNumber||0,
    aiKnow:{},aiOpponentModel:{humanMoves:0,proactiveBlocks:0,immediateBlocks:0,counterThreatMoves:0},cooldowns:(ps.cooldowns||[]).map(duelMapCooldown),lastMove:ps.lastMove?{...ps.lastMove,owner:duelMapOwner(ps.lastMove.owner)}:null
  }
}
function updateDuelWaiting(p){
  const me=p.players.find(x=>x.seat===duelSession.seat),opp=p.players.find(x=>x.seat!==duelSession.seat);
  duelLobbyStatus.textContent=p.status==='waiting-for-player'?'Waiting for opponent…':p.status==='waiting-for-ready'?'Ready check':'Starting match…';
  duelYouReady.textContent=me?.ready?'Ready ✓':'Not ready';duelYouReady.classList.toggle('ready',!!me?.ready);
  duelOpponentReady.textContent=!opp?'Waiting…':opp.ready?'Ready ✓':'Not ready';duelOpponentReady.classList.toggle('ready',!!opp?.ready);
  if(me?.ready){duelReadyButton.disabled=true;duelReadyButton.textContent='Ready ✓'}
  if(opp&&!me?.ready)duelWaitingCopy.textContent='Opponent joined. Press Ready when you are set.';
  if(me?.ready&&!opp?.ready)duelWaitingCopy.textContent='You are ready. Waiting for the opponent.';
  if(me?.ready&&opp?.ready)duelWaitingCopy.textContent='Both ready. Randomizing the first player…'
}
function duelBeginActive(p){
  duelSession.active=true;duelSession.phase='active';duelSession.handledVersion=p.version;duelSession.version=Math.max(duelSession.version,p.version);duelSession.deferredPayload=null;
  setMatchControllerMode('duel',{owner:H});
  resetMatchRuntime(H,{isReady:true});humanColor=presetColor('blue');aiColor=presetColor('orange');applyColors();
  s=duelProjectedStateToUi(p.state);coinOverlay.classList.remove('show');busy=false;ready=true;publicMoveHistory=[];recentInteractions=[];finishReplay=null;
  const restored=(s.moveNumber||0)>0,terminal=!!(s.winner||s.draw);postMatchView=terminal?'summary':'none';
  quickStarterBanner.hidden=true;render();queueFit();
  if(terminal){duelStopPolling();msg('Private Duel restored — match complete.');return}
  if(restored){quickStarterTitle.textContent='MATCH RESTORED';quickStarterCopy.textContent=s.turn===H?'Your turn · private session resumed':'Opponent turn · private session resumed';quickStarterBanner.hidden=false;scheduleTimer('quickStarter',()=>{quickStarterBanner.hidden=true},1250);msg(s.turn===H?'Private Duel restored — your turn.':'Private Duel restored — opponent turn.');return}
  quickStarterTitle.textContent=s.turn===H?'YOU START':'OPPONENT STARTS';quickStarterCopy.textContent='Private Duel · first player selected randomly';quickStarterBanner.hidden=false;scheduleTimer('quickStarter',()=>{quickStarterBanner.hidden=true},1250);
  msg(s.turn===H?'Private Duel — you move first.':'Private Duel — opponent moves first.');
}
function duelFinishNetworkPresentation(events,column){
  const done=()=>{
    busy=false;
    const deferred=duelSession.deferredPayload;duelSession.deferredPayload=null;
    if(deferred&&deferred.version>duelSession.handledVersion){duelApplyPayload(deferred);return}
    if(s.winner||s.draw){duelStopPolling();postMatchView='summary';finishReplay=null;render();return}
    continueTurnController()
  };
  if(events.length)playEvents(events,done,column);else done()
}
function duelApplyActiveUpdate(p){
  if(p.version<=duelSession.handledVersion)return;
  const before=cloneState(s),after=duelProjectedStateToUi(p.state),events=(p.events||[]).map(duelMapEvent),lm=after.lastMove;
  s=after;duelSession.handledVersion=p.version;addEventsToStats(events);
  if(lm){publicMoveHistory.push(publicMoveLog(lm.owner,events));if(publicMoveHistory.length>24)publicMoveHistory.shift()}
  recentInteractions.push({before,after:cloneState(after),events:events.map(e=>({...e})),owner:lm?.owner??A,type:lm?.type??null,column:lm?.column??0,moveNumber:after.moveNumber});if(recentInteractions.length>2)recentInteractions.shift();
  busy=true;hoverCol=null;
  const pending=duelSession.pendingLocal;
  if(pending&&lm?.owner===H&&lm.column===pending.column){
    duelSession.pendingLocal=null;dropPresentation={before:pending.before,owner:H,type:pending.type,column:pending.column,targetRow:dropTargetRow(pending.before,pending.column),moveNumber:after.moveNumber,duration:TIMING.drop};render();emitFeedback('drop');scheduleTimer('drop',()=>{dropPresentation=null;render();duelFinishNetworkPresentation(events,lm.column)},TIMING.drop)
  }else{duelSession.pendingLocal=null;render();duelFinishNetworkPresentation(events,lm?.column??null)}
}
function duelApplyPayload(p){
  const incomingVersion=Number(p?.version);
  updateDuelConnectionBadge('online');
  if(!Number.isFinite(incomingVersion))return;
  if(duelSession.active&&incomingVersion<duelSession.handledVersion)return;
  duelSession.version=Math.max(duelSession.version,incomingVersion);duelSession.phase=p.phase;
  if(p.phase!=='active'){updateDuelWaiting(p);return}
  if(!duelSession.active){duelBeginActive(p);return}
  if(busy&&!duelSession.pendingLocal&&incomingVersion>duelSession.handledVersion){
    const deferred=duelSession.deferredPayload;
    if(!deferred||incomingVersion>=deferred.version)duelSession.deferredPayload=p;
    return
  }
  duelApplyActiveUpdate(p)
}
async function duelMove(owner,type,c){
  if(owner!==H||matchMode!=='duel'||!duelSession.active)return;
  if(!ready||busy||s.turn!==H||s.winner||s.draw||s.inv[H][type]<=0)return;
  const legal=legalCols(H);if(!legal.includes(c)){let cd=rawBlocking(s,H).find(x=>x.column===c);msg(s.board[c].length>=ROWS?'That column is full.':cd?.level==='fortified'?'That column is Fortified this turn.':'That column is on Combat Cooldown this turn.');return}
  busy=true;const pending={before:cloneState(s),type,column:c,baseVersion:duelSession.handledVersion};duelSession.pendingLocal=pending;render();msg('Move committed — waiting for the server…');
  try{const p=await duelRequest(`/api/lobbies/${duelSession.code}/move`,{method:'POST',body:{type,column:c}});duelApplyPayload(p)}
  catch(e){
    if(duelSession.pendingLocal!==pending||duelSession.handledVersion>pending.baseVersion)return;
    duelSession.pendingLocal=null;busy=false;render();msg(humanizeDuelError(e.message))
  }
}
globalThis.duelMove=duelMove;
function duelReturnToLobby(){duelClearActiveSession();coinOverlay.classList.add('show');setMatchControllerMode('duel',{owner:H});resetMatchRuntime(H);resetDuelLobbyUi();setIntroScreen('duel');duelHealthCheck()}
globalThis.duelReturnToLobby=duelReturnToLobby;
function duelLeaveToHome(){duelClearActiveSession();init()}
globalThis.duelLeaveToHome=duelLeaveToHome;
