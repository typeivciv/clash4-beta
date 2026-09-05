import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicIndex=fs.readFileSync('index.html','utf8');
const alpha=fs.readFileSync('private-duel-alpha.html','utf8');
const testerAlpha=fs.readFileSync('multiplayer-alpha.html','utf8');

assert.ok(publicIndex.includes('<title>Clash 4 — Mobile Beta 0.13.3</title>'),'public index must remain frozen on 0.13.3');
assert.ok(!publicIndex.includes('id="homeDuelButton"'),'public beta must not expose unfinished Multiplayer Alpha UI');
assert.equal(testerAlpha,alpha,'clean multiplayer-alpha.html tester entry must exactly match canonical Alpha build');

for(const required of [
  'Multiplayer Alpha 0.16.3','<span>Multiplayer</span><small>Invite a player · Pass &amp; Play · Alpha test</small>','Play With Someone','Create Duel','Hosted Room',
  'RTCPeerConnection',"DIRECT_PEER_JOIN_PARAM='c4peer'",'DIRECT_HOST_INVITE_TTL_MS=5*60_000','function directRetryNearbyConnection()',"copyBtn.textContent='Copy Link'","shareBtn.textContent='Share Link'",'DIRECT_ALPHA_TURN_SERVERS',
  "endText.textContent='YOU WIN'","endText.textContent='TRY AGAIN'","b.textContent='Invite New Player'",'@keyframes duel-win-title','@keyframes duel-loss-title',
  "const ALPHA_TESTER_VERSION='0.16.3'",'function alphaTesterInfo()','function alphaConnectionHelp()',
  "const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1'",'Learn while you play','Forgiving AI · learns while you play','GET 4 IN A ROW','1 · Pick a piece','2 · Tap a column','function easyLearningShowMe()','function easyLearningCombatLesson(e)','Rock–Paper–Scissors','Decoys do not fight. Both pieces stay, and the chain stops.','function easyLearningSpecialLesson(e)',"combatHistoryMode=function(){return easyLearningActive()?'recent':combatHistoryModeBeforeEasyLearning()}",
  '#easyLearningCoach.easyLearningCoach','.easyRpsCompass','.easyLearningPulse','.easyCombatLesson','.easy-learning-active #message{display:none!important}',
  'function startPassPlay()','function duelRouteMove(owner,type,column)','peerjs@1.5.5/dist/peerjs.min.js','bindPrivateDuelUi();'
])assert.ok(alpha.includes(required),`generated Multiplayer Alpha missing: ${required}`);

for(const obsolete of ['DIRECT_PEER_TIMEOUT_MS=90_000','DIRECT_RETURN_KEY','directShowReturnLinkLanding','/api/direct/signals','id="duelDirectServerInput"',"endText.textContent='YOU LOSE'","b.textContent='New Duel'","b.textContent='Play Someone Else'","title.includes('Scan once to join')",'directNearbyRetryPeerId=hostPeerId;directOpenPanel()'])assert.ok(!alpha.includes(obsolete),`generated Alpha still contains obsolete/broken path: ${obsolete}`);

const ids=[...alpha.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicates,[],`duplicate DOM ids: ${duplicates.join(', ')}`);
const scripts=[...alpha.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>=4,'expected dependencies plus generated application script');
for(let i=0;i<scripts.length;i++){if(!scripts[i].trim())continue;try{new Function(scripts[i])}catch(error){throw new Error(`generated script ${i+1} failed syntax: ${error.message}`)}}
console.log(`PASS generated Multiplayer Alpha 0.16.3 learnability tester package (${ids.length} unique DOM ids, ${scripts.length} script blocks)`);
