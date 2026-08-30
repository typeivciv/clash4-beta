import assert from 'node:assert/strict';
import fs from 'node:fs';

const direct=fs.readFileSync('src/js/16-duel-direct-webrtc.js','utf8');
const nearby=fs.readFileSync('src/js/19-duel-nearby-qr.js','utf8');
const turn=fs.readFileSync('src/js/20-duel-turn-alpha.js','utf8');
const colors=fs.readFileSync('src/js/21-duel-colors-share.js','utf8');
const postmatch=fs.readFileSync('src/js/22-duel-postmatch.js','utf8');
const tester=fs.readFileSync('src/js/23-duel-alpha-tester.js','utf8');
const postmatchCss=fs.readFileSync('src/styles/53-duel-postmatch.css','utf8');
const testerCss=fs.readFileSync('src/styles/54-duel-alpha-tester.css','utf8');
const pass=fs.readFileSync('src/js/17-duel-pass-play.js','utf8');
const router=fs.readFileSync('src/js/18-duel-router.js','utf8');
const lobby=fs.readFileSync('src/ui/private-duel-lobby.html','utf8');

for(const token of [
  'RTCPeerConnection',"createDataChannel('clash4-duel',{ordered:true})","stun:stun.l.google.com:19302",
  'packDirectSignal','unpackDirectSignal',"kind:'offer'","kind:'answer'","async function directJoinSignal(raw,pairing='remote')","directJoinSignal(value,'remote')",
  'directClosePeer();duelStopPolling();duelClearActiveSession()','duelCopyCode.hidden=true','directAuthorityMove','localDuelPayload'
])assert.ok(direct.includes(token),`Direct Duel contract missing ${token}`);
assert.ok(!direct.includes('fetch('),'core WebRTC transport must not call the Clash 4 HTTP game server');

for(const token of [
  "DIRECT_PEER_JOIN_PARAM='c4peer'",'DIRECT_PEER_ATTEMPT_TIMEOUT_MS=90_000','DIRECT_HOST_INVITE_TTL_MS=5*60_000','let directNearbyRetryPeerId=',
  'function directPeerTimeoutForRole(role)','function directNearbyJoinLink(peerId)','new Peer(undefined,{debug:0,config:DIRECT_RTC_CONFIG})',
  "peer.on('connection',conn=>directBindPeerJsConnection(conn))","peer.connect(hostPeerId,{reliable:true,serialization:'json'})",
  'directPeerSession.peer?.disconnect()','No return QR or service URL is required.','directBootNearbyPeerUx();',"stun:stun.cloudflare.com:3478",
  'function directObservePeerConnection(conn)','function directPeerRouteFailureMessage()',"pc.iceConnectionState==='failed'","directConnectionBadge('error','Direct route blocked')",
  'function directRecoveryActions(','function directShowRecoveryForRole(','function directRetireHostInvite(','function directRefreshNearbyInvite()','function directRetryNearbyConnection()',
  'function directReleaseFailedConnection(','function directHostInviteStillLive()',"if(!directPeerSession.opened){directReleaseFailedConnection(directPeerSession.conn,{close:true})}",
  "refreshButton.textContent='Refresh Invite'","button.textContent='Retrying…'","directEl('duelDirectRefreshInvite')?.addEventListener('click',directRefreshNearbyInvite)",
  "directEl('duelDirectRetryConnection')?.addEventListener('click',directRetryNearbyConnection)","if(qr){qr.innerHTML='';qr.hidden=true}if(field)field.value=''",
  'Player 2 can retry the same live invite','This invite stays active for 5 minutes','invite active for 5 minutes','This connection attempt timed out after 90 seconds',
  'directOpenPanel();directNearbyRetryPeerId=hostPeerId;directRecoveryActions();directPeerReset();'
])assert.ok(nearby.includes(token),`Nearby PeerJS recovery contract missing ${token}`);
assert.ok(!nearby.includes('DIRECT_PEER_TIMEOUT_MS=90_000'),'host invite and guest attempt must not share the old 90-second timeout');
assert.ok(!nearby.includes('directNearbyRetryPeerId=hostPeerId;directOpenPanel()'),'guest retry target must be stored after directOpenPanel cleanup, never before it');
assert.ok(!nearby.includes("if(directPeerSession.conn&&directPeerSession.conn!==conn){try{conn.close()}catch{};return}"),'host must accept a retry after a failed pre-open DataConnection');
assert.ok(!nearby.includes('fetch('),'Nearby PeerJS pairing must not depend on the Clash 4 HTTP backend');
for(const forbidden of ['/api/direct/signals','/api/lobbies','/move','projectDuelState','applyLocalDuelMove','resolveRaw','BroadcastChannel','DIRECT_RETURN_KEY','duelDirectServerInput','Scan Player 2 Return QR'])assert.ok(!nearby.includes(forbidden),`Nearby pairing must stay out of backend/gameplay/old return-QR path: ${forbidden}`);

