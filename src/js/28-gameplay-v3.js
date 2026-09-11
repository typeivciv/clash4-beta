// Gameplay UI v3: board-first interaction rail, player-owned piece icons, and quiet history.
'use strict';
const GAMEPLAY_V3_VERSION='0.18.0';

const GAMEPLAY_V3_ICONS={
  rock:'<svg class="c4PieceIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M9 30 14 16l10-7 11 5 5 12-7 12H17Z"/><path d="m14 16 10 8 11-10M24 24l-7 14M24 24l16 2"/></svg>',
  paper:'<svg class="c4PieceIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M13 7h15l8 8v26H13Z"/><path d="M28 7v9h8M18 23h13M18 29h13M18 35h9"/></svg>',
  scissors:'<svg class="c4PieceIcon" viewBox="0 0 48 48" aria-hidden="true"><circle cx="14" cy="34" r="6"/><circle cx="34" cy="34" r="6"/><path d="M18 30 37 8M30 30 11 8"/></svg>',
  decoy:'<svg class="c4PieceIcon" viewBox="0 0 48 48" aria-hidden="true"><circle cx="20" cy="24" r="12"/><circle cx="29" cy="24" r="12"/><path d="M20 12v24M29 12v24"/></svg>',
  fog:'<svg class="c4UtilityIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M7 18h21c6 0 6-8 0-8-4 0-5 3-5 5M5 25h34c6 0 6-8 0-8-4 0-5 3-5 5M11 32h22c6 0 6 8 0 8-4 0-5-3-5-5"/></svg>',
  lock:'<svg class="c4UtilityIcon" viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="21" width="28" height="20" rx="5"/><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v6"/></svg>',
  shield:'<svg class="c4UtilityIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 38 12v11c0 9-5 15-14 19-9-4-14-10-14-19V12Z"/><path d="m17 24 5 5 10-11"/></svg>',
  reveal:'<svg class="c4UtilityIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24Z"/><circle cx="24" cy="24" r="5"/></svg>',
  swap:'<svg class="c4UtilityIcon" viewBox="0 0 48 48" aria-hidden="true"><path d="M9 16h27l-6-6M39 32H12l6 6"/></svg>'
};

function gameplayV3PieceKind(label=''){
  const value=String(label).toLowerCase();
  if(value.includes('rock')||value.includes('🪨'))return 'rock';
  if(value.includes('paper')||value.includes('📄'))return 'paper';
  if(value.includes('scissor')||value.includes('✂'))return 'scissors';
  if(value.includes('decoy')||value.trim()==='○')return 'decoy';
  return ''
}
function gameplayV3SpecialKind(label=''){
  const value=String(label).toLowerCase();
  if(value.includes('🔒')||value.includes('lock'))return 'lock';
  if(value.includes('🛡')||value.includes('shield')||value.includes('fortif'))return 'shield';
  if(value.includes('👁')||value.includes('reveal'))return 'reveal';
  if(value.includes('swap')||value.includes('↔')||value.includes('⇄'))return 'swap';
  if(value.includes('fog')||value.includes('🌫'))return 'fog';
  return ''
}
function gameplayV3Icon(kind){return GAMEPLAY_V3_ICONS[kind]||''}

function gameplayV3EnsureDropRail(){
  const boardEl=document.getElementById('board');
  if(!boardEl)return null;
  let rail=document.getElementById('c4DropRail');
  if(rail)return rail;
  rail=document.createElement('div');
  rail.id='c4DropRail';rail.className='c4DropRail';rail.setAttribute('aria-label','Choose a column');
  rail.innerHTML=Array.from({length:8},(_,column)=>`<button type="button" class="c4DropTarget" data-column="${column}"><span class="c4DropNumber">${column+1}</span><span class="c4DropPiece"></span></button>`).join('');
  boardEl.before(rail);
  rail.addEventListener('pointerover',event=>{
    const target=event.target?.closest?.('.c4DropTarget');if(!target||target.disabled)return;
    const column=Number(target.dataset.column);if(Number.isNaN(column))return;
    if(typeof hoverCol!=='undefined'&&hoverCol!==column){hoverCol=column;render()}
  });
  rail.addEventListener('pointerleave',()=>{
    if(typeof hoverCol!=='undefined'&&hoverCol!==null){hoverCol=null;render()}
  });
  rail.addEventListener('click',event=>{
    const target=event.target?.closest?.('.c4DropTarget');if(!target||target.disabled)return;
    const column=Number(target.dataset.column);
    const cell=boardEl.querySelector(`button.cell[data-column="${column}"][aria-hidden="false"]`);
    if(cell&&!cell.disabled)cell.click()
  });
  rail.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const buttons=[...rail.querySelectorAll('.c4DropTarget:not(:disabled)')];if(!buttons.length)return;
    const active=document.activeElement,current=Math.max(0,buttons.indexOf(active));
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    event.preventDefault();buttons[next]?.focus()
  });
  return rail
}

