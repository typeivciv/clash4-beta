// Duel 0.15.8: peer-preserving rematch, replay, terminal guard, and animated results.
'use strict';
let duelResultAnimationKey='';
let directRematchVotes={human:false,ai:false};
let directRematchStarting=false;
let duelTerminalGuard=null;

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
function duelPostMatchCopy(outcome){
  if(outcome==='win'){
    endText.textContent='YOU WIN';
    endReason.textContent=s.winReason==='clashmate'?'CLASHMATE · You forced the winning position.':'Victory secured · Your Connect Four is locked in.';
    mobileContextKicker.textContent='DUEL VICTORY';mobileContextTitle.textContent='YOU WIN';mobileContextCopy.textContent='Review the finish, replay it, or challenge them again.'
  }else if(outcome==='loss'){
    endText.textContent='YOU LOSE';
    endReason.textContent='TRY AGAIN · Review the finish or challenge them again.';
    mobileContextKicker.textContent='DUEL DEFEAT';mobileContextTitle.textContent='YOU LOSE · TRY AGAIN';mobileContextCopy.textContent='Review the finish, learn from it, and run it back.'
  }else{
    endText.textContent='DRAW';
    endReason.textContent='No winner this time · Review the board or run it back.';
    mobileContextKicker.textContent='DUEL DRAW';mobileContextTitle.textContent='DRAW';mobileContextCopy.textContent='Review the finish or challenge them again.'
  }
}
function duelPostMatchAnimate(){
  const stage=duelPostMatchEnsureVisual();if(!stage)return;
  const visible=matchMode==='duel'&&(s.winner||s.draw)&&postMatchView==='summary'&&!busy;
  if(!visible){stage.hidden=true;end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter');duelResultAnimationKey='';return}
  const outcome=duelPostMatchOutcome(),key=`${s.moveNumber}:${outcome}:${s.winReason||''}`;
  duelPostMatchCopy(outcome);stage.hidden=false;
  end.classList.remove('duel-result-win','duel-result-loss','duel-result-draw');end.classList.add(`duel-result-${outcome}`);
  const core=stage.querySelector('.duelResultCore span');if(core)core.textContent=outcome==='win'?'✦':outcome==='loss'?'◆':'＝';
  const kicker=end.querySelector('.postMatchDeckKicker');if(kicker)kicker.textContent=outcome==='win'?'DUEL VICTORY':outcome==='loss'?'DUEL DEFEAT':'DUEL DRAW';
  if(key===duelResultAnimationKey)return;
  duelResultAnimationKey=key;end.classList.remove('duel-result-enter');stage.classList.remove('play');void stage.offsetWidth;end.classList.add('duel-result-enter');stage.classList.add('play');
  if(outcome==='win'){try{gameHaptic?.('win')}catch{}}
}
function duelPostMatchReplayControls(){
  if(matchMode!=='duel')return;
  const disabled=!finishReplay?.steps?.length||replayPhase!=='idle';
  for(const button of [replayFinishButton,replayFinishReviewButton,sidebarReplayFinish]){
    button.disabled=disabled;button.hidden=false;button.textContent=replayPhase!=='idle'?'Replaying…':'Replay Finish'
  }
}
function directResetRematchVotes(){directRematchVotes={human:false,ai:false};directRematchStarting=false}
function duelPostMatchActionControls(){
  if(matchMode!=='duel')return;
  const rematchButtons=[restartBottom,reviewRestart,sidebarRematch],newDuelButtons=[homeBottom,reviewHome,sidebarHome];
  if(directDuel?.active){
    const local=directDuel.seat,remote=other(local),localVoted=!!directRematchVotes[local],remoteVoted=!!directRematchVotes[remote];
    const base=s.winner===H?'Rematch':s.draw?'Rematch':'Try Again';
    for(const b of rematchButtons){b.textContent=localVoted?'Waiting…':remoteVoted?'Accept Rematch':base;b.disabled=localVoted||directRematchStarting}
    for(const b of newDuelButtons){b.textContent='New Duel';b.disabled=false}
  }else{
    for(const b of rematchButtons){b.textContent='New Duel';b.disabled=false}
    for(const b of newDuelButtons){b.textContent='New Duel';b.disabled=false}
  }
}
function duelBuildFinishReplay(){
  if(finishReplay?.steps?.length)return;
  const steps=recentInteractions.slice(-2).map(cloneInteractionForReplay);if(steps.length)finishReplay={steps}
}
function duelForceTerminalSummary(){
  if(matchMode!=='duel'||!(s.winner||s.draw)||replayPhase!=='idle')return false;
  if(duelTerminalGuard){clearTimeout(duelTerminalGuard);duelTerminalGuard=null}
  clearPresentationTimers();activePresentation=null;dropPresentation=null;busy=false;hoverCol=null;
  duelStopPolling();duelBuildFinishReplay();postMatchView='summary';directResetRematchVotes();render();queueFit();return true
}
globalThis.duelForceTerminalSummary=duelForceTerminalSummary;
function duelArmTerminalGuard(){
  if(matchMode!=='duel'||!(s.winner||s.draw)||!busy||replayPhase!=='idle'||duelTerminalGuard)return;
  duelTerminalGuard=setTimeout(()=>{duelTerminalGuard=null;duelForceTerminalSummary()},6500)
}
function duelStartDirectRematch(payload){
  if(!payload?.state)return;
  if(duelTerminalGuard){clearTimeout(duelTerminalGuard);duelTerminalGuard=null}
  directResetRematchVotes();
  duelSession.active=false;duelSession.pendingLocal=null;duelSession.deferredPayloads=[];
  end.classList.remove('show','duel-result-win','duel-result-loss','duel-result-draw','duel-result-enter');
  duelBeginActive(payload)
}
function directTryStartRematch(){
  if(directDuel.role!=='host'||directRematchStarting||!directRematchVotes[H]||!directRematchVotes[A])return;
  directRematchStarting=true;
  directDuel.authority={state:makeLocalDuelState(randomDuelStarter()),version:1};
  const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
  const guest=localDuelPayload(directDuel.authority.state,A,1,[],players),host=localDuelPayload(directDuel.authority.state,H,1,[],players);
  directSend({kind:'rematch-start',payload:guest});duelStartDirectRematch(host)
}
function duelRequestDirectRematch(){
  if(!directDuel?.active||!(s.winner||s.draw)||directRematchStarting)return;
  const seat=directDuel.seat;if(directRematchVotes[seat])return;
  directRematchVotes[seat]=true;directSend({kind:'rematch-request'});duelPostMatchActionControls();
  msg('Rematch requested — waiting for your opponent.');if(directDuel.role==='host')directTryStartRematch()
}

// The shared network adapter records the final two viewer-projected interactions.
// A bounded terminal guard prevents a presentation callback from stranding mobile
// in the gameplay shell after the winner has already been received.
duelFinishNetworkPresentation=function(events,column){
  let settled=false,guard=null;
  const done=()=>{
    if(settled)return;settled=true;if(guard)clearTimeout(guard);
    busy=false;
    const deferred=nextDeferredDuelPayload();
    if(deferred){duelAcceptActivePayload(deferred);return}
    if(s.winner||s.draw){
      duelStopPolling();postMatchView='summary';directResetRematchVotes();duelBuildFinishReplay();render();return
    }
    continueTurnController()
  };
  if(events.length){playEvents(events,done,column);if(s.winner||s.draw)guard=setTimeout(done,6500)}else done()
};

const renderPostMatchBeforeDuelResult=renderPostMatch;
renderPostMatch=function(reviewMode){
  const result=renderPostMatchBeforeDuelResult(reviewMode);
  duelPostMatchReplayControls();duelPostMatchActionControls();duelPostMatchAnimate();duelArmTerminalGuard();return result
};

const directHandleMessageBeforePostMatch=directHandleMessage;
directHandleMessage=function(data){
  if(data?.kind==='rematch-request'&&directDuel?.active){
    directRematchVotes[other(directDuel.seat)]=true;duelPostMatchActionControls();msg('Opponent requested a rematch.');if(directDuel.role==='host')directTryStartRematch();return
  }
  if(data?.kind==='rematch-start'&&directDuel?.active&&data.payload){duelStartDirectRematch(data.payload);return}
  if(data?.kind==='leave'&&matchMode==='duel'&&(s.winner||s.draw)){
    directDuel.active=false;directConnectionBadge('offline','Duel complete');duelPostMatchActionControls();return
  }
  return directHandleMessageBeforePostMatch(data)
};
globalThis.directHandleMessage=directHandleMessage;

// A peer closing after the terminal packet is a completed match, not a network error.
// Preserve the result/replay screen instead of replacing it with "Opponent disconnected".
const directBindChannelBeforePostMatch=directBindChannel;
directBindChannel=function(channel){
  const result=directBindChannelBeforePostMatch(channel),normalClose=channel.onclose;
  channel.onclose=()=>{
    if(matchMode==='duel'&&duelSession.active&&(s.winner||s.draw)){
      directDuel.active=false;directConnectionBadge('offline','Duel complete');duelPostMatchActionControls();duelForceTerminalSummary();return
    }
    normalClose?.()
  };
  return result
};
globalThis.directBindChannel=directBindChannel;

// In Direct Duel the left action is a true rematch/try-again; the right action is New Duel.
// Other Duel transports keep the simpler New Duel behavior.
document.addEventListener('click',event=>{
  if(matchMode!=='duel')return;
  const rematch=event.target?.closest?.('#restartBottom,#reviewRestart,#sidebarRematch');
  if(rematch){event.preventDefault();event.stopImmediatePropagation();if(directDuel?.active)duelRequestDirectRematch();else globalThis.duelRouteNewDuel?.();return}
  const newDuel=event.target?.closest?.('#homeBottom,#reviewHome,#sidebarHome');
  if(newDuel){event.preventDefault();event.stopImmediatePropagation();if(duelTerminalGuard){clearTimeout(duelTerminalGuard);duelTerminalGuard=null}globalThis.duelRouteNewDuel?.()}
},true);

duelPostMatchEnsureVisual();
