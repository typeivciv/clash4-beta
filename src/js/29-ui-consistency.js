// Multiplayer Alpha 0.18.2: state/navigation and viewport consistency fixes.
const UI_CONSISTENCY_VERSION='0.18.2';

function uiConsistencyResetCoinPrompt(){
  try{clearTimer('coin')}catch{}
  try{coin.classList.remove('flipping')}catch{}
  coinStarter=null;
  try{coinFace.textContent='?'}catch{}
  try{coinText.textContent='Pick Heads or Tails'}catch{}
  try{coinSubtext.textContent='The toss decides the first move.'}catch{}
  try{setVisible(coinChoices,true)}catch{}
  try{setVisible(preMatchSetup,true)}catch{}
  try{setVisible(guideToggle,true)}catch{}
  try{setVisible(matchColorControl,true)}catch{}
  try{setVisible(colorChoicePanel,false)}catch{}
  try{setVisible(coinMainPanel,true)}catch{}
  try{setVisible(coinWaitingTopline,true)}catch{}
  try{setVisible(introHelpBar,true)}catch{}
}

function uiConsistencyAbandonPendingCoin(){
  try{clearTimer('coin')}catch{}
  try{resetMatchRuntime(H,{isReady:false})}catch{}
  uiConsistencyResetCoinPrompt()
}

const setIntroScreenBeforeUiConsistency=setIntroScreen;
setIntroScreen=function(next){
  const leavingCoin=introScreen==='coin'&&next!=='coin'&&!ready;
  if(leavingCoin)uiConsistencyAbandonPendingCoin();
  return setIntroScreenBeforeUiConsistency(next)
};

function uiConsistencyTransportCleanup(){
  // Home means "abandon this match" in every active mode, not "hide the board".
  try{if(directDuel?.active)directClosePeer({notify:true})}catch{}
  try{if(passDuel?.active)passReset()}catch{}
  try{if(duelSession?.active)duelClearActiveSession()}catch{}
  try{duelStopPolling()}catch{}
}

function uiConsistencyResetTransientUi(){
  try{clearPresentationTimers()}catch{}
  try{clearAiPlan()}catch{}
  try{clearTimer('coin')}catch{}
  try{clearTimer('quickStarter')}catch{}
  try{overlay.classList.remove('show')}catch{}
  try{end.classList.remove('show','duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter')}catch{}
  try{document.getElementById('fogCombatLogCard')?.classList.add('c4HistoryCollapsed')}catch{}
  try{const t=document.getElementById('c4HistoryToggle');if(t){t.setAttribute('aria-expanded','false');const s=t.querySelector('span');if(s)s.textContent='History'}}catch{}
  try{hoverCol=null;selected='rock';busy=false;ready=false;dropPresentation=null;activePresentation=null}catch{}
}

const initBeforeUiConsistency=init;
init=function(){
  const leavingActiveMode=matchMode==='duel'||!!globalThis.directDuel?.active||!!globalThis.passDuel?.active||!!globalThis.duelSession?.active;
  if(leavingActiveMode)uiConsistencyTransportCleanup();
  const result=initBeforeUiConsistency();
  uiConsistencyResetTransientUi();
  try{resetMatchRuntime(H,{isReady:false})}catch{}
  uiConsistencyResetCoinPrompt();
  try{setMatchControllerMode('arcade',{owner:H})}catch{}
  try{setIntroScreenBeforeUiConsistency('home')}catch{}
  try{render()}catch{}
  try{queueFit()}catch{}
  return result
};
globalThis.returnHomeAndReset=init;

function uiConsistencyComputeLayoutMetrics(width,height){
  const w=Math.max(280,Math.round(width)),h=Math.max(320,Math.round(height));
  const mode=w<620?'mobile':h<960?'compact':'desktop';
  // Gameplay v3 added a column rail above the board. Reserve that height explicitly,
  // plus a small bottom safety margin so the command deck cannot fall below the viewport.
  if(mode==='mobile'){
    const verticalRoom=Math.max(180,h-242);
    return{mode,width:w,height:h,boardWidth:Math.max(240,Math.min(w-10,verticalRoom*4/3,560))}
  }
  const chrome=mode==='compact'?304:438;
  const boardHeight=Math.max(170,h-chrome);
  const horizontalRoom=Math.max(240,w-(mode==='compact'?20:36));
  return{mode,width:w,height:h,boardWidth:Math.max(240,Math.min(horizontalRoom,boardHeight*4/3,mode==='compact'?760:1120))}
}
computeLayoutMetrics=uiConsistencyComputeLayoutMetrics;

requestAnimationFrame(()=>{try{queueFit()}catch{}});
globalThis.UI_CONSISTENCY_VERSION=UI_CONSISTENCY_VERSION;
globalThis.uiConsistencyResetCoinPrompt=uiConsistencyResetCoinPrompt;
globalThis.uiConsistencyComputeLayoutMetrics=uiConsistencyComputeLayoutMetrics;
