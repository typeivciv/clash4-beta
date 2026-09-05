// Multiplayer Alpha 0.16.4: paced, player-anchored Easy learning system.
'use strict';
const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1';
const EASY_LEARNING_SETTING_KEY='clash4.easyLearning.enabled';
const EASY_LEARNING_DEFAULTS={goal:false,choose:false,drop:false,rps:false,fog:false,decoy:false,lock:false,fortified:false,critical:false,clashmate:false};
const EASY_LEARNING_PACING={combat:3600,combatChain:3200,special:2700,lock:1900,chain:900,aiBreath:900};
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
function easyLearningBasicsLearned(){return easyLearningProgress.goal&&easyLearningProgress.choose&&easyLearningProgress.drop&&easyLearningProgress.rps&&easyLearningProgress.fog}
function easyLearningReset(){easyLearningProgress={...EASY_LEARNING_DEFAULTS};easyLearningStateRef=null;easyLearningSelectedThisTurn=false;easyLearningCoachKey='';easyLearningSave();easyLearningSyncSetup();easyLearningSetCoach('Learning tips reset','Easy will explain each idea again as you encounter it.',{tone:'success',showMe:false,lock:2200})}

function easyLearningEnsureSetup(){
  let panel=document.getElementById('easyLearningSetup');if(panel)return panel;
  const cards=document.getElementById('difficultyCards');if(!cards)return null;
  panel=document.createElement('div');panel.id='easyLearningSetup';panel.className='easyLearningSetup';
  panel.innerHTML='<div class="easyLearningSetupCopy"><span>EASY LEARNING</span><strong>Learn while you play</strong><small>One learning system: automatic explanations, plus optional Guided Tips for extra reminders.</small></div><div class="easyLearningSetupActions"><label><span>Learn as you play</span><button id="easyLearningToggle" type="button" aria-pressed="true">On</button></label><label><span>Guided Tips</span><button id="easyLearningGuidedToggle" type="button" aria-pressed="false">Off</button></label><button id="easyLearningReset" class="easyLearningReset" type="button">Reset tips</button></div>';
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
  const easyCard=document.querySelector('.difficultyCard[data-difficulty="easy"] small');if(easyCard)easyCard.textContent='Forgiving AI · learns while you play'
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
  const key=`${title}|${text}|${tone}|${why}|${showMe}`;if(key!==easyLearningCoachKey){easyLearningCoachKey=key;document.getElementById('easyCoachWhyPanel').hidden=true}
  coach.hidden=false;coach.dataset.tone=tone;
  const titleEl=document.getElementById('easyCoachTitle'),textEl=document.getElementById('easyCoachText'),whyBtn=document.getElementById('easyCoachWhy'),showBtn=document.getElementById('easyCoachShowMe');
  if(titleEl)titleEl.textContent=title;if(textEl)textEl.textContent=text;if(whyBtn)whyBtn.hidden=!why;if(showBtn)showBtn.hidden=!showMe;
  if(lock){easyLearningLockUntil=Date.now()+lock;setTimeout(()=>{if(Date.now()>=easyLearningLockUntil)easyLearningAfterRender()},lock+30)}
}
function easyLearningHideCoach(){const coach=easyLearningEnsureCoach();if(coach)coach.hidden=true;easyLearningCoachKey=''}
function easyLearningPulse(selector,ms=1200){for(const el of document.querySelectorAll(selector))el.classList.add('easyLearningPulse');setTimeout(()=>{for(const el of document.querySelectorAll(selector))el.classList.remove('easyLearningPulse')},ms)}
function easyLearningShowMe(){
  if(!easyLearningActive()||!ready||busy||s.winner||s.draw)return;
  if(s.turn!==H){easyLearningSetCoach('Watch this turn','Your opponent is moving. Your controls will light up when it is your turn.',{showMe:false,lock:1900});return}
  easyLearningSetCoach('Pick, then drop','First choose a piece. Then tap any glowing column at the top of the board.',{showMe:false,lock:2300});
  easyLearningPulse('#humanInventory .choice:not(:disabled)',1250);
  setTimeout(()=>easyLearningPulse('#board .cell[data-column][tabindex="0"]:not(:disabled)',1450),700)
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
function easyLearningGuideCopy(){
  if(!guideEnabled)return'';
  try{return(String(guideText?.()||'').replace(/^TIP\s*—\s*/,'').trim())}catch{return''}
}
function easyLearningTurnCoach(){
  if(!easyLearningActive()||!ready||s.winner||s.draw){easyLearningHideCoach();return}
  easyLearningPlaceCoach();if(Date.now()<easyLearningLockUntil)return;
  if(s!==easyLearningStateRef){
    easyLearningStateRef=s;easyLearningSelectedThisTurn=false;easyLearningThreatKey='';
    if(!easyLearningProgress.goal){easyLearningMark('goal');easyLearningSetCoach('GET 4 IN A ROW','Connect four of your color across, down, or diagonal.',{tone:'goal',showMe:false,lock:3200});return}
  }
  if(busy||dropPresentation){easyLearningSetCoach('Watch what happens','The game is resolving this move. Follow the piece and any clash before the next turn starts.',{showMe:false});return}
  if(guideEnabled){
    const humanThreat=easyLearningThreeThreat(H),aiThreat=easyLearningThreeThreat(A),threatKey=humanThreat?'human':aiThreat?'ai':'';
    if(threatKey&&threatKey!==easyLearningThreatKey){easyLearningThreatKey=threatKey;easyLearningSetCoach(humanThreat?'You’re close to 4':'Watch out — opponent is close to 4',humanThreat?'Look for a way to finish your line.':'Look at their connected pieces before you move.',{tone:humanThreat?'success':'warning',showMe:false,lock:2600});return}
  }
  if(s.turn!==H){
    if(easyLearningBasicsLearned()&&!guideEnabled){easyLearningHideCoach();return}
    easyLearningSetCoach('Opponent turn',easyLearningGuideCopy()||'Watch the board. Your controls will become active when it comes back to you.',{showMe:false});return
  }
  if(!easyLearningProgress.choose){easyLearningSetCoach('1 · Pick a piece','Choose Rock, Paper, Scissors, or a Decoy.',{tone:'step'});return}
  if(!easyLearningProgress.drop){easyLearningSetCoach('2 · Tap a column','Your piece falls into the column you choose.',{tone:'step'});return}
  if(easyLearningBasicsLearned()&&!guideEnabled){easyLearningHideCoach();return}
  easyLearningSetCoach(guideEnabled?'Guided tip':'Your turn',easyLearningGuideCopy()||'Build toward 4. If pieces meet, the game will show you what happened.',{tone:'quiet'})
}
function easyLearningAfterRender(){
  easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();easyLearningPlaceCoach();
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
    if(!easyLearningProgress.rps){easyLearningMark('rps');lesson.innerHTML=`<strong>${a} vs ${d}</strong><span>${e.o==='tie'?'Same type means neither wins this clash.':`${a} ${e.o==='win'?'beats':'loses to'} ${d}.`} This result stays on screen longer in Easy so you can follow it.</span><button type="button" class="easyCombatWhy">Why?</button>`}
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

const eventDurationBeforeEasyLearning=eventDuration;
eventDuration=function(e){
  const base=eventDurationBeforeEasyLearning(e);if(!easyLearningActive())return base;
  if(e?.kind==='combat')return Math.max(base,e.chainTotal>1&&e.chainIndex>1?EASY_LEARNING_PACING.combatChain:EASY_LEARNING_PACING.combat);
  if(e?.kind==='chain-continue')return Math.max(base,EASY_LEARNING_PACING.chain);
  if(e?.kind==='cooldown-earned')return Math.max(base,EASY_LEARNING_PACING.lock);
  if(['fortified','critical-defense','clashmate'].includes(e?.kind))return Math.max(base,EASY_LEARNING_PACING.special);
  return base
};

const startAiTurnBeforeEasyLearning=startAiTurn;
startAiTurn=async function(){
  if(easyLearningActive()&&ready&&!busy&&!s.winner&&!s.draw&&s.turn===A){
    easyLearningSetCoach('Opponent turn','Take a moment to read the board before the opponent moves.',{showMe:false});
    await new Promise(resolve=>setTimeout(resolve,EASY_LEARNING_PACING.aiBreath));
    if(!easyLearningActive()||!ready||busy||s.winner||s.draw||s.turn!==A)return
  }
  return startAiTurnBeforeEasyLearning()
};

const showEventBeforeEasyLearning=showEvent;
showEvent=function(e){const result=showEventBeforeEasyLearning(e);easyLearningCombatLesson(e);easyLearningSpecialLesson(e);return result};

const renderBeforeEasyLearning=render;
render=function(){const result=renderBeforeEasyLearning();easyLearningAfterRender();return result};

humanInventory?.addEventListener('click',event=>{
  if(!easyLearningActive())return;const choice=event.target?.closest?.('.choice');if(!choice||choice.disabled)return;
  easyLearningSelectedThisTurn=true;easyLearningMark('choose');
  const name=choice.querySelector('.name')?.textContent||'';
  if(name==='Decoy')easyLearningSetCoach('Decoy','It does not fight, but it still counts toward your 4-in-a-row.',{tone:'decoy',showMe:false,lock:2800});
  else easyLearningSetCoach('2 · Tap a column','Now tap a glowing column to drop your piece.',{tone:'step',showMe:true,lock:1400});
  setTimeout(()=>easyLearningPulse('#board .cell[data-column][tabindex="0"]:not(:disabled)',1250),160)
});
function easyLearningRegisterDrop(event){
  if(!easyLearningActive())return;const cell=event.target?.closest?.('#board .cell[data-column][tabindex="0"]');if(!cell||cell.disabled)return;
  easyLearningMark('drop');easyLearningSelectedThisTurn=false;easyLearningSetCoach('Piece dropping','Watch where it lands. If it meets another piece, the clash will stay visible long enough to follow.',{showMe:false,lock:1500})
}
board?.addEventListener('pointerdown',easyLearningRegisterDrop,true);board?.addEventListener('click',easyLearningRegisterDrop,true);
window.addEventListener('resize',easyLearningPlaceCoach,{passive:true});

easyLearningEnsureSetup();easyLearningEnsureCoach();easyLearningSyncSetup();easyLearningAfterRender();
globalThis.easyLearningReset=easyLearningReset;
globalThis.easyLearningShowMe=easyLearningShowMe;
