import assert from 'node:assert/strict';
import fs from 'node:fs';

const direct=fs.readFileSync('src/js/16-duel-direct-webrtc.js','utf8');
const nearby=fs.readFileSync('src/js/19-duel-nearby-qr.js','utf8');
const turn=fs.readFileSync('src/js/20-duel-turn-alpha.js','utf8');
const pass=fs.readFileSync('src/js/17-duel-pass-play.js','utf8');
const router=fs.readFileSync('src/js/18-duel-router.js','utf8');
const lobby=fs.readFileSync('src/ui/private-duel-lobby.html','utf8');

for(const token of [
  'RTCPeerConnection',
  "createDataChannel('clash4-duel',{ordered:true})",
  "stun:stun.l.google.com:19302",
  'packDirectSignal',
  'unpackDirectSignal',
  "kind:'offer'",
  "kind:'answer'",
  "async function directJoinSignal(raw,pairing='remote')",
  "directJoinSignal(value,'remote')",
  'directClosePeer();duelStopPolling();duelClearActiveSession()',
  'duelCopyCode.hidden=true',
  'directAuthorityMove',
  'localDuelPayload'
])assert.ok(direct.includes(token),`Direct Duel contract missing ${token}`);
assert.ok(!direct.includes('fetch('),'core WebRTC transport must not call the Clash 4 HTTP game server');

for(const token of [
  "DIRECT_PEER_JOIN_PARAM='c4peer'",
  'function directNearbyJoinLink(peerId)',
  'new Peer(undefined,{debug:0,config:DIRECT_RTC_CONFIG})',
  "peer.on('connection',conn=>directBindPeerJsConnection(conn))",
  "peer.connect(hostPeerId,{reliable:true,serialization:'json'})",
  'directPeerSession.peer?.disconnect()',
  'No return QR or service URL is required.',
  'normal Camera app',
  'directBootNearbyPeerUx();',
  "stun:stun.cloudflare.com:3478",
  'function directObservePeerConnection(conn)',
  'function directPeerRouteFailureMessage()',
  "pc.iceConnectionState==='failed'",
  "directConnectionBadge('error','Direct route blocked')",
  'same non-guest Wi-Fi',
  'TURN relay or Online Room fallback'
])assert.ok(nearby.includes(token),`Nearby PeerJS contract missing ${token}`);
assert.ok(!nearby.includes('fetch('),'Nearby PeerJS pairing must not depend on the Clash 4 HTTP backend');
for(const forbidden of ['/api/direct/signals','/api/lobbies','/move','projectDuelState','applyLocalDuelMove','resolveRaw','BroadcastChannel','DIRECT_RETURN_KEY','duelDirectServerInput','Scan Player 2 Return QR']){
  assert.ok(!nearby.includes(forbidden),`Nearby pairing must stay out of backend/gameplay/old return-QR path: ${forbidden}`)
}

for(const token of [
  'DIRECT_ALPHA_TURN_SERVERS',
  "turn:openrelay.metered.ca:80",
  "turn:openrelay.metered.ca:443",
  "turn:openrelay.metered.ca:443?transport=tcp",
  "username:'openrelayproject'",
  "credential:'openrelayproject'",
  'function directAlphaRouteKind(conn)',
  "candidateType==='relay'",
  "Connected · relay fallback",
  'encrypted TURN relay'
])assert.ok(turn.includes(token),`Alpha TURN contract missing ${token}`);
assert.ok(!turn.includes('/api/lobbies'),'TURN fallback must not route gameplay through the Clash 4 game server');

for(const token of ['passDuelOverlay','passShowHandoff','projectDuelState(passDuel.state,passDuel.viewer','applyLocalDuelMove','passDuelMove','publicMoveHistory=[];recentInteractions=[]'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRemote','duelDirectJoin'])assert.ok(lobby.includes(`id="${id}"`),`Duel hub missing ${id}`);
assert.ok(!lobby.includes('id="duelDirectScanInvite"'),'Nearby one-scan flow must not expose an in-app first-scan button');
assert.ok(!lobby.includes('id="duelDirectServerInput"'),'Nearby must not ask the player for a pairing backend URL');
assert.ok(lobby.includes('Player 1 shows one QR'),'Nearby card must explain the single-scan flow');
assert.ok(lobby.includes('Alpha relay fallback'),'Direct UI must disclose the staging TURN relay fallback');
assert.ok(lobby.includes('Direct Duel is intended for trusted opponents'),'Direct Duel trust model must be visible in Alpha UI');

for(const [name,source] of [['direct',direct],['nearby',nearby],['turn',turn],['pass',pass],['router',router]]){
  try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}
}
console.log('PASS Direct Duel + one-scan Nearby + Alpha TURN fallback + Pass & Play contracts');
