// Multiplayer Alpha 0.16.3: progressive Easy-mode learnability layer.
'use strict';
const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1';
const EASY_LEARNING_SETTING_KEY='clash4.easyLearning.enabled';
const EASY_LEARNING_DEFAULTS={goal:false,choose:false,drop:false,rps:false,fog:false,decoy:false,lock:false,fortified:false,critical:false,clashmate:false};
let easyLearningEnabled=true;
let easyLearningProgress={...EASY_LEARNING_DEFAULTS};
let easyLearningStateRef=null;
let easyLearningSelectedThisTurn=false;
let easyLearningLockUntil=0;
let easyLearningCoachKey='';
let easyLearningThreatKey='';

try{easyLearningEnabled=localStorage.getItem(EASY_LEARNING_SETTING_KEY)!=='off'}catch{}
try{easyLearningProgress={...EASY_LEARNING_DEFAULTS,...JSON.parse(localStorage.getItem(EASY_LEARNING_STORAGE_KEY)||'{}')}}catch{}

function easyLearningActive(){return matchMode==='arcade'&&aiDifficulty==='easy'&&easyLearningEnabled}
function easyLearningSave(){try{localStorage.setItem(EASY_LEARNING_STORAGE_KEY,JSON.stringify(easyLearningProgress));localStorage.setItem(EASY_LEARNING_SETTING_KEY,easyLearningEnabled?'on':'off')}catch{}}
function easyLearningMark(key){if(!(key in easyLearningProgress)||easyLearningProgress[key])return;easyLearningProgress[key]=true;easyLearningSave()}
function easyLearningReset(){easyLearningProgress={...EASY_LEARNING_DEFAULTS};easyLearningStateRef=null;easyLearningSelectedThisTurn=false;easyLearningCoachKey='';easyLearningSave();easyLearningSyncSetup();easyLearningSetCoach('Learning tips reset','Easy will explain each idea again as you encounter it.',{tone:'success',showMe:false,lock:1600})}

function easyLearningEnsureSetup(){
  let panel=document.getElementById('easyLearningSetup');if(panel)return panel;
  const cards=document.getElementById('difficultyCards');if(!cards)return null;
  panel=document.createElement('div');panel.id='easyLearningSetup';panel.className='easyLearningSetup';
  panel.innerHTML='<div class="easyLearningSetupCopy"><span>LEARNING HELP</span><strong>Learn while you play</strong><small>Easy explains new situations only when they happen.</small></div><div class="easyLearningSetupActions"><button id="easyLearningToggle" type="button" aria-pressed="true">On</button><button id="easyLearningReset" type="button">Reset tips</button></div>';
  cards.after(panel);
  panel.querySelector('#easyLearningToggle')?.addEventListener('click',()=>{easyLearningEnabled=!easyLearningEnabled;easyLearningSave();easyLearningSyncSetup();easyLearningAfterRender()});
  panel.querySelector('#easyLearningReset')?.addEventListener('click',easyLearningReset);
  return panel
}
function easyLearningSyncSetup(){
  const panel=easyLearningEnsureSetup(),toggle=document.getElementById('easyLearningToggle');
  if(panel)panel.hidden=aiDifficulty!=='easy';
  if(toggle){toggle.textContent=easyLearningEnabled?'On':'Off';toggle.setAttribute('aria-pressed',String(easyLearningEnabled));toggle.classList.toggle('active',easyLearningEnabled)}
  const easyCard=document.querySelector('.difficultyCard[data-difficulty="easy"] small');if(easyCard)easyCard.textContent='Forgiving AI · learns while you play'
}

