import assert from 'node:assert/strict';
import fs from 'node:fs';

const easy=fs.readFileSync('src/js/24-easy-learning.js','utf8');
const flow=fs.readFileSync('src/js/25-gameplay-flow.js','utf8');
const css=fs.readFileSync('src/styles/56-gameplay-flow.css','utf8');
const learnerCss=fs.readFileSync('src/styles/57-learner-ux.css','utf8');
const base=fs.readFileSync('index.html','utf8');

function numberFrom(source,re,label){const m=source.match(re);assert.ok(m,`missing timing ${label}`);return Number(m[1])}
const drop=numberFrom(base,/drop:(\d+)/,'drop');
const aiThink=numberFrom(base,/aiThink:(\d+)/,'aiThink');
const aiIntent=numberFrom(base,/aiIntent:(\d+)/,'aiIntent');
const combatNew=numberFrom(easy,/combatNew:(\d+)/,'combatNew');
const combat=numberFrom(easy,/combat:(\d+)/,'combat');
const combatChainNew=numberFrom(easy,/combatChainNew:(\d+)/,'combatChainNew');
const combatChain=numberFrom(easy,/combatChain:(\d+)/,'combatChain');
const specialNew=numberFrom(easy,/specialNew:(\d+)/,'specialNew');
const special=numberFrom(easy,/special:(\d+)/,'special');
const lockNew=numberFrom(easy,/lockNew:(\d+)/,'lockNew');
const lock=numberFrom(easy,/lock:(\d+)/,'lock');
const aiBreath=numberFrom(easy,/aiBreath:(\d+)/,'aiBreath');
const easyAiSettle=numberFrom(flow,/EASY_AI_POST_DROP_MS=(\d+)/,'EASY_AI_POST_DROP_MS');
const learningAiSettle=numberFrom(flow,/LEARNING_AI_POST_DROP_MS=(\d+)/,'LEARNING_AI_POST_DROP_MS');
const easyAiCombatSettle=numberFrom(flow,/EASY_AI_POST_COMBAT_MS=(\d+)/,'EASY_AI_POST_COMBAT_MS');
const learningAiCombatSettle=numberFrom(flow,/LEARNING_AI_POST_COMBAT_MS=(\d+)/,'LEARNING_AI_POST_COMBAT_MS');
const easyCaptureHold=numberFrom(flow,/EASY_CAPTURE_HOLD_MS=(\d+)/,'EASY_CAPTURE_HOLD_MS');
const learningCaptureHold=numberFrom(flow,/LEARNING_CAPTURE_HOLD_MS=(\d+)/,'LEARNING_CAPTURE_HOLD_MS');
const easyChainCaptureHold=numberFrom(flow,/EASY_CHAIN_CAPTURE_HOLD_MS=(\d+)/,'EASY_CHAIN_CAPTURE_HOLD_MS');
const learningChainCaptureHold=numberFrom(flow,/LEARNING_CHAIN_CAPTURE_HOLD_MS=(\d+)/,'LEARNING_CHAIN_CAPTURE_HOLD_MS');

// Repeated events should be readable without turning the whole match into a tutorial.
assert.ok(combat>=2500&&combat<=3100,`repeated Easy combat hold should be 2.5–3.1s, got ${combat}`);
assert.ok(combatNew>=3500&&combatNew<=4200,`first learning combat should get 3.5–4.2s, got ${combatNew}`);
assert.ok(combatChain<combat&&combatChainNew<combatNew,'follow-up chain clashes should move faster than the first clash in the chain');
assert.ok(special>=1800&&special<=2500,'repeated special-rule card should remain readable but shorter than first teaching');
assert.ok(specialNew>special,'first special-rule teaching must hold longer than repeat presentation');
assert.ok(lock>=1200&&lock<=1800,'routine Combat Lock acknowledgement should not stall the turn');
assert.ok(lockNew>lock,'first Combat Lock explanation needs additional reading time');

// Human drop -> AI response stays deliberate but does not drag.
const aiPreDrop=aiBreath+aiThink+aiIntent;
const routineHandoff=drop+aiPreDrop;
assert.ok(aiPreDrop>=1300&&aiPreDrop<=1900,`AI pre-drop handoff should be 1.3–1.9s, got ${aiPreDrop}`);
assert.ok(routineHandoff>=1800&&routineHandoff<=2500,`human drop → AI drop-start rhythm should be 1.8–2.5s, got ${routineHandoff}`);

// After the AI lands, Easy intentionally leaves the finished board on screen before
// reactivating the player. Learning mode gets the longest observation beat.
assert.ok(easyAiSettle>=700&&easyAiSettle<=1000,`normal Easy post-AI settle should be 0.7–1.0s, got ${easyAiSettle}`);
assert.ok(learningAiSettle>=1000&&learningAiSettle<=1400,`learning post-AI settle should be 1.0–1.4s, got ${learningAiSettle}`);
assert.ok(learningAiSettle>easyAiSettle,'learning mode must give more post-AI reading time than normal Easy');
assert.ok(easyAiCombatSettle<easyAiSettle&&learningAiCombatSettle<learningAiSettle,'a move that already showed a combat card needs only a shorter final settle');
assert.ok(learningAiCombatSettle>easyAiCombatSettle,'learning mode keeps a slightly longer post-combat settle too');

