// Multiplayer Alpha 0.16.5: readable Easy learning, useful tips, and adaptive pacing.
'use strict';
const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1';
const EASY_LEARNING_SETTING_KEY='clash4.easyLearning.enabled';
const EASY_LEARNING_DEFAULTS={goal:false,choose:false,drop:false,rps:false,fog:false,decoy:false,lock:false,fortified:false,critical:false,clashmate:false};
const EASY_LEARNING_PACING={combatNew:3800,combat:2800,combatChainNew:3300,combatChain:2400,specialNew:3200,special:2200,lockNew:2400,lock:1500,chain:750,aiBreath:650};
let easyLearningEnabled=true;
let easyLearningProgress={...EASY_LEARNING_DEFAULTS};
let easyLearningStateRef=null;
let easyLearningSelectedThisTurn=false;
let easyLearningLockUntil=0;
let easyLearningCoachKey='';
let easyLearningThreatKey='';

try{easyLearningEnabled=localStorage.getItem(EASY_LEARNING_SETTING_KEY)!=='off'}catch{}
try{easyLearningProgress={...EASY_LEARNING_DEFAULTS,...JSON.parse(localStorage.getItem(EASY_LEARNING_STORAGE_KEY)||'{}')}}catch{}

function easyLearningMode(){return matchMode==='arcade'&&aiDifficulty==='easy'}
function easyLearningAutoActive(){return easyLearningMode()&&easyLearningEnabled}
function easyLearningActive(){return easyLearningMode()&&(easyLearningEnabled||guideEnabled)}
function easyLearningPaced(){return easyLearningMode()}
function easyLearningSave(){try{localStorage.setItem(EASY_LEARNING_STORAGE_KEY,JSON.stringify(easyLearningProgress));localStorage.setItem(EASY_LEARNING_SETTING_KEY,easyLearningEnabled?'on':'off')}catch{}}
function easyLearningMark(key){if(!(key in easyLearningProgress)||easyLearningProgress[key])return;easyLearningProgress[key]=true;easyLearningSave()}
function easyLearningBasicsLearned(){return easyLearningProgress.goal&&easyLearningProgress.choose&&easyLearningProgress.drop&&easyLearningProgress.rps&&easyLearningProgress.fog}
function easyLearningReset(){easyLearningProgress={...EASY_LEARNING_DEFAULTS};easyLearningStateRef=null;easyLearningSelectedThisTurn=false;easyLearningCoachKey='';easyLearningSave();easyLearningSyncSetup();if(easyLearningActive())easyLearningSetCoach('Learning tips reset','Easy will explain each idea again as you encounter it.',{tone:'success',showMe:false,lock:2200})}

function easyLearningEnsureSetup(){
  let panel=document.getElementById('easyLearningSetup');if(panel)return panel;
  const cards=document.getElementById('difficultyCards');if(!cards)return null;
  panel=document.createElement('div');panel.id='easyLearningSetup';panel.className='easyLearningSetup';
  panel.innerHTML='<div class="easyLearningSetupCopy"><span>EASY LEARNING</span><strong>Learn while you play</strong><small>Automatic explanations teach new mechanics. Guided Tips adds optional reminders about what to look at.</small></div><div class="easyLearningSetupActions"><label><span>Learn as you play</span><button id="easyLearningToggle" type="button" aria-pressed="true">On</button></label><label><span>Guided Tips</span><button id="easyLearningGuidedToggle" type="button" aria-pressed="false">Off</button></label><button id="easyLearningReset" class="easyLearningReset" type="button">Reset tips</button></div>';
  cards.after(panel);
  panel.querySelector('#easyLearningToggle')?.addEventListener('click',()=>{easyLearningEnabled=!easyLearningEnabled;easyLearningSave();easyLearningSyncSetup();easyLearningAfterRender()});
  panel.querySelector('#easyLearningGuidedToggle')?.addEventListener('click',()=>{toggleGuide();easyLearningSyncSetup();easyLearningAfterRender()});
  panel.querySelector('#easyLearningReset')?.addEventListener('click',easyLearningReset);
  return panel
}
function easyLearningSyncSetup(){
  const panel=easyLearningEnsureSetup(),toggle=document.getElementById('easyLearningToggle'),guided=document.getElementById('easyLearningGuidedToggle'),setup=document.getElementById('matchSetupPanel');
  if(panel)panel.hidden=aiDifficulty!=='easy';
  setup?.classList.toggle('easyLearningCombinedSetup',aiDifficulty==='easy');
  if(toggle){toggle.textContent=easyLearningEnabled?'On':'Off';toggle.setAttribute('aria-pressed',String(easyLearningEnabled));toggle.classList.toggle('active',easyLearningEnabled)}
  if(guided){guided.textContent=guideEnabled?'On':'Off';guided.setAttribute('aria-pressed',String(guideEnabled));guided.classList.toggle('active',guideEnabled)}
  const easyCard=document.querySelector('.difficultyCard[data-difficulty="easy"] small');if(easyCard)easyCard.textContent='Forgiving AI · readable pace · optional learning help'
}

