import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function emitter(fields={}){
  const events=new Map();
  return Object.assign(fields,{on(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);return this},emit(name,...args){for(const fn of events.get(name)||[])fn(...args)}});
}
function connection(){
  const pc=emitter({iceConnectionState:'new',connectionState:'new',addEventListener(name,fn){this.on(name,fn)}});
  return emitter({peerConnection:pc,close(){},send(){}});
}
const statuses=[];
const ctx={console,URLSearchParams,Date,setTimeout(){return 1},clearTimeout(){},DIRECT_RTC_CONFIG:{iceServers:[]},H:1,A:2,duelSession:{},directDuel:{active:false},location:{hash:''},history:{},directEl(){return null},queueFit(){},directSetStatus(text){statuses.push(text)},directConnectionBadge(){},directClosePeer(){},directCreate(){},directOpenPanel(){},
  directBindChannel(channel){ctx.directDuel.channel=channel;channel.onopen=()=>{ctx.directDuel.active=true};channel.onmessage=()=>{ctx.messages++};channel.onclose=()=>{ctx.directDuel.active=false}},messages:0};
ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/js/19-duel-nearby-qr.js','utf8'),ctx);
vm.runInContext("directPeerSession.role='guest';directNearbyRetryPeerId='host-12345678'",ctx);
const old=connection();ctx.directBindPeerJsConnection(old);
ctx.directPeerReset();vm.runInContext("directPeerSession.role='guest'",ctx);
const current=connection();ctx.directBindPeerJsConnection(current);current.emit('open');
const before=statuses.length;
old.emit('close');old.emit('error',{type:'webrtc'});old.emit('data',{kind:'leave'});
old.peerConnection.iceConnectionState='failed';old.peerConnection.emit('iceconnectionstatechange');
assert.equal(ctx.directDuel.active,true,'late close/error from a retired attempt must not disconnect the replacement');
assert.equal(ctx.messages,0,'retired connection packets must not reach current gameplay');
assert.equal(statuses.length,before,'retired ICE events must not overwrite current connection status');

// A late PeerJS open/error/disconnect from a refreshed host must not affect the new invite.
const peers=[];ctx.Peer=function(){const peer=emitter({disconnect(){}});peers.push(peer);return peer};
ctx.directPeerReset();ctx.directCreatePeer('host');ctx.directPeerReset();ctx.directCreatePeer('host');
const count=statuses.length;peers[0].emit('error',{type:'network'});peers[0].emit('disconnected');
assert.equal(statuses.length,count,'retired broker callbacks must be ignored');
console.log('PASS Direct retry isolation: retired packets, close, ICE and broker events cannot mutate a replacement session');
