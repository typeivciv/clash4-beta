// Multiplayer Alpha 0.16.5: board-centered combat presentation and flow instrumentation.
'use strict';
const GAMEPLAY_FLOW_VERSION='0.16.5';

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

const showEventBeforeGameplayFlow=showEvent;
showEvent=function(e){
  gameplayFlowBoardCenter();
  gameplayFlowMarkPhase(e?.kind==='combat'?'combat':'special');
  const result=showEventBeforeGameplayFlow(e);
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
globalThis.GAMEPLAY_FLOW_VERSION=GAMEPLAY_FLOW_VERSION;
