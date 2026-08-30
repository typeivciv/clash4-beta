// Duel 0.15.7: robust post-match routing + replay + animated win/loss/draw presentation.
'use strict';
let duelResultAnimationKey='';

function duelPostMatchEnsureVisual(){
  const card=globalThis.end?.querySelector?.('.postMatchSummaryCard');
  if(!card)return null;
  let stage=document.getElementById('duelResultAnimation');
  if(stage)return stage;
  stage=document.createElement('div');stage.id='duelResultAnimation';stage.className='duelResultAnimation';stage.hidden=true;stage.setAttribute('aria-hidden','true');
  stage.innerHTML='<div class="duelResultHalo"></div><div class="duelResultCore"><span>✦</span></div><div class="duelResultSparks">'+Array.from({length:10},(_,i)=>`<i style="--spark:${i}"></i>`).join('')+'</div>';
  card.prepend(stage);return stage
}
function duelPostMatchOutcome(){return s.draw?'draw':s.winner===H?'win':'loss'}
function duelPostMatchCopy(outcome){
  if(outcome==='win'){
    endText.textContent='YOU WIN';
    endReason.textContent=s.winReason==='clashmate'?'CLASHMATE · You forced the winning position.':'Victory secured · Your Connect Four is locked in.'
  }else if(outcome==='loss'){
    endText.textContent='YOU LOSE';
    endReason.textContent='TRY AGAIN · Review the finish or start a New Duel.'
  }else{
    endText.textContent='DRAW';
    endReason.textContent='No winner this time · Review the board or try again.'
  }
}
function duelPostMatchAnimate(){
  const stage=duelPostMatchEnsureVisual();if(!stage)return;
  const visible=matchMode==='duel'&&(s.winner||s.draw)&&postMatchView==='summary'&&!busy;
  if(!visible){stage.hidden=true;end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter');duelResultAnimationKey='';return}
  const outcome=duelPostMatchOutcome(),key=`${s.moveNumber}:${outcome}:${s.winReason||''}`;
  duelPostMatchCopy(outcome);stage.hidden=false;
  end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw');end.classList.add(`duel-result-${outcome}`);
  const core=stage.querySelector('.duelResultCore span');if(core)core.textContent=outcome==='win'?'✦':outcome==='loss'?'◆':'＝';
  const kicker=end.querySelector('.postMatchDeckKicker');if(kicker)kicker.textContent=outcome==='win'?'DUEL VICTORY':outcome==='loss'?'DUEL DEFEAT':'DUEL DRAW';
  if(key===duelResultAnimationKey)return;
  duelResultAnimationKey=key;end.classList.remove('duel-result-enter');stage.classList.remove('play');void stage.offsetWidth;end.classList.add('duel-result-enter');stage.classList.add('play');
  if(outcome==='win'){try{gameHaptic?.('win')}catch{}}
}
function duelPostMatchReplayControls(){
  if(matchMode!=='duel')return;
  const disabled=!finishReplay?.steps?.length||replayPhase!=='idle';
  for(const button of [replayFinishButton,replayFinishReviewButton,sidebarReplayFinish]){
    button.disabled=disabled;button.hidden=false;button.textContent=replayPhase!=='idle'?'Replaying…':'Replay Finish'
  }
}

// The shared network adapter already records the final two viewer-projected interactions.
// Preserve them at terminal instead of the older Alpha behavior that intentionally nulled replay.
duelFinishNetworkPresentation=function(events,column){
  const done=()=>{
    busy=false;
    const deferred=nextDeferredDuelPayload();
    if(deferred){duelAcceptActivePayload(deferred);return}
    if(s.winner||s.draw){
      duelStopPolling();postMatchView='summary';
      finishReplay={steps:recentInteractions.slice(-2).map(cloneInteractionForReplay)};
      render();return
    }
    continueTurnController()
  };
  if(events.length)playEvents(events,done,column);else done()
};

const renderPostMatchBeforeDuelResult=renderPostMatch;
renderPostMatch=function(reviewMode){
  const result=renderPostMatchBeforeDuelResult(reviewMode);
  duelPostMatchReplayControls();duelPostMatchAnimate();return result
};

// Capture post-match New Duel before the legacy Arcade Rematch listeners.
// The router now performs an atomic terminal-state reset and re-opens the Duel overlay.
document.addEventListener('click',event=>{
  if(matchMode!=='duel')return;
  const button=event.target?.closest?.('#restartBottom,#reviewRestart,#sidebarRematch');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();globalThis.duelRouteNewDuel?.()
},true);

duelPostMatchEnsureVisual();
