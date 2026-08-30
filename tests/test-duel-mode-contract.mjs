import assert from 'node:assert/strict';
import fs from 'node:fs';

const direct=fs.readFileSync('src/js/16-duel-direct-webrtc.js','utf8');
const nearby=fs.readFileSync('src/js/19-duel-nearby-qr.js','utf8');
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
  "directJoinSignal(value,'nearby')",
  "directJoinSignal(value,'remote')",
  'directClosePeer();duelStopPolling();duelClearActiveSession()',
  'duelCopyCode.hidden=true',
  'directScanSignal',
  'BarcodeDetector',
  'globalThis.jsQR',
  'directAuthorityMove',
  'localDuelPayload'
])assert.ok(direct.includes(token),`Direct Duel contract missing ${token}`);
assert.ok(!direct.includes('fetch('),'Direct Duel transport must not call the Clash 4 HTTP server');

for(const token of [
  "DIRECT_LINK_PARAM='c4direct'",
  'function directNearbyLink(signal)',
  'location.origin}${location.pathname}#${DIRECT_LINK_PARAM}=',
  "if(parsed.kind==='offer'){await directJoinSignal(signal,'nearby')",
  "if(parsed.kind==='answer'){directShowReturnLinkLanding(signal)",
  'BroadcastChannel',
  'DIRECT_RETURN_KEY',
  'directTryBridgedAnswer',
  'Player 2: use your normal Camera app.',
  '2 · Scan Player 2 Return QR',
  'directBootNearbyQrUx();'
])assert.ok(nearby.includes(token),`Nearby QR contract missing ${token}`);
assert.ok(!nearby.includes('fetch('),'Nearby QR helper must not introduce a signaling/game server');

for(const token of ['passDuelOverlay','passShowHandoff','projectDuelState(passDuel.state,passDuel.viewer','applyLocalDuelMove','passDuelMove','publicMoveHistory=[];recentInteractions=[]'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRemote','duelDirectScanInvite','duelDirectJoin'])assert.ok(lobby.includes(`id="${id}"`),`Duel hub missing ${id}`);
assert.ok(lobby.includes('Direct Duel is intended for trusted opponents'),'Direct Duel trust model must be visible in Alpha UI');

for(const [name,source] of [['direct',direct],['nearby',nearby],['pass',pass],['router',router]]){
  try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}
}
console.log('PASS Direct Duel + Nearby QR + Pass & Play transport contracts');
