import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/42-peer-room-recovery-nav.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');
for(const token of [
  "PEER_ROOM_RECOVERY_NAV_VERSION='0.20.7'",
  'peerRoomRecoveryObserveConnection',
  'peerRoomRecoveryFailConnection',
  'peerRoomRecoveryCreateGuestPeer',
  'peerRoomRecoveryRetryNow',
  'peerRoomScheduleReconnect=function',
  'peerRoomGuestConnect=function',
  "button.id='c4UniversalBack'",
  "'duelWaitingPanel'",
  "'duelLeaveButton'",
  'peerRoomMatchRequestLobby'
])assert.ok(src.includes(token),`missing recovery/navigation contract: ${token}`);
assert.ok(loader.includes("src/js/42-peer-room-recovery-nav.js"),'0.20.7 must load after presentation sync');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadRecoveryNav"),'0.20.7 must wait for 0.20.5');
for(const forbidden of ['s.board=','peerRoomMatch.authority.state=','applyLocalDuelMove(','resolveRaw('])assert.ok(!src.includes(forbidden),`recovery layer must not mutate canonical gameplay: ${forbidden}`);

function emitter(target={}){const handlers=new Map();target.on=(name,fn)=>{if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(fn);return target};target.emit=(name,...args)=>{for(const fn of handlers.get(name)||[])fn(...args)};return target}
function makeConn(){
  const pc=emitter({iceConnectionState:'new',connectionState:'new',addEventListener(name,fn){this.on(name,fn)}});
  const conn=emitter({open:false,closed:false,peerConnection:pc,send(){},close(){if(this.closed)return;this.closed=true;this.open=false;this.emit('close')}});return conn
}
const timers=[];let timerId=0;
const retryButton={hidden:true,addEventListener(){},setAttribute(){}};
const statusEl={after(){}};
const body={append(){},classList:{contains(){return false}},querySelectorAll(){return[]}};
const documentStub={
  body,head:{append(){}},querySelector(){return null},querySelectorAll(){return[]},getElementById(id){if(id==='peerRoomRetryConnection')return retryButton;if(id==='peerRoomStatus')return statusEl;return null},createElement(tag){return tag==='style'?{dataset:{},textContent:''}:{id:'',className:'',type:'',hidden:false,textContent:'',setAttribute(){},addEventListener(){}}}
};
const context={
  console,Date,Math,Number,Object,Array,Map,Set,globalThis:null,document:documentStub,window:{addEventListener(){}},history:{length:1,back(){}},getComputedStyle(){return{display:'block',visibility:'visible',opacity:'1'}},requestAnimationFrame:fn=>fn(),MutationObserver:class{observe(){}},
  setTimeout(fn,delay){const id=++timerId;timers.push({id,fn,delay,cancelled:false});return id},clearTimeout(id){const t=timers.find(x=>x.id===id);if(t)t.cancelled=true},
  PEER_ROOM_PROTOCOL:1,peerRoom:{active:false,role:'guest',intentionalClose:false,hostId:'host-12345678',clientKey:'client_123456789012',peer:null,conn:null,reconnectTimer:null},
  peerRoomStatus(){},peerRoomConnectionConfig(){return{}},peerRoomGuestMessage(){},peerRoomJoin(){},peerRoomGuestConnect(){},peerRoomScheduleReconnect(){},
  peerRoomGuestBind(conn){context.peerRoom.conn=conn;conn.on('open',()=>{context.peerRoom.active=true});conn.on('close',()=>{context.peerRoom.active=false});conn.on('error',()=>{})},
  peerRoomFoundation:{},peerRoomMatch:{phase:'lobby'},peerRoomMatchRequestLobby(){},
  Peer:null
};context.globalThis=context;
vm.createContext(context);vm.runInContext(src,context,{filename:'42-peer-room-recovery-nav.js'});

// Failed pre-open DataConnection is retired and exactly one reconnect timer is queued.
const first=makeConn();context.peerRoomGuestBind(first);assert.equal(context.peerRoom.conn,first);first.emit('error',{type:'webrtc',message:'route failed'});
assert.equal(first.closed,true,'failed DataConnection must be closed');assert.equal(context.peerRoom.conn,null,'failed DataConnection must not remain current');
const pendingReconnect=timers.filter(t=>!t.cancelled&&t.delay<5000);assert.equal(pendingReconnect.length,1,'connection failure must schedule one reconnect, not a dial storm');
assert.equal(retryButton.hidden,false,'manual Retry Connection must be exposed after failure');

