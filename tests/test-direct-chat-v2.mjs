import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const js=fs.readFileSync('src/js/33-direct-chat-v2.js','utf8');
const css=fs.readFileSync('src/styles/66-direct-chat-v2.css','utf8');
const keyboard=fs.readFileSync('src/js/32-ios-chat-keyboard.js','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');
const room=fs.readFileSync('src/js/34-peer-room-foundation.js','utf8');
const roomCss=fs.readFileSync('src/styles/67-peer-room-foundation.css','utf8');

for(const token of [
  "const DIRECT_CHAT_V2_VERSION='0.18.7'",
  'function directChatV2IsMobile()',
  'function directChatV2NearBottom(log)',
  'function directChatV2CreateMessage(message)',
  'row.dataset.chatId=message.id',
  "row.classList.remove('is-new')",
  'const existing=new Map(',
  "drawer.classList.toggle('has-draft',length>0)",
  "mute.textContent=directChatState.muted?'Alerts off':'Alerts'",
  "send.textContent='↑'",
  "input.placeholder='Message…'",
  "backdrop.addEventListener('click',()=>directChatClose())",
  'const directChatSetOpenBeforeV2=directChatSetOpen',
  "if(directChatV2IsMobile()){try{drawer.focus",
  "else{try{directChatEl('directChatInput')?.focus",
  "directChatEl('directChatInput')?.blur()",
  'function directChatV2LoadPeerRoomFoundation()',
  "link.href='src/styles/67-peer-room-foundation.css'",
  "script.src='src/js/34-peer-room-foundation.js'",
  'globalThis.directChatV2='
])assert.ok(js.includes(token),`Universal Chat v2 JS missing ${token}`);

for(const forbidden of [
  'directSend(', 'RTCPeerConnection', 'peer.connect(', 'applyLocalDuelMove(', 'resolveRaw(',
  's.board=', 's.inv=', 's.turn=', 's.winner=', 'localStorage.setItem(', 'sessionStorage.setItem(', 'fetch('
])assert.ok(!js.includes(forbidden),`Universal Chat v2 must remain presentation-only: ${forbidden}`);

for(const token of [
  '.directChatDrawer.directChatV2{',
  '.directChatBackdrop{',
  '.directChatV2 .directChatMessage.is-new{',
  '.directChatV2 .directChatForm input{',
  'font-size:16px',
  'env(safe-area-inset-bottom)',
  'body.direct-chat-input-focused .directChatDrawer.directChatV2',
  '--direct-chat-visual-top',
  '--direct-chat-visual-height',
  '.direct-chat-input-focused .directChatV2.has-draft .directChatQuickRow{display:none}',
  'touch-action:pan-y',
  'touch-action:pan-x',
  '@media(orientation:landscape)',
  '@media(prefers-reduced-motion:reduce)'
])assert.ok(css.includes(token),`Universal Chat v2 CSS missing ${token}`);
assert.ok(!css.includes('var(--blue-piece)')&&!css.includes('var(--orange-piece)'),'Universal chat world surface must not borrow player ownership colors');
assert.ok(!css.includes('body.direct-chat-open{overflow:hidden;touch-action:none}'),'mobile chat must not disable scrolling inside its own message log');

for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.7'",
  "input.addEventListener('pointerdown'",
  "body.classList.toggle('direct-chat-keyboard-shown'",
  "DIRECT_CHAT_V2=ROOT/'src/js/33-direct-chat-v2.js'",
  "DIRECT_CHAT_V2_CSS=ROOT/'src/styles/66-direct-chat-v2.css'",
  "direct_chat_v2=DIRECT_CHAT_V2.read_text",
  "direct_chat+ios_chat_keyboard+direct_chat_v2+anchor",
  'viewport-fit=cover,interactive-widget=resizes-content'
])assert.ok((token.includes('DIRECT_CHAT_V2')||token.includes('direct_chat_v2')||token.includes('viewport-fit')||token.includes('+anchor'))?builder.includes(token):keyboard.includes(token),`Universal Chat packaging/keyboard token missing ${token}`);

for(const token of [
  "const PEER_ROOM_VERSION='0.19.0'",
  'const PEER_ROOM_MAX_SEATS=4',
  "const PEER_ROOM_JOIN_PARAM='c4room'",
  "const PEER_ROOM_HOST_PARAM='c4hostroom'",
  "const PEER_ROOM_HOST_STORAGE='clash4.peerRoomHost.v1'",
  'function peerRoomCreateHost()',
  'function peerRoomRestoreHost(snapshot)',
  'function peerRoomJoin(hostId)',
  "new Peer(peerRoom.hostId,{debug:0,config:peerRoomConnectionConfig()})",
  "peer.on('connection',peerRoomHostBind)",
  "peer.connect(peerRoom.hostId,{reliable:true,serialization:'json'",
  "kind:'room-join'",
  "kind:'room-welcome'",
  "kind:'room-state'",
  "kind:'room-projection'",
  "kind:'room-chat-submit'",
  "kind:'room-chat'",
  "kind:'room-ping'",
  "kind:'room-pong'",
  'function peerRoomProjectionFor(seat)',
  'privateToken:peerRoom.privateTokens[seat]',
  'function peerRoomBroadcastProjections()',
  'function peerRoomScheduleReconnect()',
  "document.addEventListener('visibilitychange',peerRoomLifecycleResume)",
  "window.addEventListener('online',peerRoomLifecycleResume)",
  'function peerRoomPersistHost()',
  'function peerRoomReadHostSnapshot(',
  "mode.innerHTML='<span class=\"duelModeIcon\">◉</span><strong>Peer Room · 2–4</strong>",
  'globalThis.peerRoomFoundation='
])assert.ok(room.includes(token),`Peer Room 0.19 contract missing ${token}`);

