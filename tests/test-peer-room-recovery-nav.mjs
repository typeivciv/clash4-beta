import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/42-peer-room-recovery-nav.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');
for(const token of [
  "PEER_ROOM_RECOVERY_NAV_VERSION='0.20.6'",
  'peerRoomRecoveryObserveConnection',
  'peerRoomRecoveryFailConnection',
  'peerRoomRecoveryCreateGuestPeer',
  'peerRoomRecoveryRetryNow',
  'peerRoomScheduleReconnect=function',
  'peerRoomGuestConnect=function',
  "id='c4UniversalBack'",
  "'duelWaitingPanel'",
  "'duelLeaveButton'",
  'peerRoomMatchRequestLobby'
])assert.ok(src.includes(token),`missing recovery/navigation contract: ${token}`);
assert.ok(loader.includes("src/js/42-peer-room-recovery-nav.js"),'0.20.6 must load after presentation sync');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadRecoveryNav"),'0.20.6 must wait for 0.20.5');
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

console.log('PASS Peer Room 0.20.6 recovery/nav: stale WebRTC attempts are retired, retries are single-flight, welcome resets recovery, manual retry is exposed, and Back routing stays outside canonical gameplay');