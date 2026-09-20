'use strict';
const PEER_ROOM_HARDENING_VERSION='0.19.1';

// Foundation 0.19 sends the removal notice before dropping the seat from the host map.
// Capture that transport first so the host can explicitly close it after the notice,
// rather than relying on the removed guest to close its own DataConnection.
if(typeof peerRoomKickSeat==='function'&&typeof peerRoomHostReleaseSeat==='function'){
  const peerRoomKickSeatBeforeHardening=peerRoomKickSeat;
  peerRoomKickSeat=function(seat){
    const normalized=Number(seat),conn=peerRoom?.connections?.get?.(normalized)||null;
    if(!Number.isInteger(normalized)||normalized<=1||normalized>PEER_ROOM_MAX_SEATS)return;
    peerRoomHostReleaseSeat(normalized,{block:true});
    if(conn)setTimeout(()=>{try{conn.close()}catch{}},50);
    peerRoomStatus(`Player ${normalized} removed from this room.`,'warn')
  };
  globalThis.peerRoomKickSeat=peerRoomKickSeat;
  globalThis.peerRoomHardening={version:PEER_ROOM_HARDENING_VERSION,previousKick:peerRoomKickSeatBeforeHardening}
}

function peerRoomLoadTransaction(){
  if(typeof document==='undefined')return;
  if(document.querySelector('script[data-peer-room-transaction]'))return;
  const script=document.createElement('script');script.src='src/js/40-peer-room-transaction.js';script.async=false;script.dataset.peerRoomTransaction='script';document.head.append(script)
}
function peerRoomLoadPresentation(){
  if(typeof document==='undefined')return;
  if(!document.querySelector('link[data-peer-room-presentation]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='src/styles/70-peer-room-presentation.css';link.dataset.peerRoomPresentation='style';document.head.append(link)
  }
  const existing=document.querySelector('script[data-peer-room-presentation]');
  if(existing){
    if(globalThis.peerRoomPresentation)peerRoomLoadTransaction();
    else existing.addEventListener('load',peerRoomLoadTransaction,{once:true});
    return
  }
  const script=document.createElement('script');script.src='src/js/39-peer-room-presentation.js';script.async=false;script.dataset.peerRoomPresentation='script';script.addEventListener('load',peerRoomLoadTransaction,{once:true});document.head.append(script)
}
function peerRoomLoadPolish(){
  if(typeof document==='undefined')return;
  if(!document.querySelector('link[data-peer-room-polish]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='src/styles/69-peer-room-polish.css';link.dataset.peerRoomPolish='style';document.head.append(link)
  }
  const existing=document.querySelector('script[data-peer-room-polish]');
  if(existing){
    if(globalThis.peerRoomPolish)peerRoomLoadPresentation();
    else existing.addEventListener('load',peerRoomLoadPresentation,{once:true});
    return
  }
  const script=document.createElement('script');script.src='src/js/38-peer-room-polish.js';script.async=false;script.dataset.peerRoomPolish='script';script.addEventListener('load',peerRoomLoadPresentation,{once:true});document.head.append(script)
}
function peerRoomLoadRuntimeBridge(){
  if(typeof document==='undefined')return;
  const existing=document.querySelector('script[data-peer-room-runtime]');
  if(existing){
    if(globalThis.peerRoomRuntime)peerRoomLoadPolish();
    else existing.addEventListener('load',peerRoomLoadPolish,{once:true});
    return
  }
  const script=document.createElement('script');script.src='src/js/37-peer-room-runtime.js';script.async=false;script.dataset.peerRoomRuntime='script';script.addEventListener('load',peerRoomLoadPolish,{once:true});document.head.append(script)
}

// 0.20 is deliberately layered after the proven 0.19 room transport so the existing
// Direct Duel and room-connection code remain the reference implementation. 0.20.1 adds
// the live-game route/chat bridge, 0.20.2 adds latency/color/navigation polish, 0.20.3
// separates live utilities and aligns presentation, and 0.20.4 makes each move one
// visual transaction while adding same-room rematch voting.
function peerRoomLoadPlayableMatch(){
  if(typeof document==='undefined')return;
  if(!document.querySelector('link[data-peer-room-match]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='src/styles/68-peer-room-match.css';link.dataset.peerRoomMatch='style';document.head.append(link)
  }
  const existing=document.querySelector('script[data-peer-room-match]');
  if(existing){
    if(globalThis.peerRoomMatchApi)peerRoomLoadRuntimeBridge();
    else existing.addEventListener('load',peerRoomLoadRuntimeBridge,{once:true});
    return
  }
  const script=document.createElement('script');script.src='src/js/36-peer-room-match.js';script.async=false;script.dataset.peerRoomMatch='script';script.addEventListener('load',peerRoomLoadRuntimeBridge,{once:true});document.head.append(script)
}
if(typeof document!=='undefined')peerRoomLoadPlayableMatch();
globalThis.peerRoomLoadPlayableMatch=peerRoomLoadPlayableMatch;
globalThis.peerRoomLoadRuntimeBridge=peerRoomLoadRuntimeBridge;
globalThis.peerRoomLoadPolish=peerRoomLoadPolish;
globalThis.peerRoomLoadPresentation=peerRoomLoadPresentation;
globalThis.peerRoomLoadTransaction=peerRoomLoadTransaction;