for(const token of ['DIRECT_ALPHA_TURN_SERVERS',"turn:openrelay.metered.ca:80","turn:openrelay.metered.ca:443","turn:openrelay.metered.ca:443?transport=tcp","username:'openrelayproject'","credential:'openrelayproject'",'function directAlphaRouteKind(conn)',"candidateType==='relay'",'Connected · relay fallback','encrypted TURN relay'])assert.ok(turn.includes(token),`Alpha TURN contract missing ${token}`);
assert.ok(!turn.includes('/api/lobbies'),'TURN fallback must not route gameplay through the Clash 4 game server');

for(const token of ["let duelSeatColors={human:'blue',ai:'orange'}",'function duelChooseOwnColor(id)',"directSend({kind:'color',color:id})","data?.kind==='color'",'function duelColorsConflict()','Both players selected the same color','duelApplySeatColors()','Copy Link','Text / Share Link','scan this QR with the normal Camera app or open the same Clash 4 invite link you send by text'])assert.ok(colors.includes(token),`Duel color/share contract missing ${token}`);
assert.ok(!colors.includes('bestContrast('),'Direct Duel colors must be independently selected, not auto-derived from the other player');
assert.ok(!colors.includes('fetch('),'color/share extension must stay on the existing Direct transport');

for(const token of [
  'function duelBuildFinishReplay()','recentInteractions.slice(-2).map(cloneInteractionForReplay)','function duelPostMatchReplayControls()','function duelPostMatchActionControls()',"if(matchMode==='arcade')","b.textContent='Rematch'","b.textContent='Home'",'function duelForceTerminalSummary()','function duelArmTerminalGuard()','setTimeout(()=>{duelTerminalGuard=null;duelForceTerminalSummary()},6500)','const directBindChannelBeforePostMatch=directBindChannel',"directConnectionBadge('offline','Duel complete')","#restartBottom,#reviewRestart,#sidebarRematch","#homeBottom,#reviewHome,#sidebarHome",'event.stopImmediatePropagation()','globalThis.duelRouteNewDuel?.()','function duelPostMatchAnimate()',"const visible=(s.winner||s.draw)&&postMatchView==='summary'&&!busy","endText.textContent='YOU WIN'","endText.textContent='TRY AGAIN'","mobileContextTitle.textContent='TRY AGAIN'","opponent=typeof opponentUiLabel==='function'?opponentUiLabel():(duel?'Opponent':'AI')","return duel?'DUEL VICTORY':'VICTORY'","return duel?'DUEL DEFEAT':'DEFEAT'","kind:'rematch-request'","kind:'rematch-start'",'function duelRequestDirectRematch()','function directTryStartRematch()','function duelStartDirectRematch(payload)',"remoteVoted?'Accept Rematch':'Rematch'"
])assert.ok(postmatch.includes(token),`Unified post-match contract missing ${token}`);
assert.ok(!postmatch.includes("endText.textContent='YOU LOSE'"),'loss headline must be TRY AGAIN, not YOU LOSE');
for(const token of ['.duelResultAnimation','duel-result-win','duel-result-loss','duel-result-draw','@keyframes duel-win-core','@keyframes duel-loss-core','body.reducedMotion'])assert.ok(postmatchCss.includes(token),`post-match CSS contract missing ${token}`);