// Retry uses one fresh/open peer and does not create parallel dials while connecting.
const made=[];const peer=emitter({open:true,disconnected:false,destroyed:false,connect(){const conn=makeConn();made.push(conn);return conn},reconnect(){}});context.peerRoom.peer=peer;
pendingReconnect[0].fn();assert.equal(made.length,1,'automatic recovery must create one new DataConnection');context.peerRoomGuestConnect();assert.equal(made.length,1,'single-flight guard must prevent parallel WebRTC dials');
const second=made[0];second.open=true;second.emit('open');second.emit('data',{protocol:1,kind:'room-welcome',seat:2});
assert.equal(context.peerRoomRecoveryState.attempt,0,'successful room welcome must reset retry backoff');assert.equal(context.peerRoomRecoveryState.connecting,false);assert.equal(retryButton.hidden,true,'retry action hides after recovery');
first.peerConnection.iceConnectionState='failed';first.peerConnection.emit('iceconnectionstatechange');first.emit('error',{type:'webrtc'});first.emit('close');
assert.equal(context.peerRoomRecoveryState.attempt,0,'retired ICE errors must not increase retry backoff');
assert.equal(context.peerRoom.conn,second,'retired close must not clear the new guest connection');
assert.equal(retryButton.hidden,true,'retired close must not expose retry on a connected guest');

// A live ordinary duel must leave the session, not merely hide its overlay.
let returned=0;context.duelSession={active:true};context.duelReturnToModeHub=options=>{assert.equal(options.notify,true);returned++;context.duelSession.active=false};
context.c4BackAction();assert.equal(returned,1,'regular multiplayer Lobby must tear down the active network session');
assert.ok(src.includes('position:static;flex:0 0 auto;'),'Lobby belongs in the toolbar');

// Connect before the extension chain loads, then replace the handler as those layers do.
const foundation=fs.readFileSync('src/js/34-peer-room-foundation.js','utf8');
const inbox={globalThis:null,peerRoom:{conn:null,intentionalClose:false},PEER_ROOM_PROTOCOL:1,peerRoomGuestMessage(){throw Error('early packet reached incomplete runtime')},peerRoomMatchRenderLobby(){},peerRoomStatus(){},peerRoomSend(){},peerRoomScheduleReconnect(){}};inbox.globalThis=inbox;
vm.createContext(inbox);
vm.runInContext(foundation.slice(foundation.indexOf('globalThis.peerRoom=peerRoom;'),foundation.indexOf('function peerRoomEl('))+foundation.slice(foundation.indexOf('function peerRoomGuestBind('),foundation.indexOf('function peerRoomGuestConnect(')),inbox);
const cold=makeConn();inbox.peerRoomGuestBind(cold);
cold.emit('data',{protocol:1,kind:'room-welcome',seat:2});cold.emit('data',{protocol:1,kind:'room-match-start',version:1});
const received=[];inbox.peerRoomGuestMessage=data=>received.push(data.kind);
inbox.peerRoomGameplayLoaded();assert.deepEqual(received,['room-welcome','room-match-start'],'cold invite packets replay in arrival order into the final handler');
inbox.peerRoomGuestMessage=data=>received.push('latest:'+data.kind);cold.emit('data',{protocol:1,kind:'room-match-payload'});
assert.equal(received.at(-1),'latest:room-match-payload','existing connections resolve handler replacements at delivery time');
inbox.peerRoom.conn=makeConn();cold.emit('data',{protocol:1,kind:'room-match-start'});assert.equal(received.length,3,'retired connection packets cannot enter the new match');
inbox.peerRoom.active=true;cold.emit('close');cold.emit('error');
assert.equal(inbox.peerRoom.active,true,'retired foundation callbacks cannot mark the replacement inactive');

// On the host, a delayed close from a replaced seat must not mark its new connection offline.
const hostRoom={connections:new Map(),seats:[{seat:2,connected:true}]};
const hostCtx={globalThis:null,peerRoom:hostRoom,peerRoomStatus(){},peerRoomBroadcastState(){},peerRoomHostMessage(){}};hostCtx.globalThis=hostCtx;vm.createContext(hostCtx);
vm.runInContext(foundation.slice(foundation.indexOf('function peerRoomHostBind('),foundation.indexOf('function peerRoomHostMessage(')),hostCtx);
const oldHostConn=makeConn();oldHostConn.__peerRoomSeat=2;hostCtx.peerRoomHostBind(oldHostConn);
hostRoom.connections.set(2,makeConn());oldHostConn.emit('close');
assert.equal(hostRoom.seats[0].connected,true,'late old close must preserve the replacement seat online');

console.log('PASS Peer Room 0.20.7 recovery/nav: stale WebRTC attempts are retired, retries are single-flight, welcome resets recovery, manual retry is exposed, and Back routing stays outside canonical gameplay');