for(const forbidden of [
  'applyLocalDuelMove(', 'resolveRaw(', 'detectClashmate(', 'criticalColsFor(',
  'localDuelPayload(', 's.board=', 's.inv=', 's.turn=', 's.winner=', '/api/', 'fetch('
])assert.ok(!room.includes(forbidden),`Peer Room foundation must stay outside Clash 4 gameplay/server authority: ${forbidden}`);

for(const token of [
  '.peerRoomPanel{', '.peerRoomLive{', '.peerRoomSeats{', '.peerRoomProjection{',
  '.peerRoomChat{', '.peerRoomChatForm input{', 'font-size:16px', '@media(max-width:520px)',
  '@media(prefers-reduced-motion:reduce)'
])assert.ok(roomCss.includes(token),`Peer Room CSS missing ${token}`);
assert.ok(!roomCss.includes('var(--blue-piece)')&&!roomCss.includes('var(--orange-piece)'),'Peer Room atmosphere must remain independent from player ownership colors');

// Protocol simulation: exercise the actual authority helpers in a minimal browser-like VM.
const store=new Map();
const context=vm.createContext({
  console,Date,Math,JSON,Map,Set,URLSearchParams,Uint8Array,
  crypto:{getRandomValues(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=(i*29+17)%256;return bytes}},
  localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
  location:{hash:'',origin:'https://example.test',pathname:'/clash4-beta/multiplayer-alpha.html',search:''},
  history:{replaceState(){}},navigator:{},
  document:{readyState:'loading',hidden:false,addEventListener(){},getElementById(){return null},querySelector(){return null},createElement(){return{}}},
  window:{innerHeight:800,addEventListener(){},matchMedia(){return{matches:false}}},
  setTimeout(){return 1},clearTimeout(){},
  globalThis:null
});
context.globalThis=context;
vm.runInContext(room,context);
vm.runInContext(`
  peerRoom.role='host';peerRoom.active=true;peerRoom.hostId='c4r-test-room';peerRoom.roomId='ABC123';peerRoom.seat=1;
  peerRoom.roomVersion=1;peerRoom.projectionVersion=1;peerRoom.seats=peerRoomDefaultSeats();peerRoom.privateTokens={1:'HOST-A',2:'SEAT2-A',3:'SEAT3-A',4:'SEAT4-A'};
  peerRoom.connections=new Map();peerRoom.seatByClient=new Map();peerRoom.blocked=new Set();peerRoom.chat=[];
  sent=[];
  function fake(name){return{name,open:true,closed:false,send(data){sent.push({name,data})},close(){this.closed=true}}}
  a=fake('a');b=fake('b');c=fake('c');d=fake('d');a2=fake('a2');
`,context);
assert.equal(vm.runInContext("peerRoomHostAssign(a,'client_aaaaaaaaaaaa')",context),2,'first guest should receive seat 2');
assert.equal(vm.runInContext("peerRoomHostAssign(b,'client_bbbbbbbbbbbb')",context),3,'second guest should receive seat 3');
assert.equal(vm.runInContext("peerRoomHostAssign(c,'client_cccccccccccc')",context),4,'third guest should receive seat 4');
assert.equal(vm.runInContext("peerRoomHostAssign(d,'client_dddddddddddd')",context),null,'fifth total participant must be rejected when room is full');
assert.ok(vm.runInContext("sent.some(x=>x.name==='d'&&x.data.kind==='room-full')",context),'full room must explicitly reject the extra guest');
assert.equal(vm.runInContext("peerRoomHostAssign(a2,'client_aaaaaaaaaaaa')",context),2,'reconnecting client must reclaim its reserved seat');
assert.equal(vm.runInContext("a.closed",context),true,'reconnect must retire the stale connection for that seat');
const projection=vm.runInContext('peerRoomProjectionFor(2)',context);
assert.equal(projection.seat,2);assert.equal(projection.privateToken,'SEAT2-A');
const publicState=vm.runInContext('peerRoomPublicState()',context);
assert.equal(publicState.seats.length,4);assert.ok(publicState.seats.every(seat=>!('clientKey' in seat)),'public roster must never expose client keys');
assert.ok(!JSON.stringify(publicState).includes('SEAT2-A'),'public roster must never expose private projection tokens');
vm.runInContext("peerRoomHostAppendChat(2,'  hello   room  ','msg_123456')",context);
assert.equal(vm.runInContext('peerRoom.chat.at(-1).text',context),'hello room','host must normalize authoritative room chat');
assert.ok(vm.runInContext("sent.some(x=>x.data.kind==='room-chat'&&x.data.message.text==='hello room')",context),'host must broadcast authoritative chat');
vm.runInContext('peerRoomPersistHost()',context);
assert.ok(store.has('clash4.peerRoomHost.v1'),'host room snapshot must persist locally for reload recovery');

try{new Function(js)}catch(error){throw new Error(`Universal Chat v2 syntax failed: ${error.message}`)}
try{new Function(room)}catch(error){throw new Error(`Peer Room foundation syntax failed: ${error.message}`)}
console.log('PASS Universal Chat + Multiplayer Foundation 0.19: simulated 4-seat authority, full-room rejection, seat reclaim, private projection isolation, authoritative chat, reconnect hooks, and host persistence stay outside gameplay rules');
