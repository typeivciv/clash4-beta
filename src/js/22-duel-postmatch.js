// Duel 0.15.6: robust post-match routing + animated win/loss/draw presentation.
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
function duelPostMatchAnimate(){
  const stage=duelPostMatchEnsureVisual();if(!stage)return;
  const visible=matchMode==='duel'&&(s.winner||s.draw)&&postMatchView==='summary'&&!busy;
  if(!visible){stage.hidden=true;end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter');duelResultAnimationKey='';return}
  const outcome=duelPostMatchOutcome(),key=`${s.moveNumber}:${outcome}:${s.winReason||''}`;
  stage.hidden=false;
  end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw');end.classList.add(`duel-result-${outcome}`);
  const core=stage.querySelector('.duelResultCore span');if(core)core.textContent=outcome==='win'?'✦':outcome==='loss'?'◆':'＝';
  const kicker=end.querySelector('.postMatchDeckKicker');if(kicker)kicker.textContent=outcome==='win'?'DUEL VICTORY':outcome==='loss'?'DUEL DEFEAT':'DUEL DRAW';
  if(key===duelResultAnimationKey)return;
  duelResultAnimationKey=key;end.classList.remove('duel-result-enter');stage.classList.remove('play');void stage.offsetWidth;end.classList.add('duel-result-enter');stage.classList.add('play');
  if(outcome==='win'){try{gameHaptic?.('win')}catch{}}
}

const renderPostMatchBeforeDuelResult=renderPostMatch;
renderPostMatch=function(reviewMode){const result=renderPostMatchBeforeDuelResult(reviewMode);duelPostMatchAnimate();return result};

// Capture the three post-match New Duel buttons before the legacy Rematch listeners.
// This keeps Direct connection teardown and Duel hub routing deterministic.
document.addEventListener('click',event=>{
  if(matchMode!=='duel')return;
  const button=event.target?.closest?.('#restartBottom,#reviewRestart,#sidebarRematch');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  postMatchView='none';replayPhase='idle';replayVisualState=null;replayStepIndex=-1;dropPresentation=null;busy=false;ready=false;
  end.classList.remove('show','duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter');
  globalThis.duelRouteNewDuel?.()
},true);

duelPostMatchEnsureVisual();
