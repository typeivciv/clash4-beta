import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const loader=fs.readFileSync('src/js/33-direct-chat-v2.js','utf8');
const hardening=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

for(const token of [
  'function directChatV2LoadPeerRoomHardening()',
  "script.src='src/js/35-peer-room-hardening.js'",
  "script.addEventListener('load',directChatV2LoadPeerRoomHardening,{once:true})"
])assert.ok(loader.includes(token),`Peer Room loader missing hardening token: ${token}`);

for(const token of [
  "const PEER_ROOM_HARDENING_VERSION='0.19.1'",
  "const normalized=Number(seat),conn=peerRoom?.connections?.get?.(normalized)||null",
  'peerRoomHostReleaseSeat(normalized,{block:true})',
  'if(conn)setTimeout(()=>{try{conn.close()}catch{}},50)',
  'globalThis.peerRoomKickSeat=peerRoomKickSeat'
])assert.ok(hardening.includes(token),`Peer Room hardening missing ${token}`);

const conn={closed:false,close(){this.closed=true}};
let release=null,status='';
const context=vm.createContext({
  Number,console,globalThis:null,PEER_ROOM_MAX_SEATS:4,
  peerRoom:{connections:new Map([[2,conn]])},
  peerRoomKickSeat(){},
  peerRoomHostReleaseSeat(seat,options){release={seat,options}},
  peerRoomStatus(text){status=text},
  setTimeout(fn){fn();return 1}
});
context.globalThis=context;
vm.runInContext(hardening,context);
vm.runInContext('peerRoomKickSeat(2)',context);
assert.equal(release?.seat,2,'host must release the requested guest seat');
assert.equal(release?.options?.block,true,'host must block the removed client identity for this room');
assert.equal(conn.closed,true,'host must explicitly close the removed guest transport');
assert.match(status,/Player 2 removed/);
release=null;vm.runInContext('peerRoomKickSeat(1)',context);assert.equal(release,null,'host seat cannot be removed');

try{new Function(hardening)}catch(error){throw new Error(`Peer Room hardening syntax failed: ${error.message}`)}
console.log('PASS Peer Room 0.19.1 Remove Player hardening: host captures, removes, and closes guest transport without relying on guest cleanup');
