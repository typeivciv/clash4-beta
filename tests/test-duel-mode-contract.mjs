import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const direct=read('src/js/16-duel-direct-webrtc.js');
const nearby=read('src/js/19-duel-nearby-qr.js');
const turn=read('src/js/20-duel-turn-alpha.js');
const colors=read('src/js/21-duel-colors-share.js');
const postmatch=read('src/js/22-duel-postmatch.js');
const tester=read('src/js/23-duel-alpha-tester.js');
const easy=read('src/js/24-easy-learning.js');
const postmatchCss=read('src/styles/53-duel-postmatch.css');
const testerCss=read('src/styles/54-duel-alpha-tester.css');
const easyCss=read('src/styles/55-easy-learning.css');
const pass=read('src/js/17-duel-pass-play.js');
const router=read('src/js/18-duel-router.js');
const lobby=read('src/ui/private-duel-lobby.html');

for(const token of ['RTCPeerConnection',"createDataChannel('clash4-duel',{ordered:true})",'directAuthorityMove','localDuelPayload'])assert.ok(direct.includes(token),`Direct Duel contract missing ${token}`);
assert.ok(!direct.includes('fetch('),'core Direct WebRTC transport must stay serverless');

for(const token of ["DIRECT_PEER_JOIN_PARAM='c4peer'",'DIRECT_PEER_ATTEMPT_TIMEOUT_MS=90_000','DIRECT_HOST_INVITE_TTL_MS=5*60_000','function directRetryNearbyConnection()','function directRefreshNearbyInvite()','function directReleaseFailedConnection(','Player 2 can retry the same live invite'])assert.ok(nearby.includes(token),`Direct recovery contract missing ${token}`);
assert.ok(!nearby.includes('DIRECT_PEER_TIMEOUT_MS=90_000'),'host invite and guest attempt must keep separate timeouts');

for(const token of ['DIRECT_ALPHA_TURN_SERVERS','turn:openrelay.metered.ca:443?transport=tcp','Connected · relay fallback'])assert.ok(turn.includes(token),`TURN Alpha contract missing ${token}`);
for(const token of ['function duelHasLiveNearbyInvite()',"copyBtn.textContent='Copy Link'","shareBtn.textContent='Share Link'",'duelApplySeatColors()'])assert.ok(colors.includes(token),`Direct share/color contract missing ${token}`);
assert.ok(!colors.includes("title.includes('Scan once to join')"),'share controls must never depend on mutable heading copy');

for(const token of ["endText.textContent='YOU WIN'","endText.textContent='TRY AGAIN'","b.textContent='Invite New Player'",'matchmaking is not available yet',"kind:'rematch-request'","kind:'rematch-start'"])assert.ok(postmatch.includes(token),`post-match contract missing ${token}`);
assert.ok(!postmatch.includes("endText.textContent='YOU LOSE'"),'loss headline must remain TRY AGAIN');
for(const token of ['text-align:center','@keyframes duel-win-title','@keyframes duel-loss-title','@keyframes duel-win-rays','@keyframes duel-loss-card'])assert.ok(postmatchCss.includes(token),`post-match visual contract missing ${token}`);

assert.ok(tester.includes("const ALPHA_TESTER_VERSION='0.16.4'"),'tester diagnostics must report 0.16.4');
for(const token of ['function alphaTesterInfo()','function alphaConnectionHelp()','function alphaReportProblem()'])assert.ok(tester.includes(token),`tester utility missing ${token}`);
assert.ok(!tester.includes('location.hash'),'tester diagnostics must never copy the live invite hash');
for(const token of ['.alphaTesterNotice','.alphaTesterBar','.alphaTesterModal'])assert.ok(testerCss.includes(token),`tester CSS missing ${token}`);

// Easy is one learning system: automatic learn-as-you-play explanations plus optional
// Guided Tips. It may use public ownership patterns but never hidden identities/AI scoring.
for(const token of [
  "const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1'",
  "const EASY_LEARNING_PACING={combat:3600,combatChain:3200,special:2700,lock:1900,chain:900,aiBreath:900}",
  "function easyLearningActive(){return matchMode==='arcade'&&aiDifficulty==='easy'&&easyLearningEnabled}",
  'One learning system: automatic explanations, plus optional Guided Tips for extra reminders.',
  'Learn as you play','Guided Tips','easyLearningCombinedSetup','GET 4 IN A ROW','1 · Pick a piece','2 · Tap a column',
  'function easyLearningPlaceCoach()','humanZone.insertBefore(coach,humanPanel)',"coach.dataset.placement='player'",
  'function easyLearningShowMe()','function easyLearningCombatLesson(e)','Rock–Paper–Scissors','function easyLearningSpecialLesson(e)',
  'function easyLearningBasicsLearned()','function easyLearningGuideCopy()','if(guideEnabled){','function easyLearningThreeThreat(owner)',
  'const eventDurationBeforeEasyLearning=eventDuration','EASY_LEARNING_PACING.combat','EASY_LEARNING_PACING.special',
  'const startAiTurnBeforeEasyLearning=startAiTurn','await new Promise(resolve=>setTimeout(resolve,EASY_LEARNING_PACING.aiBreath))',
  "combatHistoryMode=function(){return easyLearningActive()?'recent':combatHistoryModeBeforeEasyLearning()}",
  'function easyLearningReset()','localStorage.setItem(EASY_LEARNING_STORAGE_KEY'
])assert.ok(easy.includes(token),`Easy learning contract missing ${token}`);
for(const forbidden of ['aiKnow','projectedScore','chooseAi','bestMove','strategistSearch','minimax'])assert.ok(!easy.includes(forbidden),`Easy coach must not inspect/score hidden strategy: ${forbidden}`);
assert.ok(easy.includes("cells.filter(p=>p?.owner===owner).length===3"),'three-in-a-row cue may use public ownership only');
assert.ok(!easy.includes('cells.filter(p=>p?.type'),'learnability cue must not inspect hidden piece identities');
for(const token of ['#easyLearningCoach.easyLearningCoach','.easyRpsCompass','.easyLearningPulse','.easyCombatLesson','.easy-learning-active #message{display:none!important}','.easyLearningCombinedSetup .guidedSetupControl{display:none!important}','#easyLearningCoach[data-placement="player"]','border-left:3px solid var(--blue)','@keyframes easy-learning-pulse'])assert.ok(easyCss.includes(token),`Easy learning CSS missing ${token}`);

for(const token of ['passDuelOverlay','passShowHandoff','passDuelMove'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRefreshInvite','duelDirectRetryConnection','alphaTesterBar'])assert.ok(lobby.includes(`id="${id}"`),`Alpha lobby missing ${id}`);

for(const [name,source] of [['direct',direct],['nearby',nearby],['turn',turn],['colors',colors],['postmatch',postmatch],['tester',tester],['easy',easy],['pass',pass],['router',router]]){
  try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}
}
console.log('PASS Multiplayer Alpha 0.16.4: paced player-anchored Easy learning + combined Guided Tips + no hidden-strategy leakage + Direct recovery/share + unified results');
