// Multiplayer Alpha 0.16.6: one-tap learner entry, concise coach copy, and learner-controlled first explanations.
'use strict';
const LEARNER_UX_VERSION='0.16.6';
const LEARNER_PRE_REVEAL_MS=520;
let learnerAwaitingContinue=false;

function learnerEnsureHomeButton(){
  if(document.getElementById('homeLearnButton'))return;
  const actions=document.querySelector('#homePanel .homeActions'),play=document.getElementById('homePlayButton');
  if(!actions||!play)return;
  const button=document.createElement('button');
  button.id='homeLearnButton';button.className='homeLearn';button.type='button';
  button.innerHTML='<span>Learn to Play</span><small>Easy · learning help on · start now</small>';
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
  return[t,x.length>84?x.slice(0,81).trimEnd()+'…':x]
}
const easyLearningSetCoachBeforeLearnerUx=easyLearningSetCoach;
easyLearningSetCoach=function(title,text,options={}){
  const [shortTitle,shortText]=learnerConciseCoachCopy(title,text);
  return easyLearningSetCoachBeforeLearnerUx(shortTitle,shortText,options)
};

function learnerContinueButton(next,event){
  learnerAwaitingContinue=true;document.body.classList.add('learning-awaiting-continue');
  let footer=overlayCard.querySelector('.learnerContinueBar');
  if(!footer){footer=document.createElement('div');footer.className='learnerContinueBar';overlayCard.appendChild(footer)}
  footer.innerHTML='<span>Take your time.</span><button type="button" class="learnerContinueButton">Got it</button>';
  const button=footer.querySelector('button');
  button.disabled=true;
  setTimeout(()=>{button.disabled=false;button.focus({preventScroll:true})},700);
  const proceed=()=>{
    if(!learnerAwaitingContinue)return;learnerAwaitingContinue=false;document.body.classList.remove('learning-awaiting-continue');footer.remove();next()
  };
  button.addEventListener('click',proceed,{once:true});
  button.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!button.disabled){e.preventDefault();proceed()}},{once:true});
  try{overlay.setAttribute('aria-label',`Learning explanation: ${event?.kind||'game event'}. Continue when ready.`)}catch{}
}

const playEventsBeforeLearnerUx=playEvents;
playEvents=function(events,done,column=null){
  const list=Array.isArray(events)?events:[];
  const hasCombat=list.some(e=>e?.kind==='combat');
  const needsManual=easyLearningAutoActive()&&list.some(e=>easyLearningNeedsLesson(e));
  if(!needsManual){
    if(easyLearningPaced()&&hasCombat){
      scheduleTimer('learnerPreReveal',()=>playEventsBeforeLearnerUx(list,done,column),LEARNER_PRE_REVEAL_MS);return
    }
    return playEventsBeforeLearnerUx(list,done,column)
  }
  let queue=prepareEvents(list),i=0,started=false;
  function next(){
    if(i>=queue.length){activePresentation=null;overlay.classList.remove('show');document.body.classList.remove('learning-awaiting-continue');learnerAwaitingContinue=false;done();return}
    const e=queue[i++],needsAck=easyLearningNeedsLesson(e);
    const present=()=>{
      activePresentation={event:e,column:presentationColumn(e,column)};render();emitFeedback(feedbackCueForEvent(e));showEvent(e);
      if(needsAck)learnerContinueButton(next,e);else scheduleTimer('event',next,eventDuration(e))
    };
    if(!started&&e?.kind==='combat'){started=true;scheduleTimer('learnerPreReveal',present,LEARNER_PRE_REVEAL_MS)}else{started=true;present()}
  }
  next()
};

learnerEnsureHomeButton();
globalThis.learnerQuickStart=learnerQuickStart;
globalThis.LEARNER_UX_VERSION=LEARNER_UX_VERSION;