for(const token of ["const ALPHA_TESTER_VERSION='0.16.0'",'function alphaTesterInfo()','function alphaConnectionHelp()','function alphaReportProblem()','function alphaReportTemplate()','navigator.share','Build URL: ${safeUrl}','location.origin}${location.pathname}${location.search}'])assert.ok(tester.includes(token),`Alpha tester utility missing ${token}`);
assert.ok(!tester.includes('location.hash'),'tester diagnostics must not copy the live PeerJS invite hash');
for(const token of ['.alphaTesterNotice','.alphaPrimaryModes','.alphaMoreOptions','.alphaTesterChecklist','.alphaTesterBar','.alphaTesterModal'])assert.ok(testerCss.includes(token),`Alpha tester CSS missing ${token}`);

for(const token of ['function duelResetCompletedMatchUi()','resetMatchRuntime(H,{isReady:false})',"coinOverlay.classList.add('show')",'function duelReturnToModeHub({notify=true}={})',"directClosePeer({notify})","setMatchControllerMode('duel',{owner:H})",'openDuelHub()'])assert.ok(router.includes(token),`Duel router reset contract missing ${token}`);
for(const token of ['passDuelOverlay','passShowHandoff','projectDuelState(passDuel.state,passDuel.viewer','applyLocalDuelMove','passDuelMove','publicMoveHistory=[];recentInteractions=[]'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRemote','duelDirectJoin','duelDirectRefreshRow','duelDirectRefreshInvite','duelDirectRetryConnection','alphaTesterBar','alphaConnectionHelp','alphaCopyTestInfo','alphaReportProblem','alphaTesterModal'])assert.ok(lobby.includes(`id="${id}"`),`Multiplayer Alpha hub missing ${id}`);
for(const copy of ['Play With Someone','Create Duel','QR nearby · share link anywhere','More Options','Hosted Room','Advanced · Manual Connection','Alpha tester checklist','Connection Help','Copy Test Info','Report Problem'])assert.ok(lobby.includes(copy),`Multiplayer Alpha tester copy missing ${copy}`);
assert.ok(lobby.indexOf('Play With Someone')<lobby.indexOf('Hosted Room'),'Direct Duel must remain more prominent than Hosted Room');
assert.ok(lobby.indexOf('Create Duel')<lobby.indexOf('Advanced · Manual Connection'),'one-link Direct create must appear before manual signaling');
assert.ok(lobby.includes('id="duelDirectRetryConnection" class="duelPrimary" type="button" hidden>Retry Connection</button>'),'guest recovery action must exist independently from host refresh');
assert.ok(!lobby.includes('id="duelDirectScanInvite"'),'one-scan flow must not expose an in-app first-scan button');
assert.ok(!lobby.includes('id="duelDirectServerInput"'),'Direct pairing must not ask the player for a pairing backend URL');
assert.ok(lobby.includes('Network fallback:'),'Direct UI must disclose the Alpha network fallback');
assert.ok(lobby.includes('Direct Duel is intended for trusted opponents'),'Direct Duel trust model must remain visible in Alpha UI');

for(const [name,source] of [['direct',direct],['nearby',nearby],['turn',turn],['colors',colors],['postmatch',postmatch],['tester',tester],['pass',pass],['router',router]]){try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}}
console.log('PASS Multiplayer Alpha 0.16 tester package + Direct recovery + TURN + colors/share + unified results + rematch/New Duel + Pass & Play contracts');
