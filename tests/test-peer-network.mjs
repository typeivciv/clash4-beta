import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/js/45-peer-network.js','utf8');
function fixture(fetch){
  const context={fetch,AbortController,setTimeout,clearTimeout,URL,Date,console,location:{href:'https://example.test/multiplayer-alpha.html'},DIRECT_RTC_CONFIG:{iceServers:[{urls:'stun:example.test:3478'}]}};
  context.globalThis=context;vm.createContext(context);vm.runInContext(source,context);return context
}
const server={urls:'turns:relay.example.test:443?transport=tcp',username:'limited-client',credential:'client-password'};
let release,requests=0;
const deferred=fixture(()=>{requests++;return new Promise(resolve=>{release=resolve})});
const first=deferred.c4PreparePeerNetwork(),second=deferred.c4PreparePeerNetwork();
assert.equal(requests,1,'host/guest setup must share one pending configuration request');
assert.equal(deferred.DIRECT_RTC_CONFIG.iceServers.length,1,'do not install credentials before the configuration resolves');
release({ok:true,json:async()=>({iceServers:[server]})});await Promise.all([first,second]);
assert.equal(deferred.DIRECT_RTC_CONFIG.iceServers.length,2);
assert.equal(deferred.c4PeerNetwork.state.source,'configured');
assert.equal(deferred.DIRECT_RTC_CONFIG.iceServers[1].urls[0],server.urls);
await deferred.c4PreparePeerNetwork();assert.equal(requests,1,'cached configuration does not add duplicate relay entries');

let calls=0;
const endpoint=fixture(async url=>{calls++;return {ok:true,json:async()=>calls===1?{credentialEndpoint:'https://credentials.example.test/ice'}:[server]}});
await endpoint.c4PreparePeerNetwork();assert.equal(calls,2);assert.equal(endpoint.c4PeerNetwork.state.source,'configured');
const invalid=fixture(async()=>({ok:true,json:async()=>({iceServers:[{urls:'https://invalid.test',username:'u',credential:'p'}]})}));
await assert.rejects(invalid.c4PreparePeerNetwork(),/TURN addresses/);assert.equal(invalid.DIRECT_RTC_CONFIG.iceServers.length,1);
const insecure=fixture(async()=>({ok:true,json:async()=>({credentialEndpoint:'http://credentials.test'})}));
await assert.rejects(insecure.c4PreparePeerNetwork(),/HTTPS/);
const missing=fixture(async()=>({ok:false}));await assert.rejects(missing.c4PreparePeerNetwork(),/could not load/);
const empty=fixture(async()=>({ok:true,json:async()=>({iceServers:[]})}));await empty.c4PreparePeerNetwork();assert.equal(empty.c4PeerNetwork.state.source,'legacy');

// Exercise the actual async Direct host/guest entry functions with cancelled
// configuration requests. A Back/new-session action must not create a late peer.
const nearby=fs.readFileSync('src/js/19-duel-nearby-qr.js','utf8');
for(const [start,end,call] of [
  ['async function directCreateNearby()','globalThis.directCreateNearby=',ctx=>ctx.directCreateNearby()],
  ['async function directJoinNearbyFromPeerId(','function directRetryNearbyConnection()',ctx=>ctx.directJoinNearbyFromPeerId('host-1234')]
]){
  let prepared,created=0;
  const ctx={directPeerSession:{},directDuel:{},directOpenPanel(){},directRecoveryActions(){},directPeerReset(){ctx.directPeerSession={}},directNearbyStage(){},c4PreparePeerNetwork(){return new Promise(resolve=>prepared=resolve)},directCreatePeer(){created++;return {on(){}}}};
  vm.createContext(ctx);vm.runInContext(nearby.slice(nearby.indexOf(start),nearby.indexOf(end)),ctx);
  const result=call(ctx);assert.equal(created,0,'connection must wait for relay setup');ctx.directPeerReset();prepared();await result;assert.equal(created,0,'cancelled setup cannot resurrect the invite');
}
console.log('PASS shared peer network: deferred credentials, HTTPS endpoint, validation, cache, and cancelled Direct invite startup');