// A decisive capture is a two-stage visual in Easy: first both fighters are readable,
// then the loser resolves as captured. Chain follow-ups are quicker but still staged.
assert.ok(easyCaptureHold>=800&&easyCaptureHold<=1100,`normal Easy capture read should be 0.8–1.1s, got ${easyCaptureHold}`);
assert.ok(learningCaptureHold>=1200&&learningCaptureHold<=1600,`learning capture read should be 1.2–1.6s, got ${learningCaptureHold}`);
assert.ok(learningCaptureHold>easyCaptureHold,'learning mode must hold both fighters longer before capture resolves');
assert.ok(easyChainCaptureHold<easyCaptureHold&&learningChainCaptureHold<learningCaptureHold,'chain captures should preserve flow with a shorter staged hold');
assert.ok(learningChainCaptureHold>easyChainCaptureHold,'learning chain capture should remain more readable than normal Easy');

for(const token of [
  "const GAMEPLAY_FLOW_VERSION='0.16.8'",'function gameplayFlowBoardCenter()',"--c4-board-center-x",'requestAnimationFrame(gameplayFlowBoardCenter)',
  "gameplayFlowMarkPhase(e?.kind==='combat'?'combat':'special')",'function gameplayFlowAiSettleMs()',
  'function gameplayFlowCaptureHoldMs(e)','function gameplayFlowStageCapture(e)',"card.classList.add('capture-staging')","card.classList.add('capture-resolved')",
  'const continueTurnControllerBeforeGameplayFlow=continueTurnController',"gameplayFlowMarkPhase('ai-settle')","scheduleTimer('aiSettle'"
])assert.ok(flow.includes(token),`gameplay-flow anchor missing ${token}`);
for(const token of [
  'left:var(--c4-board-center-x,50%)','top:var(--c4-board-center-y,50%)','transform:translate(-50%,-50%)',
  'width:min(580px','font-size:56px','font-size:28px','font-size:16px','.easyCombatLesson span{font-size:14px',
  '.teachingCombatCard.capture-staging .fighter.loser','.teachingCombatCard.capture-resolved .fighter.loser','@keyframes c4-capture-resolve',"content:'CAPTURED'",
  '#board.easyLearningBoardCue','@keyframes c4-easy-board-cue'
])assert.ok(css.includes(token),`desktop combat readability contract missing ${token}`);

// Audited at the actual 292px desktop sidebar width: identity gets one row, stats get
// a separated row, the count becomes the strongest stat, and the duplicate turn dot is removed.
for(const token of [
  '.panel.ai .row>div:first-child{width:100%;justify-content:space-between!important',
  'grid-template-columns:minmax(0,1fr) auto!important',
  'border-top:1px solid rgba(83,102,138,.42)',
  '.panel.ai .aiRemaining .remainingNumber{min-width:auto!important;font-size:18px!important',
  '.panel.ai .aiRemaining>span:last-child{font-size:8px!important',
  '.panel.ai #aiTurn{display:none!important'
])assert.ok(learnerCss.includes(token),`audited desktop opponent HUD missing ${token}`);

// Selecting a piece must cue the board/drop action, not make the accessibility focus row
// look like a special game row.
assert.ok(easy.includes('function easyLearningPulseBoard('),'Easy guidance must have a board-level drop cue');
assert.ok(easy.includes('setTimeout(()=>easyLearningPulseBoard(1450),160)'),'piece selection must cue the board as a whole');
assert.ok(!easy.includes("easyLearningPulse('#board .cell[data-column][tabindex=\"0\"]"),'Easy guidance must not visually expose top-row accessibility targets');

// Guided Tips must tell the learner what public information to inspect, never calculate a move.
for(const copy of [
  'Before moving: check your line of four, check their line of four, then decide which R/P/S risk you want to take.',
  'You have three connected. Find the empty space that would complete four.',
  'The opponent has three connected. Find the empty space that could complete their four.'
])assert.ok(easy.includes(copy),`useful Guided Tip missing: ${copy}`);
for(const forbidden of ['aiKnow','projectedScore','bestMove','minimax','strategistSearch'])assert.ok(!easy.includes(forbidden),`learning guidance must not use hidden/AI strategy: ${forbidden}`);

for(const [name,source] of [['easy',easy],['flow',flow]]){try{new Function(source)}catch(error){throw new Error(`${name} syntax failed: ${error.message}`)}}
console.log(`PASS gameplay flow: AI→player Easy ${easyAiSettle}ms / learning ${learningAiSettle}ms; capture hold ${easyCaptureHold}ms / ${learningCaptureHold}ms; audited 292px HUD hierarchy`);