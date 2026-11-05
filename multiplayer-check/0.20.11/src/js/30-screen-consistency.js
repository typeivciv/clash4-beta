'use strict';
// Multiplayer Alpha 0.18.3: screen-to-screen navigation, copy, focus, and modal consistency.
const SCREEN_CONSISTENCY_VERSION='0.18.3';
let screenConsistencyResultVisible=false;
let screenConsistencyAlphaReturnFocus=null;

function screenConsistencyVisible(el){
  return !!el&&el.offsetParent!==null&&getComputedStyle(el).visibility!=='hidden'
}

function screenConsistencyIntroFocusTarget(screen){
  const map={home:'homePlayButton',setup:'setupBackButton',coin:'coinBackButton',duel:'duelBackButton'};
  return document.getElementById(map[screen]||'')
}

function screenConsistencyFocusIntro(screen){
  queueMicrotask(()=>{
    if(helpOverlay?.classList.contains('show'))return;
    const target=screenConsistencyIntroFocusTarget(screen);
    if(screenConsistencyVisible(target))target.focus({preventScroll:true})
  })
}

function screenConsistencyOwnershipPatternCopy(){
  if(matchMode!=='duel')return'You = stripes · AI = dots, so color is never the only cue.';
  if(globalThis.passDuel?.active)return'Player 1 = stripes · Player 2 = dots, so color is never the only cue.';
  const youPattern=localOwner===A?'dots':'stripes';
  const opponentPattern=localOwner===A?'stripes':'dots';
  return`You = ${youPattern} · Opponent = ${opponentPattern}, so color is never the only cue.`
}

function screenConsistencySyncSharedCopy(){
  const fogCopy=document.querySelector('#fogRulesCard .fogNote span:last-child');
  if(fogCopy)fogCopy.textContent=matchMode==='duel'
    ?'Opponent piece types stay hidden. Legitimately revealed survivors hide again after combat.'
    :'AI piece types stay hidden. Legitimately revealed survivors hide again after combat.';

  const ownership=[...document.querySelectorAll('#accessibilityHelp .accessibilityOption')]
    .find(option=>option.querySelector('strong')?.textContent.trim()==='Ownership Patterns');
  const ownershipCopy=ownership?.querySelector('small');
  if(ownershipCopy)ownershipCopy.textContent=screenConsistencyOwnershipPatternCopy();

  const boardSignals=[...document.querySelectorAll('#helpOverlay .helpGrid section')]
    .find(section=>section.querySelector('strong')?.textContent.trim()==='Board Signals');
  const boardSignalsCopy=boardSignals?.querySelector('p');
  if(boardSignalsCopy)boardSignalsCopy.textContent=matchMode==='duel'
    ?'CLASH marks active combat, turn markers show who is active, and a subtle marker preserves the last move.'
    :'CLASH marks active combat, the AI preview marks its committed column, and a subtle marker preserves the last move.';

  const feedbackButton=document.getElementById('betaFeedbackButton');
  if(feedbackButton)feedbackButton.textContent='Report Problem'
}

function screenConsistencyHelpContext(){
  if(coinOverlay?.classList.contains('show')){
    if(document.getElementById('duelLobbyPanel')?.classList.contains('active'))return'Multiplayer';
    if(coinTossPanel?.classList.contains('active'))return'Coin Toss';
    if(matchSetupPanel?.classList.contains('active'))return'Setup';
    if(homePanel?.classList.contains('active'))return'Home'
  }
  if(end?.classList.contains('show'))return'Results';
  if(postMatchView==='review')return'Review';
  return'Match'
}

function screenConsistencySetHelpBackLabel(){
  const context=screenConsistencyHelpContext();
  helpBack.textContent=`Back to ${context}`;
  helpBack.setAttribute('aria-label',`Close help and return to ${context.toLowerCase()}`)
}

const setIntroScreenBeforeScreenConsistency=setIntroScreen;
setIntroScreen=function(next){
  const result=setIntroScreenBeforeScreenConsistency(next);
  screenConsistencySyncSharedCopy();
  screenConsistencyFocusIntro(introScreen);
  return result
};