function easyLearningEnsureCoach(){
  let coach=document.getElementById('easyLearningCoach');if(coach)return coach;
  const message=document.getElementById('message');if(!message)return null;
  coach=document.createElement('aside');coach.id='easyLearningCoach';coach.className='easyLearningCoach';coach.hidden=true;coach.setAttribute('aria-live','polite');
  coach.innerHTML='<div class="easyCoachIcon" aria-hidden="true">YOU</div><div class="easyCoachCopy"><strong id="easyCoachTitle">Learn while you play</strong><span id="easyCoachText">Clash 4 will explain new situations as they happen.</span></div><div class="easyRpsCompass" aria-label="Rock beats Scissors, Scissors beats Paper, Paper beats Rock"><span>🪨</span><b>›</b><span>✂️</span><b>›</b><span>📄</span><b>›</b><span>🪨</span></div><div class="easyCoachActions"><button id="easyCoachWhy" type="button" hidden>Why?</button><button id="easyCoachShowMe" type="button">Show Me</button></div><div id="easyCoachWhyPanel" class="easyCoachWhyPanel" hidden><b>Rock–Paper–Scissors</b><span>🪨 Rock beats ✂️ Scissors · ✂️ Scissors beat 📄 Paper · 📄 Paper beats 🪨 Rock.</span></div>';
  message.after(coach);
  coach.querySelector('#easyCoachShowMe')?.addEventListener('click',easyLearningShowMe);
  coach.querySelector('#easyCoachWhy')?.addEventListener('click',()=>{const p=document.getElementById('easyCoachWhyPanel');if(p)p.hidden=!p.hidden});
  easyLearningPlaceCoach();return coach
}
function easyLearningPlaceCoach(){
  const coach=document.getElementById('easyLearningCoach');if(!coach)return;
  const desktop=window.matchMedia?.('(min-width:980px)').matches;
  const message=document.getElementById('message'),humanZone=document.querySelector('.humanZone'),humanPanel=humanZone?.querySelector('.panel.human');
  if(desktop&&humanPanel){if(coach.parentElement!==humanZone||coach.nextElementSibling!==humanPanel)humanZone.insertBefore(coach,humanPanel);coach.dataset.placement='player'}
  else if(message){if(message.nextElementSibling!==coach)message.after(coach);coach.dataset.placement='board'}
}
function easyLearningSetCoach(title,text,{tone='tip',why=false,showMe=true,lock=0}={}){
  const coach=easyLearningEnsureCoach();if(!coach)return;easyLearningPlaceCoach();
  const key=`${title}|${text}|${tone}|${why}|${showMe}`;if(key!==easyLearningCoachKey){easyLearningCoachKey=key;const whyPanel=document.getElementById('easyCoachWhyPanel');if(whyPanel)whyPanel.hidden=true}
  coach.hidden=false;coach.dataset.tone=tone;
  const titleEl=document.getElementById('easyCoachTitle'),textEl=document.getElementById('easyCoachText'),whyBtn=document.getElementById('easyCoachWhy'),showBtn=document.getElementById('easyCoachShowMe');
  if(titleEl)titleEl.textContent=title;if(textEl)textEl.textContent=text;if(whyBtn)whyBtn.hidden=!why;if(showBtn)showBtn.hidden=!showMe;
  if(lock){easyLearningLockUntil=Date.now()+lock;setTimeout(()=>{if(Date.now()>=easyLearningLockUntil)easyLearningAfterRender()},lock+30)}
}
function easyLearningHideCoach(){const coach=easyLearningEnsureCoach();if(coach)coach.hidden=true;easyLearningCoachKey=''}
function easyLearningPulse(selector,ms=1200){for(const el of document.querySelectorAll(selector))el.classList.add('easyLearningPulse');setTimeout(()=>{for(const el of document.querySelectorAll(selector))el.classList.remove('easyLearningPulse')},ms)}
function easyLearningPulseBoard(ms=1450){
  const boardEl=document.getElementById('board')||board;if(!boardEl)return;
  boardEl.classList.add('easyLearningBoardCue');setTimeout(()=>boardEl.classList.remove('easyLearningBoardCue'),ms)
}
function easyLearningShowMe(){
  if(!easyLearningActive()||!ready||busy||s.winner||s.draw)return;
  if(s.turn!==H){easyLearningSetCoach('Watch this turn','Watch where the opponent’s color lands. Your controls activate when the turn comes back to you.',{showMe:false,lock:1900});return}
  easyLearningSetCoach('Pick, then drop','First choose a piece. Then tap anywhere in the column where you want it to fall.',{showMe:false,lock:2300});
  easyLearningPulse('#humanInventory .choice:not(:disabled)',1250);
  setTimeout(()=>easyLearningPulseBoard(1500),700)
}

