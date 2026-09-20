import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/37-peer-room-runtime.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

for(const token of [
  "PEER_ROOM_RUNTIME_VERSION='0.20.1'",
  'peerRoomRuntimeOwnsGameplay',
  'peerRoomMatchMove(owner,type,column)',
  'duelMove=async function',
  'directChatConnected=function',
  'directChatSendText=function',
  "kind:'room-chat-submit'",
  'peerRoomHostAppendChat(1,text,id)',
  'peerRoomMatchEnterPayload=function',
  'peerRoomMatchReturnLocalLobby=function'
])assert.ok(src.includes(token),`missing runtime contract: ${token}`);
assert.ok(loader.includes("src/js/37-peer-room-runtime.js"),'0.20 loader must mount runtime bridge after match module');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadRuntimeBridge"),'runtime bridge must wait for shared-match module load');
const executable=src.replace(/\/\/.*$/gm,'');
assert.equal(/\bduelRequest\s*\(/.test(executable),false,'Peer Room runtime must never call hosted-server transport');

let matchMoves=0,legacyMoves=0,hostChat=0,guestChat=0;
const context={
  console,Math,Date,setTimeout,clearTimeout,
  peerRoom:{seat:1,role:'host',active:true,peer:{destroyed:false},conn:null,chat:[]},
  peerRoomMatch:{phase:'active'},
  peerRoomMatchMove(){matchMoves++},
  move(){legacyMoves++},duelRouteMove(){legacyMoves++},async duelMove(){legacyMoves++},
  DIRECT_CHAT_MAX_MESSAGES:50,DIRECT_CHAT_PROTOCOL:1,PEER_ROOM_PROTOCOL:1,
  directChatState:{messages:[],seenIds:new Set(),open:false,muted:false,unread:0},
  directChatNormalizeText:v=>String(v||'').trim().slice(0,200),
  directChatConnected:()=>false,directChatRender:()=>{},directChatSendText:()=>false,
  directChatCanSendNow:()=>true,directChatMakeId:()=>`id-${hostChat+guestChat+1}`,directChatNoteSend:()=>{},
  directChatEl:()=>null,directChatSyncVisibility:()=>{},directChatClose:()=>{},
  peerRoomRenderChat:()=>{},peerRoomMatchEnterPayload:()=>{},peerRoomMatchReturnLocalLobby:()=>{},
  peerRoomHostAppendChat(){hostChat++},peerRoomSend(_conn,data){if(data?.kind==='room-chat-submit')guestChat++},
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(src,context,{filename:'37-peer-room-runtime.js'});

context.move('human','rock',0);
context.duelRouteMove('human','paper',1);
await context.duelMove('human','scissors',2);
assert.equal(matchMoves,3,'every gameplay seam must route into Peer Room authority');
assert.equal(legacyMoves,0,'Peer Room gameplay must not fall through to hosted Duel');

context.document={body:{classList:{contains:name=>name==='peer-room-match-active'}},createElement:()=>({className:'',setAttribute(){}})};
assert.equal(context.directChatConnected(),true,'host live-match chat should be connected');
assert.equal(context.directChatSendText('hello host'),true,'host should send room chat from universal drawer');
assert.equal(hostChat,1);

context.peerRoom.role='guest';context.peerRoom.seat=2;context.peerRoom.conn={open:true};
assert.equal(context.directChatConnected(),true,'guest live-match chat should be connected');
assert.equal(context.directChatSendText('hello room'),true,'guest should submit room chat through host relay');
assert.equal(guestChat,1);

context.peerRoomMatch.phase='lobby';
context.move('human','rock',0);
assert.equal(legacyMoves,1,'outside Peer Room match the original move path must remain intact');

console.log('PASS Peer Room 0.20.1: live gameplay cannot reach hosted-server Duel and universal room chat routes host/guest traffic correctly');