function easyLearningEnsureCoach(){
  let coach=document.getElementById('easyLearningCoach');if(coach)return coach;
  const message=document.getElementById('message');if(!message)return null;
  coach=document.createElement('aside');coach.id='easyLearningCoach';coach.className='easyLearningCoach';coach.hidden=true;coach.setAttribute('aria-live','polite');
  coach.innerHTML='<div class="easyCoachIcon" aria-hidden="true">✦</div><div class="easyCoachCopy"><strong id="easyCoachTitle">Learn while you play</strong><span id="easyCoachText">Clash 4 will explain new situations as they happen.</span></div><div class="easyRpsCompass" aria-label="Rock beats Scissors, Scissors beats Paper, Paper beats Rock"><span>🪨</span><b>›</b><span>✂️</span><b>›</b><span>📄</span><b>›</b><span>🪨</span></div><div class="easyCoachActions"><button id="easyCoachWhy" type="button" hidden>Why?</button><button id="easyCoachShowMe" type="button">Show Me</button></div><div id="easyCoachWhyPanel" class="easyCoachWhyPanel" hidden><b>Rock–Paper–Scissors</b><span>🪨 Rock beats ✂️ Scissors · ✂️ Scissors beat 📄 Paper · 📄 Paper beats 🪨 Rock.</span></div>';
  message.after(coach);
  coach.querySelector('#easyCoachShowMe')?.addEventListener('click',easyLearningShowMe);
  coach.querySelector('#easyCoachWhy')?.addEventListener('click',()=>{const p=document.getElementById('easyCoachWhyPanel');if(p)p.hidden=!p.hidden});
  return coach
}
function easyLearningSetCoach(title,text,{tone='tip',why=false,showMe=true,lock=0}={}){
  const coach=easyLearningEnsureCoach();if(!coach)return;
  const key=`${title}|${text}|${tone}|${why}|${showMe}`;if(key!==easyLearningCoachKey){easyLearningCoachKey=key;document.getElementById('easyCoachWhyPanel').hidden=true}
  coach.hidden=false;coach.dataset.tone=tone;
  const titleEl=document.getElementById('easyCoachTitle'),textEl=document.getElementById('easyCoachText'),whyBtn=document.getElementById('easyCoachWhy'),showBtn=document.getElementById('easyCoachShowMe');
  if(titleEl)titleEl.textContent=title;if(textEl)textEl.textContent=text;if(whyBtn)whyBtn.hidden=!why;if(showBtn)showBtn.hidden=!showMe;
  if(lock){easyLearningLockUntil=Date.now()+lock;setTimeout(()=>{if(Date.now()>=easyLearningLockUntil)easyLearningAfterRender()},lock+30)}
}
function easyLearningHideCoach(){const coach=easyLearningEnsureCoach();if(coach)coach.hidden=true;easyLearningCoachKey=''}
function easyLearningPulse(selector,ms=950){for(const el of document.querySelectorAll(selector))el.classList.add('easyLearningPulse');setTimeout(()=>{for(const el of document.querySelectorAll(selector))el.classList.remove('easyLearningPulse')},ms)}
function easyLearningShowMe(){
  if(!easyLearningActive()||!ready||busy||s.winner||s.draw)return;
  if(s.turn!==H){easyLearningSetCoach('Watch this turn','Your opponent is moving. Your controls will light up when it is your turn.',{showMe:false,lock:1300});return}
  easyLearningSetCoach('Pick, then drop','First choose a piece. Then tap any glowing column at the top of the board.',{showMe:false,lock:1500});
  easyLearningPulse('#humanInventory .choice:not(:disabled)',900);
  setTimeout(()=>easyLearningPulse('#board .cell[data-column][tabindex="0"]:not(:disabled)',1100),520)
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
function easyLearningTurnCoach(){
  if(!easyLearningActive()||!ready||s.winner||s.draw){easyLearningHideCoach();return}
  if(Date.now()<easyLearningLockUntil)return;
  if(s!==easyLearningStateRef){
    easyLearningStateRef=s;easyLearningSelectedThisTurn=false;easyLearningThreatKey='';
    if(!easyLearningProgress.goal){easyLearningMark('goal');easyLearningSetCoach('GET 4 IN A ROW','Connect four of your color across, down, or diagonal.',{tone:'goal',showMe:false,lock:2200});return}
  }
  if(busy||dropPresentation){easyLearningSetCoach('Watch what happens','Pieces can clash when they land on each other.',{showMe:false});return}
  const humanThreat=easyLearningThreeThreat(H),aiThreat=easyLearningThreeThreat(A),threatKey=humanThreat?'human':aiThreat?'ai':'';
  if(threatKey&&threatKey!==easyLearningThreatKey){easyLearningThreatKey=threatKey;easyLearningSetCoach(humanThreat?'You’re close to 4':'Watch out — opponent is close to 4',humanThreat?'Look for a way to finish your line.':'Look at their connected pieces before you move.',{tone:humanThreat?'success':'warning',showMe:false,lock:1700});return}
  if(s.turn!==H){easyLearningSetCoach('Opponent turn','Watch the board. You only need to decide when it comes back to you.',{showMe:false});return}
  if(!easyLearningProgress.choose){easyLearningSetCoach('1 · Pick a piece','Choose Rock, Paper, Scissors, or a Decoy.',{tone:'step'});return}
  if(!easyLearningProgress.drop){easyLearningSetCoach('2 · Tap a column','Your piece falls into the column you choose.',{tone:'step'});return}
  easyLearningSetCoach('Your turn','Build toward 4. If pieces meet, the game will show you what happened.',{tone:'quiet'})
}
function easyLearningAfterRender(){
  easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();
  const active=easyLearningActive();document.body.classList.toggle('easy-learning-active',active);
  if(!active){easyLearningHideCoach();return}
  easyLearningTurnCoach()
}

function easyLearningCombatLesson(e){
  if(!easyLearningActive()||e?.kind!=='combat')return;
  document.querySelector('.easyCombatLesson')?.remove();
  const lesson=document.createElement('div');lesson.className='easyCombatLesson';
  if(e.decoyContact){easyLearningMark('decoy');lesson.innerHTML='<strong>Decoy rule</strong><span>Decoys do not fight. Both pieces stay, and the chain stops.</span>'}
  else{
    const a=e.atk?.type?M[e.atk.type]?.[0]:'Hidden',d=e.def?.type?M[e.def.type]?.[0]:'Hidden';
    if(!easyLearningProgress.rps){easyLearningMark('rps');lesson.innerHTML=`<strong>${a} vs ${d}</strong><span>${e.o==='tie'?'Same type means neither wins this clash.':`${a} ${e.o==='win'?'beats':'loses to'} ${d}.`} Use <b>Why?</b> if you forget the cycle.</span><button type="button" class="easyCombatWhy">Why?</button>`}
    if(!easyLearningProgress.fog){easyLearningMark('fog');lesson.innerHTML+=(lesson.innerHTML?'':'<strong>Hidden pieces</strong>')+'<span>After the clash, an enemy Rock/Paper/Scissors identity hides behind <b>?</b> again.</span>'}
  }
  if(!lesson.innerHTML)return;overlayCard.appendChild(lesson);
  lesson.querySelector('.easyCombatWhy')?.addEventListener('click',()=>{let p=lesson.querySelector('.easyCombatWhyPanel');if(!p){p=document.createElement('div');p.className='easyCombatWhyPanel';p.textContent='🪨 Rock beats ✂️ Scissors · ✂️ Scissors beat 📄 Paper · 📄 Paper beats 🪨 Rock.';lesson.appendChild(p)}p.hidden=!p.hidden})
}
function easyLearningSpecialLesson(e){
  if(!easyLearningActive())return;
  const map={
    'cooldown-earned':['lock','Combat Lock','A winning survivor is protected through the opponent’s next turn.'],
    'fortified':['fortified','Fortified','A stronger protected piece was earned after a powerful chain.'],
    'critical-defense':['critical','Critical Defense','The game opened an emergency challenge because an immediate loss was otherwise unavoidable.'],
    'clashmate':['clashmate','Clashmate','The connected three is protected and the next Connect 4 cannot be stopped.']
  },entry=map[e?.kind];if(!entry||easyLearningProgress[entry[0]])return;easyLearningMark(entry[0]);
  const lesson=document.createElement('div');lesson.className='easyCombatLesson easySpecialLesson';lesson.innerHTML=`<strong>${entry[1]}</strong><span>${entry[2]}</span>`;overlayCard.appendChild(lesson)
}

const setAiDifficultyBeforeEasyLearning=setAiDifficulty;
setAiDifficulty=function(value){const result=setAiDifficultyBeforeEasyLearning(value);easyLearningSyncSetup();easyLearningAfterRender();return result};

const combatHistoryModeBeforeEasyLearning=combatHistoryMode;
combatHistoryMode=function(){return easyLearningActive()?'recent':combatHistoryModeBeforeEasyLearning()};

const showEventBeforeEasyLearning=showEvent;
showEvent=function(e){const result=showEventBeforeEasyLearning(e);easyLearningCombatLesson(e);easyLearningSpecialLesson(e);return result};

const renderBeforeEasyLearning=render;
render=function(){const result=renderBeforeEasyLearning();easyLearningAfterRender();return result};

humanInventory?.addEventListener('click',event=>{
  if(!easyLearningActive())return;const choice=event.target?.closest?.('.choice');if(!choice||choice.disabled)return;
  easyLearningSelectedThisTurn=true;easyLearningMark('choose');
  const name=choice.querySelector('.name')?.textContent||'';
  if(name==='Decoy')easyLearningSetCoach('Decoy','It does not fight, but it still counts toward your 4-in-a-row.',{tone:'decoy',showMe:false,lock:1700});
  else easyLearningSetCoach('2 · Tap a column','Now tap a glowing column to drop your piece.',{tone:'step',showMe:true,lock:800});
  setTimeout(()=>easyLearningPulse('#board .cell[data-column][tabindex="0"]:not(:disabled)',900),100)
});
function easyLearningRegisterDrop(event){
  if(!easyLearningActive())return;const cell=event.target?.closest?.('#board .cell[data-column][tabindex="0"]');if(!cell||cell.disabled)return;
  easyLearningMark('drop');easyLearningSelectedThisTurn=false;easyLearningSetCoach('Piece dropping','Watch where it lands. If it meets another piece, a clash may start.',{showMe:false,lock:1000})
}
board?.addEventListener('pointerdown',easyLearningRegisterDrop,true);board?.addEventListener('click',easyLearningRegisterDrop,true);

easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();easyLearningAfterRender();
globalThis.easyLearningReset=easyLearningReset;
globalThis.easyLearningShowMe=easyLearningShowMe;
