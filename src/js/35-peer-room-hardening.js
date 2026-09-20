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
