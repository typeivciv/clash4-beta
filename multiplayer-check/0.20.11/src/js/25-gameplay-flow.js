// Multiplayer Alpha 0.16.8: board-centered combat, readable captures, and deliberate Easy turn handoff.
'use strict';
const GAMEPLAY_FLOW_VERSION='0.16.8';
const EASY_AI_POST_DROP_MS=850;
const LEARNING_AI_POST_DROP_MS=1150;
const EASY_AI_POST_COMBAT_MS=350;
const LEARNING_AI_POST_COMBAT_MS=550;
const EASY_CAPTURE_HOLD_MS=950;
const LEARNING_CAPTURE_HOLD_MS=1350;
const EASY_CHAIN_CAPTURE_HOLD_MS=700;
const LEARNING_CHAIN_CAPTURE_HOLD_MS=950;
let gameplayFlowSettleToken=0;
let gameplayFlowCaptureToken=0;

function gameplayFlowBoardCenter(){
  try{
    const boardEl=document.getElementById('board')||board;
    const overlayEl=document.getElementById('overlay')||overlay;
    if(!boardEl||!overlayEl)return;
    const rect=boardEl.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    overlayEl.style.setProperty('--c4-board-center-x',Math.round(rect.left+rect.width/2)+'px');
    overlayEl.style.setProperty('--c4-board-center-y',Math.round(rect.top+rect.height/2)+'px');
    overlayEl.style.setProperty('--c4-board-width',Math.round(rect.width)+'px');
  }catch{}
}

function gameplayFlowMarkPhase(phase){
  try{document.body.dataset.gameplayFlow=phase||''}catch{}
}

function gameplayFlowAiSettleMs(){
  try{
    if(typeof easyLearningMode!=='function'||!easyLearningMode())return 0;
    if(!s||s.lastMove?.owner!==A||s.turn!==H||s.winner||s.draw)return 0;
    const learning=typeof easyLearningAutoActive==='function'&&easyLearningAutoActive();
    if(s.lastMove?.hadCombat)return learning?LEARNING_AI_POST_COMBAT_MS:EASY_AI_POST_COMBAT_MS;
    return learning?LEARNING_AI_POST_DROP_MS:EASY_AI_POST_DROP_MS
  }catch{return 0}
}

function gameplayFlowCaptureHoldMs(e){
  try{
    if(typeof easyLearningMode!=='function'||!easyLearningMode())return 0;
    if(e?.kind!=='combat'||e.decoyContact||e.o==='tie')return 0;
    const learning=typeof easyLearningAutoActive==='function'&&easyLearningAutoActive();
    const chained=(e.chainTotal||0)>1&&(e.chainIndex||1)>1;
    if(chained)return learning?LEARNING_CHAIN_CAPTURE_HOLD_MS:EASY_CHAIN_CAPTURE_HOLD_MS;
    return learning?LEARNING_CAPTURE_HOLD_MS:EASY_CAPTURE_HOLD_MS
  }catch{return 0}
}

function gameplayFlowStageCapture(e){
  const hold=gameplayFlowCaptureHoldMs(e);
  if(!hold)return;
  const card=document.getElementById('overlayCard')||overlayCard;
  if(!card?.classList.contains('teachingCombatCard'))return;
  const token=++gameplayFlowCaptureToken;
  card.classList.remove('capture-resolved');
  card.classList.add('capture-staging');
  gameplayFlowMarkPhase('capture-read');
  scheduleTimer('captureResolve',()=>{
    if(token!==gameplayFlowCaptureToken||activePresentation?.event!==e)return;
    card.classList.remove('capture-staging');
    card.classList.add('capture-resolved');
    gameplayFlowMarkPhase('capture-resolve')
  },hold)
}

// The base transaction changes the state to the player's turn as soon as the AI move
// finishes presenting. Easy adds one deliberate board-reading beat before the controls
// reactivate. Learning mode gets a little more time; other modes are unchanged.
const continueTurnControllerBeforeGameplayFlow=continueTurnController;
continueTurnController=function(){
  const settleMs=gameplayFlowAiSettleMs();
  if(!settleMs)return continueTurnControllerBeforeGameplayFlow();
  const token=++gameplayFlowSettleToken;
  busy=true;
  gameplayFlowMarkPhase('ai-settle');
  scheduleTimer('aiSettle',()=>{
    if(token!==gameplayFlowSettleToken)return;
    busy=false;
    gameplayFlowMarkPhase('handoff');
    continueTurnControllerBeforeGameplayFlow()
  },settleMs)
};

const showEventBeforeGameplayFlow=showEvent;
showEvent=function(e){
  gameplayFlowBoardCenter();
  gameplayFlowMarkPhase(e?.kind==='combat'?'combat':'special');
  const result=showEventBeforeGameplayFlow(e);
  gameplayFlowStageCapture(e);
  requestAnimationFrame(gameplayFlowBoardCenter);
  return result
};

const playEventsBeforeGameplayFlow=playEvents;
playEvents=function(events,done,column=null){
  gameplayFlowMarkPhase(events?.length?'resolving':'handoff');
  return playEventsBeforeGameplayFlow(events,()=>{
    gameplayFlowMarkPhase('handoff');
    requestAnimationFrame(gameplayFlowBoardCenter);
    done()
  },column)
};

const renderBeforeGameplayFlow=render;
render=function(){
  const result=renderBeforeGameplayFlow();
  requestAnimationFrame(gameplayFlowBoardCenter);
  return result
};

window.addEventListener('resize',()=>requestAnimationFrame(gameplayFlowBoardCenter),{passive:true});
try{new ResizeObserver(()=>requestAnimationFrame(gameplayFlowBoardCenter)).observe(document.getElementById('board')||board)}catch{}
requestAnimationFrame(gameplayFlowBoardCenter);

globalThis.gameplayFlowBoardCenter=gameplayFlowBoardCenter;
globalThis.gameplayFlowAiSettleMs=gameplayFlowAiSettleMs;
globalThis.gameplayFlowCaptureHoldMs=gameplayFlowCaptureHoldMs;
globalThis.GAMEPLAY_FLOW_VERSION=GAMEPLAY_FLOW_VERSION;