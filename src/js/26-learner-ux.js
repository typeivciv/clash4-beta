// Multiplayer Alpha 0.16.6: one-tap learner entry, compact coaching, and skippable reading time.
'use strict';
const LEARNER_UX_VERSION='0.16.6';
const LEARNER_PRE_REVEAL_MS=700;
const LEARNER_EXPLANATION_MS=10000;
const LEARNER_PACING={combat:4600,combatChain:3800,special:4000,lock:3000};
let learnerAwaitingAdvance=false;
let learnerAdvanceTimer=null;

function learnerEnsureHomeButton(){
  if(document.getElementById('homeLearnButton'))return;
  const actions=document.querySelector('#homePanel .homeActions'),play=document.getElementById('homePlayButton');
  if(!actions||!play)return;
  const button=document.createElement('button');
  button.id='homeLearnButton';button.className='homeLearn homeCustomize';button.type='button';
  button.innerHTML='<span>Learn to Play</span><small>Easy · guided learning · start now</small>';
  play.after(button);
  button.addEventListener('click',learnerQuickStart)
}
function learnerQuickStart(){
  try{setMatchControllerMode('arcade',{owner:H})}catch{}
  easyLearningEnabled=true;try{easyLearningSave()}catch{}
  if(!guideEnabled){guideEnabled=true;try{updateGuideButtons()}catch{}}
  aiDifficulty='easy';colorMode='default';
  try{setColorMode('default')}catch{}
  try{setAiDifficulty('easy')}catch{}
  try{humanColor=presetColor('blue');aiColor=presetColor('orange');applyColors()}catch{}
  try{easyLearningSyncSetup()}catch{}
  beginRandomMatch('Learn to Play',{useDefaults:false})
}

// Keep the learning card attached to the player's action area on every layout.
// On mobile it replaces the generic context tray while learning is active.
const easyLearningPlaceCoachBeforeLearnerUx=easyLearningPlaceCoach;
easyLearningPlaceCoach=function(){
  const coach=document.getElementById('easyLearningCoach'),humanZone=document.querySelector('.humanZone'),humanPanel=humanZone?.querySelector('.panel.human');
  if(coach&&humanZone&&humanPanel){
    if(coach.parentElement!==humanZone||coach.nextElementSibling!==humanPanel)humanZone.insertBefore(coach,humanPanel);
    coach.dataset.placement='player';return
  }
  return easyLearningPlaceCoachBeforeLearnerUx()
};

function learnerConciseCoachCopy(title,text){
  const t=String(title||''),x=String(text||'');
  if(t==='GET 4 IN A ROW')return[t,'Make four of your color touch.'];
  if(t.startsWith('1 ·'))return['PICK A PIECE','Choose Rock, Paper, Scissors, or Decoy.'];
  if(t.startsWith('2 ·'))return['PICK A COLUMN','Tap the column where it should fall.'];
  if(t==='Watch what happens')return['WATCH THE MOVE','Follow the drop. Read the clash.'];
  if(t==='Opponent turn'||t==='WHAT TO WATCH')return['WATCH THEIR MOVE','See where their piece lands.'];
  if(t==='WHAT TO LOOK FOR'){
    if(x.includes('Before moving:'))return['CHECK THE BOARD','Your 4 → their 4 → then R/P/S.'];
    if(x.includes('three connected'))return['CHECK THE LINE',x.replace('Find the empty space that ','Find where ').replace('would complete','finishes').replace('could complete','could finish')];
    return['CHECK THE BOARD','Your line first. Their line second.'];
  }
  if(t==='Pick, then drop')return['PICK → DROP','Choose a piece, then choose its column.'];
  if(t==='Piece dropping')return['WATCH THE DROP','See where it lands.'];
  return[t,x.length>72?x.slice(0,69).trimEnd()+'…':x]
}
const easyLearningSetCoachBeforeLearnerUx=easyLearningSetCoach;
easyLearningSetCoach=function(title,text,options={}){
  const [shortTitle,shortText]=learnerConciseCoachCopy(title,text);
  return easyLearningSetCoachBeforeLearnerUx(shortTitle,shortText,options)
};

