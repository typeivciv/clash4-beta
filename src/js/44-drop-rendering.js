'use strict';
const DROP_RENDERING_VERSION='0.20.9';

// A falling checker must cross several slots. Keep it out of native button
// descendants, whose painting/clipping differs on older iPhone WebKit builds.
function c4DropInstallStyle(){
  if(document.querySelector('style[data-c4-drop-rendering]'))return;
  const style=document.createElement('style');style.dataset.c4DropRendering='1';
  style.textContent='.c4DropLayer{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:visible}.c4DropLayer .disc.justDropped{pointer-events:none}';
  document.head.append(style)
}
function c4DropLiftGhost(){
  const ghost=board.querySelector('.cell .disc.justDropped');if(!ghost)return null;
  const cell=ghost.closest('.cell'),slot=cell.getBoundingClientRect(),frame=board.getBoundingClientRect();
  const computed=getComputedStyle(ghost),width=parseFloat(computed.width),height=parseFloat(computed.height);
  if(!(width>0&&height>0))return null;
  const distance=ghost.style.getPropertyValue('--drop-distance').trim(),value=parseFloat(distance);
  // Resolve the percentage before moving the element to a different containing
  // block. Both CSS Direct Duel drops and shared-room WAAPI read this same value.
  const distancePx=Number.isFinite(value)?(distance.endsWith('%')?value*height/100:value):-4.2*height;
  const layer=document.createElement('div');layer.className='c4DropLayer';layer.setAttribute('aria-hidden','true');
  ghost.style.position='absolute';ghost.style.left=`${slot.left-frame.left-board.clientLeft+(slot.width-width)/2}px`;
  ghost.style.top=`${slot.top-frame.top-board.clientTop+(slot.height-height)/2}px`;
  ghost.style.width=`${width}px`;ghost.style.height=`${height}px`;ghost.style.setProperty('--drop-distance',`${distancePx}px`);
  layer.append(ghost);board.append(layer);return ghost
}
const renderBoardGridBeforeDropRendering=renderBoardGrid;
renderBoardGrid=function(options){const result=renderBoardGridBeforeDropRendering(options);c4DropLiftGhost();return result};
globalThis.renderBoardGrid=renderBoardGrid;
c4DropInstallStyle();
globalThis.c4DropRendering={version:DROP_RENDERING_VERSION,lift:c4DropLiftGhost};