function easyLearningThreeThreat(owner){
  try{
    const g=gridOf(s.board),rows=g.length,cols=g[0]?.length||0,dirs=[[0,1],[1,0],[1,1],[1,-1]];
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)for(const [dr,dc] of dirs){
      const cells=[];for(let i=0;i<4;i++){const rr=r+dr*i,cc=c+dc*i;if(rr<0||rr>=rows||cc<0||cc>=cols){cells.length=0;break}cells.push(g[rr][cc])}
      if(cells.length===4&&cells.filter(p=>p?.owner===owner).length===3&&cells.filter(Boolean).length===3)return true
    }
  }catch{}
  return false
}
function easyLearningGuidedTip(){
  if(!guideEnabled)return'';
  try{
    if(s.turn!==H)return'Watch where their color lands. If a type is revealed in a clash, remember it before it hides again.';
    const display=displayCooldowns(s,H);if(display.some(cd=>cd.critical))return'Critical Defense is open. Check that emergency column before choosing your move.';
    if(easyLearningThreeThreat(H))return'You have three connected. Find the empty space that would complete four.';
    if(easyLearningThreeThreat(A))return'The opponent has three connected. Find the empty space that could complete their four.';
    if(s.moveNumber<=2)return'Look at your color pattern first. Then choose the piece and column you want to add.';
    return'Before moving: check your line of four, check their line of four, then decide which R/P/S risk you want to take.'
  }catch{return''}
}
function easyLearningTurnCoach(){
  if(!easyLearningActive()||!ready||s.winner||s.draw){easyLearningHideCoach();return}
  easyLearningPlaceCoach();if(Date.now()<easyLearningLockUntil)return;
  if(s!==easyLearningStateRef){
    easyLearningStateRef=s;easyLearningSelectedThisTurn=false;easyLearningThreatKey='';
    if(easyLearningAutoActive()&&!easyLearningProgress.goal){easyLearningMark('goal');easyLearningSetCoach('GET 4 IN A ROW','Connect four of your color across, down, or diagonal.',{tone:'goal',showMe:false,lock:3200});return}
  }
  if(busy||dropPresentation){if(easyLearningAutoActive())easyLearningSetCoach('Watch what happens','Follow the falling piece and the result of any clash before thinking about the next turn.',{showMe:false});else easyLearningHideCoach();return}
  if(guideEnabled){
    const humanThreat=easyLearningThreeThreat(H),aiThreat=easyLearningThreeThreat(A),threatKey=humanThreat?'human':aiThreat?'ai':'';
    if(threatKey&&threatKey!==easyLearningThreatKey){easyLearningThreatKey=threatKey;easyLearningSetCoach(humanThreat?'You’re close to 4':'Watch out — opponent is close to 4',humanThreat?'Find the open space that would finish your four.':'Find the open space that could finish their four.',{tone:humanThreat?'success':'warning',showMe:false,lock:2600});return}
  }
  if(s.turn!==H){
    if(!guideEnabled&&(easyLearningBasicsLearned()||!easyLearningAutoActive())){easyLearningHideCoach();return}
    easyLearningSetCoach(guideEnabled?'WHAT TO WATCH':'Opponent turn',easyLearningGuidedTip()||'Watch where the opponent’s color lands. Your controls activate when the turn returns.',{showMe:false});return
  }
  if(easyLearningAutoActive()&&!easyLearningProgress.choose){easyLearningSetCoach('1 · Pick a piece','Choose Rock, Paper, Scissors, or a Decoy.',{tone:'step'});return}
  if(easyLearningAutoActive()&&!easyLearningProgress.drop){easyLearningSetCoach('2 · Pick a column','Tap anywhere in the column where you want the piece to fall.',{tone:'step'});return}
  if(!guideEnabled&&(easyLearningBasicsLearned()||!easyLearningAutoActive())){easyLearningHideCoach();return}
  easyLearningSetCoach(guideEnabled?'WHAT TO LOOK FOR':'Your turn',easyLearningGuidedTip()||'Build toward four. If pieces meet, the game will explain the result.',{tone:'quiet'})
}
function easyLearningAfterRender(){
  easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();easyLearningPlaceCoach();
  const active=easyLearningActive();document.body.classList.toggle('easy-learning-active',active);
  if(!active){easyLearningHideCoach();return}
  easyLearningTurnCoach()
}