// Normal Easy already has a slightly slower cadence. Learn-as-you-play gets an
// additional readable hold, but repeated events still move faster than first lessons.
const eventDurationBeforeLearnerUx=eventDuration;
eventDuration=function(e){
  const base=eventDurationBeforeLearnerUx(e);if(!easyLearningAutoActive())return base;
  if(e?.kind==='combat')return Math.max(base,e.chainTotal>1&&e.chainIndex>1?LEARNER_PACING.combatChain:LEARNER_PACING.combat);
  if(e?.kind==='cooldown-earned')return Math.max(base,LEARNER_PACING.lock);
  if(['fortified','critical-defense','clashmate'].includes(e?.kind))return Math.max(base,LEARNER_PACING.special);
  return base
};

function learnerSkipBar(next,event){
  learnerAwaitingAdvance=true;document.body.classList.add('learning-awaiting-continue');
  let footer=overlayCard.querySelector('.learnerContinueBar');
  if(!footer){footer=document.createElement('div');footer.className='learnerContinueBar';overlayCard.appendChild(footer)}
  footer.innerHTML='<span>Learning mode · extra reading time</span><button type="button" class="learnerContinueButton">Skip</button>';
  const button=footer.querySelector('button');
  const proceed=()=>{
    if(!learnerAwaitingAdvance)return;
    learnerAwaitingAdvance=false;document.body.classList.remove('learning-awaiting-continue');
    if(learnerAdvanceTimer){clearTimeout(learnerAdvanceTimer);learnerAdvanceTimer=null}
    footer.remove();next()
  };
  button.addEventListener('click',proceed,{once:true});
  learnerAdvanceTimer=setTimeout(proceed,LEARNER_EXPLANATION_MS);
  try{overlay.setAttribute('aria-label',`Learning explanation: ${event?.kind||'game event'}. Read it or skip the extra wait.`)}catch{}
}

const playEventsBeforeLearnerUx=playEvents;
playEvents=function(events,done,column=null){
  const list=Array.isArray(events)?events:[];
  const hasCombat=list.some(e=>e?.kind==='combat');
  const needsExtraRead=easyLearningAutoActive()&&list.some(e=>easyLearningNeedsLesson(e));
  if(!needsExtraRead){
    if(easyLearningPaced()&&hasCombat){scheduleTimer('learnerPreReveal',()=>playEventsBeforeLearnerUx(list,done,column),LEARNER_PRE_REVEAL_MS);return}
    return playEventsBeforeLearnerUx(list,done,column)
  }
  let queue=prepareEvents(list),i=0,started=false;
  function next(){
    if(i>=queue.length){
      activePresentation=null;overlay.classList.remove('show');document.body.classList.remove('learning-awaiting-continue');learnerAwaitingAdvance=false;
      if(learnerAdvanceTimer){clearTimeout(learnerAdvanceTimer);learnerAdvanceTimer=null}
      done();return
    }
    const e=queue[i++],needsRead=easyLearningNeedsLesson(e);
    const present=()=>{
      activePresentation={event:e,column:presentationColumn(e,column)};render();emitFeedback(feedbackCueForEvent(e));showEvent(e);
      if(needsRead)learnerSkipBar(next,e);else scheduleTimer('event',next,eventDuration(e))
    };
    if(!started&&e?.kind==='combat'){started=true;scheduleTimer('learnerPreReveal',present,LEARNER_PRE_REVEAL_MS)}else{started=true;present()}
  }
  next()
};

learnerEnsureHomeButton();
easyLearningPlaceCoach();
globalThis.learnerQuickStart=learnerQuickStart;
globalThis.LEARNER_UX_VERSION=LEARNER_UX_VERSION;
globalThis.LEARNER_EXPLANATION_MS=LEARNER_EXPLANATION_MS;