const openHelpBeforeScreenConsistency=openHelp;
openHelp=function(){
  screenConsistencySyncSharedCopy();
  screenConsistencySetHelpBackLabel();
  return openHelpBeforeScreenConsistency()
};

const renderPostMatchBeforeScreenConsistency=renderPostMatch;
renderPostMatch=function(reviewMode){
  const result=renderPostMatchBeforeScreenConsistency(reviewMode);
  const visible=end.classList.contains('show');
  if(visible&&!screenConsistencyResultVisible){
    queueMicrotask(()=>{
      if(end.classList.contains('show')&&!helpOverlay.classList.contains('show'))end.focus({preventScroll:true})
    })
  }
  screenConsistencyResultVisible=visible;
  return result
};

const renderBeforeScreenConsistency=render;
render=function(){
  const result=renderBeforeScreenConsistency();
  screenConsistencySyncSharedCopy();
  return result
};

function screenConsistencyAlphaModal(){return document.getElementById('alphaTesterModal')}
function screenConsistencyAlphaCloseButton(){return document.getElementById('alphaTesterClose')}
function screenConsistencyAlphaIsOpen(){const modal=screenConsistencyAlphaModal();return !!modal&&!modal.hidden}
function screenConsistencyRestoreAlphaFocus(){
  const target=screenConsistencyAlphaReturnFocus;screenConsistencyAlphaReturnFocus=null;
  queueMicrotask(()=>{if(target?.isConnected&&screenConsistencyVisible(target))target.focus({preventScroll:true})})
}

if(typeof alphaTesterOpen==='function'){
  const alphaTesterOpenBeforeScreenConsistency=alphaTesterOpen;
  alphaTesterOpen=function(...args){
    if(!screenConsistencyAlphaReturnFocus&&document.activeElement instanceof HTMLElement)screenConsistencyAlphaReturnFocus=document.activeElement;
    const result=alphaTesterOpenBeforeScreenConsistency(...args);
    queueMicrotask(()=>screenConsistencyAlphaCloseButton()?.focus({preventScroll:true}));
    return result
  }
}
if(typeof alphaTesterClose==='function'){
  const alphaTesterCloseBeforeScreenConsistency=alphaTesterClose;
  alphaTesterClose=function(...args){
    const result=alphaTesterCloseBeforeScreenConsistency(...args);
    screenConsistencyRestoreAlphaFocus();
    return result
  }
}

function screenConsistencyCloseAlphaModal(){
  if(!screenConsistencyAlphaIsOpen())return;
  if(typeof alphaTesterClose==='function')alphaTesterClose();
  else{
    const modal=screenConsistencyAlphaModal();if(modal)modal.hidden=true;
    document.body.classList.remove('alpha-tester-modal-open');screenConsistencyRestoreAlphaFocus()
  }
}

document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const feedback=target.closest('#betaFeedbackButton');
  if(feedback&&typeof alphaReportProblem==='function'){
    event.preventDefault();event.stopImmediatePropagation();screenConsistencyAlphaReturnFocus=feedback;alphaReportProblem();return
  }
  if(!screenConsistencyAlphaIsOpen())return;
  const modal=screenConsistencyAlphaModal();
  if(target.closest('#alphaTesterClose')||target===modal){
    event.preventDefault();event.stopImmediatePropagation();screenConsistencyCloseAlphaModal()
  }
},true);

document.addEventListener('keydown',event=>{
  if(!screenConsistencyAlphaIsOpen())return;
  const modal=screenConsistencyAlphaModal();if(!modal)return;
  if(event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();screenConsistencyCloseAlphaModal();return
  }
  if(event.key==='Tab')trapModalTab(event,modal)
},true);

screenConsistencySyncSharedCopy();
requestAnimationFrame(()=>{screenConsistencySyncSharedCopy();try{queueFit()}catch{}});
globalThis.SCREEN_CONSISTENCY_VERSION=SCREEN_CONSISTENCY_VERSION;
globalThis.screenConsistencySyncSharedCopy=screenConsistencySyncSharedCopy;
globalThis.screenConsistencyHelpContext=screenConsistencyHelpContext;
