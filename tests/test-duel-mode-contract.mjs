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
const flow=read('src/js/25-gameplay-flow.js');
const learner=read('src/js/26-learner-ux.js');
const postmatchCss=read('src/styles/53-duel-postmatch.css');
const testerCss=read('src/styles/54-duel-alpha-tester.css');
const easyCss=read('src/styles/55-easy-learning.css');
const flowCss=read('src/styles/56-gameplay-flow.css');
const learnerCss=read('src/styles/57-learner-ux.css');
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

assert.ok(tester.includes("const ALPHA_TESTER_VERSION='0.16.7'"),'tester diagnostics must report 0.16.7');
for(const token of ['function alphaTesterInfo()','function alphaConnectionHelp()','function alphaReportProblem()'])assert.ok(tester.includes(token),`tester utility missing ${token}`);
assert.ok(!tester.includes('location.hash'),'tester diagnostics must never copy the live invite hash');
for(const token of ['.alphaTesterNotice','.alphaTesterBar','.alphaTesterModal'])assert.ok(testerCss.includes(token),`tester CSS missing ${token}`);

for(const token of [
  "const EASY_LEARNING_PACING={combatNew:3800,combat:2800,combatChainNew:3300,combatChain:2400,specialNew:3200,special:2200,lockNew:2400,lock:1500,chain:750,aiBreath:650}",
  "function easyLearningMode(){return matchMode==='arcade'&&aiDifficulty==='easy'}",
  'function easyLearningAutoActive()','function easyLearningActive()','function easyLearningPaced()',
  'Learn as you play','Guided Tips','function easyLearningNeedsLesson(e)','function easyLearningPulseBoard('
])assert.ok(easy.includes(token),`Easy learning contract missing ${token}`);
for(const forbidden of ['aiKnow','projectedScore','chooseAi','bestMove','strategistSearch','minimax'])assert.ok(!easy.includes(forbidden),`Easy coach must not inspect/score hidden strategy: ${forbidden}`);
assert.ok(!easy.includes("easyLearningPulse('#board .cell[data-column][tabindex=\"0\"]"),'piece selection must not visually expose top-row accessibility targets');

for(const token of [
  "const GAMEPLAY_FLOW_VERSION='0.16.7'",'function gameplayFlowBoardCenter()',"--c4-board-center-x",'--c4-board-center-y',
  'const EASY_AI_POST_DROP_MS=850','const LEARNING_AI_POST_DROP_MS=1150','function gameplayFlowAiSettleMs()',
  'const continueTurnControllerBeforeGameplayFlow=continueTurnController',"gameplayFlowMarkPhase('ai-settle')","scheduleTimer('aiSettle'"
])assert.ok(flow.includes(token),`gameplay flow module missing ${token}`);
for(const token of ['left:var(--c4-board-center-x,50%)','top:var(--c4-board-center-y,50%)','transform:translate(-50%,-50%)','#board.easyLearningBoardCue'])assert.ok(flowCss.includes(token),`gameplay flow CSS missing ${token}`);

// Learn as You Play is intentionally slower than normal Easy and exposes a Skip control
// only during a first-time learning explanation. Normal Easy never gets the Skip UI.
for(const token of [
  "const LEARNER_UX_VERSION='0.16.6'","const LEARNER_PRE_REVEAL_MS=700","const LEARNER_EXPLANATION_MS=10000",
  'const LEARNER_PACING={combat:4600,combatChain:3800,special:4000,lock:3000}',
  'function learnerEnsureHomeButton()',"button.id='homeLearnButton'","button.className='homeLearn homeCustomize'",'<span>Learn to Play</span><small>Easy · guided learning · start now</small>',
  'function learnerQuickStart()','easyLearningEnabled=true','if(!guideEnabled){guideEnabled=true',"aiDifficulty='easy'","colorMode='default'","beginRandomMatch('Learn to Play',{useDefaults:false})",
  'const easyLearningPlaceCoachBeforeLearnerUx=easyLearningPlaceCoach','humanZone.insertBefore(coach,humanPanel)',
  'function learnerConciseCoachCopy(',"['CHECK THE BOARD','Your 4 → their 4 → then R/P/S.']",'const easyLearningSetCoachBeforeLearnerUx=easyLearningSetCoach',
  'const eventDurationBeforeLearnerUx=eventDuration','if(!easyLearningAutoActive())return base','LEARNER_PACING.combat',
  'function learnerSkipBar(next,event)',"document.body.classList.add('learning-awaiting-continue')",'>Skip</button>',
  'const playEventsBeforeLearnerUx=playEvents','const needsExtraRead=easyLearningAutoActive()&&list.some(e=>easyLearningNeedsLesson(e))',"scheduleTimer('learnerPreReveal'"
])assert.ok(learner.includes(token),`learner UX contract missing ${token}`);
assert.ok(!learner.includes('>Got it</button>'),'learner explanation should auto-advance slowly and offer Skip, not require acknowledgment');
for(const token of [
  '.homeActions .homeLearn.homeCustomize','.learning-awaiting-continue .overlay','.learnerContinueBar','.learnerContinueButton',
  '#easyLearningCoach .easyCoachCopy::before','.easy-learning-active .mobileContextTray{display:none!important}',
  '.panel.ai .row>div:first-child','#aiColorLabel{display:inline-flex!important',
  '.panel.ai .row{display:grid!important;grid-template-columns:minmax(0,1fr)!important',
  '.panel.ai .aiStatusMeta{width:100%;min-width:0;display:grid!important;grid-template-columns:minmax(0,1fr) auto auto'
])assert.ok(learnerCss.includes(token),`learner UX CSS missing ${token}`);
for(const [name,source] of [['direct',direct],['nearby',nearby],['turn',turn],['colors',colors],['postmatch',postmatch],['tester',tester],['easy',easy],['flow',flow],['learner',learner],['pass',pass],['router',router]]){
  try{new Function(source)}catch(error){throw new Error(`${name} module syntax failed: ${error.message}`)}
}
for(const token of ['passDuelOverlay','passShowHandoff','passDuelMove'])assert.ok(pass.includes(token),`Pass & Play contract missing ${token}`);
for(const token of ['if(passDuel.active)','if(directDuel.active)','return duelMove(owner,type,column)'])assert.ok(router.includes(token),`transport router missing ${token}`);
for(const id of ['duelDirectMode','duelPassMode','duelOnlineMode','duelDirectNearby','duelDirectRefreshInvite','duelDirectRetryConnection','alphaTesterBar'])assert.ok(lobby.includes(`id="${id}"`),`Alpha lobby missing ${id}`);

console.log('PASS Multiplayer Alpha 0.16.7: slower post-AI settle + separated opponent HUD + skippable learner explanations + Direct recovery/share');