function easyLearningNeedsLesson(e){
  if(!easyLearningAutoActive()||!e)return false;
  if(e.kind==='combat')return e.decoyContact?!easyLearningProgress.decoy:(!easyLearningProgress.rps||!easyLearningProgress.fog);
  const map={'cooldown-earned':'lock','fortified':'fortified','critical-defense':'critical','clashmate':'clashmate'};
  return map[e.kind]?!easyLearningProgress[map[e.kind]]:false
}
function easyLearningCombatLesson(e){
  if(!easyLearningAutoActive()||e?.kind!=='combat')return;
  document.querySelector('.easyCombatLesson')?.remove();
  const lesson=document.createElement('div');lesson.className='easyCombatLesson';
  if(e.decoyContact){easyLearningMark('decoy');lesson.innerHTML='<strong>WHAT HAPPENED · Decoy contact</strong><span>Decoys do not fight. Both pieces stay, and the chain stops.</span>'}
  else{
    const a=e.atk?.type?M[e.atk.type]?.[0]:'Hidden',d=e.def?.type?M[e.def.type]?.[0]:'Hidden';
    if(!easyLearningProgress.rps){easyLearningMark('rps');lesson.innerHTML=`<strong>WHAT HAPPENED · ${a} vs ${d}</strong><span>${e.o==='tie'?'Same type means neither wins this clash.':`${a} ${e.o==='win'?'beats':'loses to'} ${d}.`}</span><button type="button" class="easyCombatWhy">Why?</button>`}
    if(!easyLearningProgress.fog){easyLearningMark('fog');lesson.innerHTML+=(lesson.innerHTML?'':'<strong>WHAT HAPPENED · Hidden pieces</strong>')+'<span>After the clash, an enemy Rock/Paper/Scissors identity hides behind <b>?</b> again.</span>'}
  }
  if(!lesson.innerHTML)return;overlayCard.appendChild(lesson);
  lesson.querySelector('.easyCombatWhy')?.addEventListener('click',()=>{let p=lesson.querySelector('.easyCombatWhyPanel');if(!p){p=document.createElement('div');p.className='easyCombatWhyPanel';p.textContent='🪨 Rock beats ✂️ Scissors · ✂️ Scissors beat 📄 Paper · 📄 Paper beats 🪨 Rock.';lesson.appendChild(p)}p.hidden=!p.hidden})
}
function easyLearningSpecialLesson(e){
  if(!easyLearningAutoActive())return;
  const map={
    'cooldown-earned':['lock','WHAT HAPPENED · Combat Lock','The winning survivor is protected through the opponent’s next turn.'],
    'fortified':['fortified','WHAT HAPPENED · Fortified','A stronger protected piece was earned after a powerful chain.'],
    'critical-defense':['critical','WHAT HAPPENED · Critical Defense','The game opened an emergency challenge because an immediate loss was otherwise unavoidable.'],
    'clashmate':['clashmate','WHAT HAPPENED · Clashmate','The connected three is protected and the next Connect 4 cannot be stopped.']
  },entry=map[e?.kind];if(!entry||easyLearningProgress[entry[0]])return;easyLearningMark(entry[0]);
  const lesson=document.createElement('div');lesson.className='easyCombatLesson easySpecialLesson';lesson.innerHTML=`<strong>${entry[1]}</strong><span>${entry[2]}</span>`;overlayCard.appendChild(lesson)
}

const setAiDifficultyBeforeEasyLearning=setAiDifficulty;
setAiDifficulty=function(value){const result=setAiDifficultyBeforeEasyLearning(value);easyLearningSyncSetup();easyLearningAfterRender();return result};

