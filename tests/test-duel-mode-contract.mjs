import assert from 'node:assert/strict';
import fs from 'node:fs';

const direct=fs.readFileSync('src/js/16-duel-direct-webrtc.js','utf8');
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
  'directScanSignal',
  'BarcodeDetector',
  'globalThis.jsQR',
  'directAuthorityMove',
  'localDuelPayload'
])assert.ok(direct.includes(token),`Direct Duel contract missing ${token}`);
assert.ok(!direct.includes("fetch("),'Direct Duel transport must not call the Clash 4 HTTP server');

for(const token of ['passDuelOverlay','passShowHandoff','projectDuelState(passDuel.state,passDuel.viewer','applyLocalDuelMove','passDuelMove'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRemote','duelDirectScanInvite','duelDirectJoin'])assert.ok(lobby.includes(`id="${id}"`),`Duel hub missing ${id}`);

for(const [name,source] of [['direct',direct],['pass',pass],['router',router]]){
  try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}
}
console.log('PASS Direct Duel + Pass & Play transport contracts');
