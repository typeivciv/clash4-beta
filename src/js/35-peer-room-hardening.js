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

// 0.20 is deliberately layered after the proven 0.19 room transport so the existing
// Direct Duel and room-connection code remain the reference implementation.
function peerRoomLoadPlayableMatch(){
  if(typeof document==='undefined')return;
  if(!document.querySelector('link[data-peer-room-match]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='src/styles/68-peer-room-match.css';link.dataset.peerRoomMatch='style';document.head.append(link)
  }
  if(document.querySelector('script[data-peer-room-match]'))return;
  const script=document.createElement('script');script.src='src/js/36-peer-room-match.js';script.async=false;script.dataset.peerRoomMatch='script';document.head.append(script)
}
if(typeof document!=='undefined')peerRoomLoadPlayableMatch();
globalThis.peerRoomLoadPlayableMatch=peerRoomLoadPlayableMatch;
