import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicIndex=fs.readFileSync('index.html','utf8');
const alpha=fs.readFileSync('private-duel-alpha.html','utf8');
const testerAlpha=fs.readFileSync('multiplayer-alpha.html','utf8');

assert.ok(publicIndex.includes('<title>Clash 4 — Mobile Beta 0.13.3</title>'),'public index must remain frozen on 0.13.3');
assert.ok(!publicIndex.includes('id="homeDuelButton"'),'public beta must not expose unfinished Multiplayer Alpha UI');
assert.equal(testerAlpha,alpha,'clean multiplayer-alpha.html tester entry must exactly match canonical Alpha build');

for(const required of [
  'Multiplayer Alpha 0.16.7','<span>Multiplayer</span><small>Invite a player · Pass &amp; Play · Alpha test</small>','Play With Someone','Create Duel','Hosted Room',
  'RTCPeerConnection',"DIRECT_PEER_JOIN_PARAM='c4peer'",'DIRECT_HOST_INVITE_TTL_MS=5*60_000','function directRetryNearbyConnection()',"copyBtn.textContent='Copy Link'","shareBtn.textContent='Share Link'",'DIRECT_ALPHA_TURN_SERVERS',
  "endText.textContent='YOU WIN'","endText.textContent='TRY AGAIN'","b.textContent='Invite New Player'",
  "const ALPHA_TESTER_VERSION='0.16.7'","const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1'","const GAMEPLAY_FLOW_VERSION='0.16.7'","const LEARNER_UX_VERSION='0.16.6'",
  'const EASY_AI_POST_DROP_MS=850','const LEARNING_AI_POST_DROP_MS=1150','function gameplayFlowAiSettleMs()',"scheduleTimer('aiSettle'",
  "const LEARNER_PRE_REVEAL_MS=700","const LEARNER_EXPLANATION_MS=10000",'const LEARNER_PACING={combat:4600,combatChain:3800,special:4000,lock:3000}',
  '<span>Learn to Play</span><small>Easy · guided learning · start now</small>',"button.className='homeLearn homeCustomize'",'function learnerQuickStart()',"beginRandomMatch('Learn to Play',{useDefaults:false})",'>Skip</button>',
  '.homeActions .homeLearn.homeCustomize','.learning-awaiting-continue .overlay','.learnerContinueButton','#easyLearningCoach .easyCoachCopy::before','.easy-learning-active .mobileContextTray{display:none!important}',
  '.panel.ai .row{display:grid!important;grid-template-columns:minmax(0,1fr)!important','.panel.ai .aiStatusMeta{width:100%;min-width:0;display:grid!important;grid-template-columns:minmax(0,1fr) auto auto',
  '#aiColorLabel{display:inline-flex!important','function gameplayFlowBoardCenter()','--c4-board-center-x','#board.easyLearningBoardCue',
  'function startPassPlay()','function duelRouteMove(owner,type,column)','peerjs@1.5.5/dist/peerjs.min.js','bindPrivateDuelUi();'
])assert.ok(alpha.includes(required),`generated Multiplayer Alpha missing: ${required}`);

for(const obsolete of [
  'Multiplayer Alpha 0.16.4','Multiplayer Alpha 0.16.6</title>','DIRECT_PEER_TIMEOUT_MS=90_000','DIRECT_RETURN_KEY','directShowReturnLinkLanding','/api/direct/signals','id="duelDirectServerInput"',
  "endText.textContent='YOU LOSE'","b.textContent='New Duel'","b.textContent='Play Someone Else'","title.includes('Scan once to join')",'directNearbyRetryPeerId=hostPeerId;directOpenPanel()',
  "easyLearningPulse('#board .cell[data-column][tabindex=\"0\"]",'>Got it</button>'
])assert.ok(!alpha.includes(obsolete),`generated Alpha still contains obsolete/broken path: ${obsolete}`);

const ids=[...alpha.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicates,[],`duplicate DOM ids: ${duplicates.join(', ')}`);
const scripts=[...alpha.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>=4,'expected dependencies plus generated application script');
for(let i=0;i<scripts.length;i++){if(!scripts[i].trim())continue;try{new Function(scripts[i])}catch(error){throw new Error(`generated script ${i+1} failed syntax: ${error.message}`)}}
console.log(`PASS generated Multiplayer Alpha 0.16.7 post-AI settle package (${ids.length} unique DOM ids, ${scripts.length} script blocks)`);