const combatHistoryModeBeforeEasyLearning=combatHistoryMode;
combatHistoryMode=function(){return easyLearningActive()?'recent':combatHistoryModeBeforeEasyLearning()};

const eventDurationBeforeEasyLearning=eventDuration;
eventDuration=function(e){
  const base=eventDurationBeforeEasyLearning(e);if(!easyLearningPaced())return base;
  const fresh=!!e?.__easyLearningFreshLesson;
  if(e?.kind==='combat'){
    if(e.chainTotal>1&&e.chainIndex>1)return Math.max(base,fresh?EASY_LEARNING_PACING.combatChainNew:EASY_LEARNING_PACING.combatChain);
    return Math.max(base,fresh?EASY_LEARNING_PACING.combatNew:EASY_LEARNING_PACING.combat)
  }
  if(e?.kind==='chain-continue')return Math.max(base,EASY_LEARNING_PACING.chain);
  if(e?.kind==='cooldown-earned')return Math.max(base,fresh?EASY_LEARNING_PACING.lockNew:EASY_LEARNING_PACING.lock);
  if(['fortified','critical-defense','clashmate'].includes(e?.kind))return Math.max(base,fresh?EASY_LEARNING_PACING.specialNew:EASY_LEARNING_PACING.special);
  return base
};

const startAiTurnBeforeEasyLearning=startAiTurn;
startAiTurn=async function(){
  if(easyLearningPaced()&&ready&&!busy&&!s.winner&&!s.draw&&s.turn===A){
    if(easyLearningActive())easyLearningSetCoach(guideEnabled?'WHAT TO WATCH':'Opponent turn',easyLearningGuidedTip()||'Take a moment to read the board before the opponent moves.',{showMe:false});
    await new Promise(resolve=>setTimeout(resolve,EASY_LEARNING_PACING.aiBreath));
    if(!easyLearningPaced()||!ready||busy||s.winner||s.draw||s.turn!==A)return
  }
  return startAiTurnBeforeEasyLearning()
};

const showEventBeforeEasyLearning=showEvent;
showEvent=function(e){
  if(e&&easyLearningNeedsLesson(e))e.__easyLearningFreshLesson=true;
  const result=showEventBeforeEasyLearning(e);easyLearningCombatLesson(e);easyLearningSpecialLesson(e);return result
};

const renderBeforeEasyLearning=render;
render=function(){const result=renderBeforeEasyLearning();easyLearningAfterRender();return result};

humanInventory?.addEventListener('click',event=>{
  if(!easyLearningActive())return;const choice=event.target?.closest?.('.choice');if(!choice||choice.disabled)return;
  easyLearningSelectedThisTurn=true;if(easyLearningAutoActive())easyLearningMark('choose');
  const name=choice.querySelector('.name')?.textContent||'';
  if(easyLearningAutoActive()&&name==='Decoy')easyLearningSetCoach('Decoy','It does not fight, but it still counts toward your 4-in-a-row.',{tone:'decoy',showMe:false,lock:2800});
  else if(easyLearningAutoActive())easyLearningSetCoach('2 · Pick a column','Tap anywhere in the column where you want this piece to fall.',{tone:'step',showMe:true,lock:1400});
  else if(guideEnabled)easyLearningSetCoach('WHAT TO LOOK FOR',easyLearningGuidedTip(),{tone:'quiet',showMe:true,lock:1400});
  setTimeout(()=>easyLearningPulseBoard(1450),160)
});
function easyLearningRegisterDrop(event){
  if(!easyLearningActive())return;const cell=event.target?.closest?.('#board .cell[data-column][tabindex="0"]');if(!cell||cell.disabled)return;
  if(easyLearningAutoActive())easyLearningMark('drop');easyLearningSelectedThisTurn=false;
  if(easyLearningAutoActive())easyLearningSetCoach('Piece dropping','Watch where it lands. If it meets another piece, read the clash before the next turn begins.',{showMe:false,lock:1500})
}
board?.addEventListener('pointerdown',easyLearningRegisterDrop,true);board?.addEventListener('click',easyLearningRegisterDrop,true);
window.addEventListener('resize',easyLearningPlaceCoach,{passive:true});

easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();easyLearningAfterRender();
globalThis.easyLearningReset=easyLearningReset;
globalThis.easyLearningShowMe=easyLearningShowMe;
globalThis.EASY_LEARNING_PACING=EASY_LEARNING_PACING;
