'use strict';
const PEER_ROOM_PRESENTATION_VERSION='0.20.3';

const peerRoomPresentationState={lastMoveVersion:0};
globalThis.peerRoomPresentationState=peerRoomPresentationState;

function peerRoomPresentationActive(){
  const seat=Number(globalThis.peerRoom?.seat||0);
  return !!(globalThis.peerRoomMatch?.phase==='active'&&!globalThis.peerRoomMatch?.spectator&&(seat===1||seat===2)&&document.body.classList.contains('peer-room-match-active'))
}

function peerRoomPresentationFinishDrop(events,column,delay=TIMING.drop){
  try{clearTimer('drop')}catch{}
  scheduleTimer('drop',()=>{
    dropPresentation=null;
    render();
    duelFinishNetworkPresentation(events,column)
  },Math.max(0,Number(delay)||0))
}

// Peer Room uses one presentation contract for both seats. Every authoritative move gets
// the same drop -> event/clash -> handoff sequence. The guest may begin its own drop
// immediately for responsiveness, but the authoritative reply finishes that same drop
// instead of replacing it or replaying it.
const duelApplyActiveUpdateBeforePeerPresentation=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  if(!peerRoomPresentationActive())return duelApplyActiveUpdateBeforePeerPresentation(payload);
  if(!payload||payload.version<=duelSession.handledVersion)return;

  const before=cloneState(s),after=duelProjectedStateToUi(payload.state),events=(payload.events||[]).map(duelMapEvent),lm=after.lastMove;
  s=after;duelSession.handledVersion=payload.version;peerRoomPresentationState.lastMoveVersion=payload.version;addEventsToStats(events);
  if(lm){publicMoveHistory.push(publicMoveLog(lm.owner,events));if(publicMoveHistory.length>24)publicMoveHistory.shift()}
  recentInteractions.push({before,after:cloneState(after),events:events.map(e=>({...e})),owner:lm?.owner??A,type:lm?.type??null,column:lm?.column??0,moveNumber:after.moveNumber});if(recentInteractions.length>2)recentInteractions.shift();
  busy=true;hoverCol=null;

  const pending=duelSession.pendingLocal;
  const sameLocalMove=!!(pending&&lm?.owner===H&&Number(lm.column)===Number(pending.column));
  const optimistic=!!(sameLocalMove&&pending.peerOptimistic);

  if(optimistic){
    try{clearTimer('peerRoomOptimisticDrop')}catch{}
    try{peerRoomPolishState.previewPending=null}catch{}
    duelSession.pendingLocal=null;
    const elapsed=Math.max(0,Date.now()-Number(pending.previewStartedAt||Date.now()));
    const remaining=Math.max(0,(Number(TIMING.drop)||220)-elapsed);
    if(dropPresentation&&remaining>0){
      // Do not render here: rebuilding the ghost disc would restart its CSS animation.
      peerRoomPresentationFinishDrop(events,lm.column,remaining);
      return
    }
    dropPresentation=null;render();duelFinishNetworkPresentation(events,lm?.column??null);return
  }

  duelSession.pendingLocal=null;
  if(!lm||!Number.isInteger(Number(lm.column))){render();duelFinishNetworkPresentation(events,null);return}

  const column=Number(lm.column),sourceBefore=sameLocalMove&&pending?.before?pending.before:before;
  const ownType=sameLocalMove&&pending?.type?pending.type:lm.type;
  // Own pieces are always visible in a player's projection. If a malformed projection ever
  // removes that type, prefer a safe state render rather than inventing an R/P/S symbol.
  if(lm.owner===H&&!ownType){render();duelFinishNetworkPresentation(events,column);return}

  dropPresentation={
    before:sourceBefore,
    owner:lm.owner,
    type:lm.owner===H?ownType:null,
    column,
    targetRow:dropTargetRow(sourceBefore,column),
    moveNumber:after.moveNumber,
    duration:TIMING.drop
  };
  render();emitFeedback('drop');peerRoomPresentationFinishDrop(events,column,TIMING.drop)
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

function peerRoomPresentationEnsureUtilityBar(){
  let bar=document.getElementById('peerRoomMatchUtilityBar');if(bar)return bar;
  const header=document.querySelector('#appRoot > header')||document.querySelector('header');if(!header)return null;
  bar=document.createElement('div');bar.id='peerRoomMatchUtilityBar';bar.className='peerRoomMatchUtilityBar';bar.hidden=true;bar.setAttribute('aria-label','Peer Room match controls');header.after(bar);return bar
}
function peerRoomPresentationSyncUtilities(){
  const bar=peerRoomPresentationEnsureUtilityBar(),top=document.querySelector('.topActions'),chat=document.getElementById('directChatFab'),lobby=document.getElementById('peerRoomMatchLobbyButton');if(!bar)return;
  const active=peerRoomPresentationActive();
  if(active){
    bar.hidden=false;
    if(lobby&&lobby.parentElement!==bar)bar.append(lobby);
    if(chat&&chat.parentElement!==bar)bar.append(chat)
  }else{
    bar.hidden=true;
    if(top&&chat&&chat.parentElement!==top)top.append(chat);
    if(top&&lobby&&lobby.parentElement!==top)top.prepend(lobby)
  }
}
globalThis.peerRoomPresentationSyncUtilities=peerRoomPresentationSyncUtilities;

const peerRoomMatchEnterPayloadBeforePresentation=peerRoomMatchEnterPayload;
peerRoomMatchEnterPayload=function(payload,matchId,seat=peerRoom?.seat){const out=peerRoomMatchEnterPayloadBeforePresentation(payload,matchId,seat);peerRoomPresentationSyncUtilities();return out};
globalThis.peerRoomMatchEnterPayload=peerRoomMatchEnterPayload;

const peerRoomMatchReturnLocalLobbyBeforePresentation=peerRoomMatchReturnLocalLobby;
peerRoomMatchReturnLocalLobby=function(options={}){const out=peerRoomMatchReturnLocalLobbyBeforePresentation(options);peerRoomPresentationSyncUtilities();return out};
globalThis.peerRoomMatchReturnLocalLobby=peerRoomMatchReturnLocalLobby;

const peerRoomPolishSyncMatchChromeBeforePresentation=peerRoomPolishSyncMatchChrome;
peerRoomPolishSyncMatchChrome=function(){const out=peerRoomPolishSyncMatchChromeBeforePresentation();peerRoomPresentationSyncUtilities();return out};
globalThis.peerRoomPolishSyncMatchChrome=peerRoomPolishSyncMatchChrome;

window.addEventListener('resize',()=>requestAnimationFrame(peerRoomPresentationSyncUtilities),{passive:true});
requestAnimationFrame(peerRoomPresentationSyncUtilities);

globalThis.peerRoomPresentation={version:PEER_ROOM_PRESENTATION_VERSION,active:peerRoomPresentationActive,syncUtilities:peerRoomPresentationSyncUtilities};
