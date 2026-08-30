import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicIndex=fs.readFileSync('index.html','utf8');
const alpha=fs.readFileSync('private-duel-alpha.html','utf8');

assert.ok(publicIndex.includes('<title>Clash 4 — Mobile Beta 0.13.3</title>'),'public index must remain frozen on 0.13.3');
assert.ok(!publicIndex.includes('id="homeDuelButton"'),'public beta must not expose unfinished Duel UI');

for(const required of [
  'Duel Modes Alpha 0.15.1',
  'id="homeDuelButton"',
  'id="duelLobbyPanel"',
  'id="duelDirectMode"',
  'id="duelPassMode"',
  'id="duelOnlineMode"',
  'id="opponentEyebrow"',
  'function opponentUiLabel()',
  "if(matchMode==='duel')return duelRouteMove(owner,type,c);",
  '?since=${duelSession.handledVersion}',
  'if(p.historyGap){duelResyncSnapshot(p);return}',
  'RTCPeerConnection',
  "createDataChannel('clash4-duel'",
  'function directCreateNearby()',
  "DIRECT_JOIN_PARAM='c4join'",
  "directSignalRequest(server,'/api/direct/signals'",
  'No return QR is required.',
  'normal Camera app',
  'directBootNearbySignalUx();',
  'function startPassPlay()',
  'function duelRouteMove(owner,type,column)',
  'qrcodejs@1.0.0/qrcode.min.js',
  'jsqr@1.4.0/dist/jsQR.js',
  'bindPrivateDuelUi();',
  "const replayDisabled=duelMode||!finishReplay?.steps?.length||replayPhase!=='idle';"
])assert.ok(alpha.includes(required),`generated Alpha missing: ${required}`);

for(const obsolete of ['DIRECT_RETURN_KEY','directShowReturnLinkLanding','2 · Scan Player 2 Return QR']){
  assert.ok(!alpha.includes(obsolete),`generated Alpha still contains obsolete return-QR path: ${obsolete}`)
}

const ids=[...alpha.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicates,[],`duplicate DOM ids: ${duplicates.join(', ')}`);

const scripts=[...alpha.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>=3,'expected QR dependencies plus generated application script');
for(let i=0;i<scripts.length;i++){
  if(!scripts[i].trim())continue;
  try{new Function(scripts[i])}
  catch(error){throw new Error(`generated script ${i+1} failed syntax: ${error.message}`)}
}

console.log(`PASS generated Duel Modes Alpha 0.15.1 build (${ids.length} unique DOM ids, ${scripts.length} script blocks)`);