function gameplayV3SyncDropRail(){
  const rail=gameplayV3EnsureDropRail(),boardEl=document.getElementById('board');if(!rail||!boardEl)return;
  let selectedKind='rock';
  try{selectedKind=selected||'rock'}catch{}
  for(const target of rail.querySelectorAll('.c4DropTarget')){
    const column=Number(target.dataset.column);
    const cell=boardEl.querySelector(`button.cell[data-column="${column}"][aria-hidden="false"]`);
    target.disabled=!cell||cell.disabled;
    target.classList.toggle('active',!!cell?.classList.contains('hover'));
    target.classList.toggle('critical',!!cell?.classList.contains('criticalColumn'));
    target.setAttribute('aria-label',cell?.getAttribute('aria-label')||`Column ${column+1}`);
    const slot=target.querySelector('.c4DropPiece');if(slot)slot.innerHTML=gameplayV3Icon(selectedKind)
  }
}

function gameplayV3EnhanceInventory(){
  const inventory=document.getElementById('humanInventory');if(!inventory)return;
  for(const button of inventory.querySelectorAll('.choice')){
    const name=button.querySelector('.name')?.textContent||'';
    const kind=gameplayV3PieceKind(name);if(!kind)continue;
    button.dataset.pieceKind=kind;
    button.classList.toggle('c4PrimaryPiece',kind!=='decoy');
    button.classList.toggle('c4UtilityPiece',kind==='decoy');
    const mark=button.querySelector('b');if(mark)mark.innerHTML=gameplayV3Icon(kind)
  }
}

function gameplayV3DecorateBoard(){
  const boardEl=document.getElementById('board');if(!boardEl)return;
  for(const disc of boardEl.querySelectorAll('.disc')){
    if(disc.querySelector(':scope > .c4DiscIcon'))continue;
    const text=[...disc.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent||'').join('').trim();
    const kind=gameplayV3PieceKind(text);if(!kind)continue;
    for(const node of [...disc.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();
    const icon=document.createElement('span');icon.className='c4DiscIcon';icon.dataset.pieceKind=kind;icon.innerHTML=gameplayV3Icon(kind);
    disc.insertBefore(icon,disc.firstChild)
  }
}

function gameplayV3DecorateEvents(){
  for(const mark of document.querySelectorAll('#overlay .fighter b')){
    const kind=gameplayV3PieceKind(mark.textContent||'');if(kind)mark.innerHTML=gameplayV3Icon(kind)
  }
  for(const mark of document.querySelectorAll('#overlay .specialIcon')){
    const kind=gameplayV3SpecialKind(mark.textContent||'');if(!kind)continue;
    mark.innerHTML=gameplayV3Icon(kind)
  }
}

function gameplayV3DecorateFog(){
  const fog=document.querySelector('.fogNoteIcon');if(fog&&fog.dataset.v3Icon!=='1'){fog.dataset.v3Icon='1';fog.innerHTML=gameplayV3Icon('fog')}
}

function gameplayV3EnsureHistoryToggle(){
  const card=document.getElementById('fogCombatLogCard'),title=document.getElementById('fogCombatLogTitle');if(!card||!title)return;
  let toggle=document.getElementById('c4HistoryToggle');
  if(!toggle){
    title.classList.add('c4HistoryTitle');
    toggle=document.createElement('button');toggle.id='c4HistoryToggle';toggle.className='c4HistoryToggle';toggle.type='button';toggle.innerHTML=`${gameplayV3Icon('reveal')}<span>History</span>`;toggle.setAttribute('aria-expanded','false');
    title.appendChild(toggle);card.classList.add('c4HistoryCollapsed');
    toggle.addEventListener('click',()=>{
      const collapsed=card.classList.toggle('c4HistoryCollapsed');toggle.setAttribute('aria-expanded',String(!collapsed));toggle.querySelector('span').textContent=collapsed?'History':'Hide'
    })
  }
}

function gameplayV3Enhance(){
  gameplayV3SyncDropRail();
  gameplayV3EnhanceInventory();
  gameplayV3DecorateBoard();
  gameplayV3DecorateFog();
  gameplayV3EnsureHistoryToggle();
  gameplayV3DecorateEvents();
  document.getElementById('appRoot')?.classList.add('gameplayV3')
}

const renderBeforeGameplayV3=render;
render=function(){const result=renderBeforeGameplayV3();requestAnimationFrame(gameplayV3Enhance);return result};
const showEventBeforeGameplayV3=showEvent;
showEvent=function(event){const result=showEventBeforeGameplayV3(event);requestAnimationFrame(gameplayV3DecorateEvents);return result};

try{new MutationObserver(()=>gameplayV3DecorateEvents()).observe(document.getElementById('overlay'),{subtree:true,childList:true,characterData:true})}catch{}
requestAnimationFrame(gameplayV3Enhance);

globalThis.GAMEPLAY_V3_VERSION=GAMEPLAY_V3_VERSION;
globalThis.gameplayV3Enhance=gameplayV3Enhance;
globalThis.gameplayV3Icon=gameplayV3Icon;
