// Pass & Play: two players share one device with an opaque privacy handoff between turns.
// The canonical state stays local; each player only receives their own Fog projection.
'use strict';
let passDuel={active:false,state:null,viewer:null,version:0};
function passEl(id){return document.getElementById(id)}
function passPlayerLabel(owner){return owner===H?'Player 1':'Player 2'}
function ensurePassOverlay(){
  let el=passEl('passDuelOverlay');if(el)return el;
  el=document.createElement('div');el.id='passDuelOverlay';el.className='passDuelOverlay';el.hidden=true;
  el.innerHTML='<div class="passDuelCard"><div class="eyebrow">PASS & PLAY</div><h2 id="passDuelTitle">Pass the device</h2><p id="passDuelCopy">Only the next player should look at the screen.</p><div class="passDuelShield" aria-hidden="true">◈</div><button id="passDuelContinue" class="duelPrimary" type="button">I have the device</button><button id="passDuelExit" class="duelLeaveButton" type="button">End Pass & Play</button></div>';
  document.body.append(el);passEl('passDuelContinue').addEventListener('click',passConfirmHandoff);passEl('passDuelExit').addEventListener('click',duelLeaveAllToHome);return el
}
function passShowHandoff(nextOwner,{opening=false}={}){
  const el=ensurePassOverlay();el.hidden=false;passEl('passDuelTitle').textContent=opening?`${passPlayerLabel(nextOwner)} starts`:`Pass to ${passPlayerLabel(nextOwner)}`;
  passEl('passDuelCopy').textContent=`Only ${passPlayerLabel(nextOwner)} should look at the screen. Tap below when the other player cannot see it.`;
  passEl('passDuelContinue').textContent=`I'm ${passPlayerLabel(nextOwner)}`;document.documentElement.classList.add('pass-privacy-active')
}
function passHideOverlay(){const el=passEl('passDuelOverlay');if(el)el.hidden=true;document.documentElement.classList.remove('pass-privacy-active')}
function passReset(){passDuel={active:false,state:null,viewer:null,version:0};passHideOverlay()}
globalThis.passReset=passReset;
function startPassPlay(){
  directClosePeer();duelStopPolling();duelClearActiveSession();passReset();passDuel.active=true;passDuel.state=makeLocalDuelState(randomDuelStarter());passDuel.viewer=passDuel.state.turn;passDuel.version=1;
  duelSession.seat=passDuel.viewer;duelSession.active=false;duelSession.version=-1;duelSession.handledVersion=-1;duelSession.pendingLocal=null;duelSession.deferredPayloads=[];
  setMatchControllerMode('duel',{owner:H});ensurePassOverlay();passShowHandoff(passDuel.viewer,{opening:true});
  const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}],payload=localDuelPayload(passDuel.state,passDuel.viewer,passDuel.version,[],players);
  duelBeginActive(payload);quickStarterBanner.hidden=true;busy=true;ready=true;msg('Pass & Play — hand the device to the starting player.')
}
globalThis.startPassPlay=startPassPlay;
function passConfirmHandoff(){
  if(!passDuel.active||!passDuel.state)return;passDuel.viewer=passDuel.state.turn;duelSession.seat=passDuel.viewer;
  const projected=projectDuelState(passDuel.state,passDuel.viewer,{revealAll:!!(passDuel.state.winner||passDuel.state.draw)});s=duelProjectedStateToUi(projected);busy=false;ready=true;hoverCol=null;quickStarterBanner.hidden=true;
  // Combat/move history is viewer-relative ("You"/"Opponent"). Clear it at handoff so the
  // next player never inherits mislabeled or privacy-sensitive presentation from the prior view.
  publicMoveHistory=[];recentInteractions=[];passHideOverlay();render();queueFit();msg(`${passPlayerLabel(passDuel.viewer)} — your turn.`)
}
function passFinishPresentation(events,column){
  const done=()=>{
    busy=false;if(passDuel.state.winner||passDuel.state.draw){postMatchView='summary';finishReplay=null;const finalProjected=projectDuelState(passDuel.state,passDuel.viewer,{revealAll:true});s=duelProjectedStateToUi(finalProjected);render();return}
    passShowHandoff(passDuel.state.turn);msg('Turn complete — pass the device.')
  };
  if(events.length)playEvents(events,done,column);else done()
}
function passDuelMove(owner,type,column){
  if(!passDuel.active||!ready||busy||!passDuel.state||passDuel.state.winner||passDuel.state.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  const viewer=passDuel.viewer,before=cloneState(s),q=applyLocalDuelMove(passDuel.state,viewer,type,c);if(q.error){msg(humanizeDuelError(q.error));return}
  passDuel.state=q.state;passDuel.version++;
  duelSession.seat=viewer;const projected=projectDuelState(passDuel.state,viewer,{revealAll:!!(passDuel.state.winner||passDuel.state.draw)}),after=duelProjectedStateToUi(projected),events=projectEventsForViewer(q.events,viewer).map(duelMapEvent),lm=after.lastMove;
  s=after;addEventsToStats(events);if(lm){publicMoveHistory.push(publicMoveLog(lm.owner,events));if(publicMoveHistory.length>24)publicMoveHistory.shift()}
  recentInteractions.push({before,after:cloneState(after),events:events.map(e=>({...e})),owner:lm?.owner??H,type:lm?.type??type,column:lm?.column??c,moveNumber:after.moveNumber});if(recentInteractions.length>2)recentInteractions.shift();
  busy=true;hoverCol=null;dropPresentation={before,owner:H,type,column:c,targetRow:dropTargetRow(before,c),moveNumber:after.moveNumber,duration:TIMING.drop};render();emitFeedback('drop');
  scheduleTimer('drop',()=>{dropPresentation=null;render();passFinishPresentation(events,c)},TIMING.drop)
}
globalThis.passDuelMove=passDuelMove;
function bindPassPlayUi(){passEl('duelPassMode')?.addEventListener('click',startPassPlay)}
globalThis.bindPassPlayUi=bindPassPlayUi;
