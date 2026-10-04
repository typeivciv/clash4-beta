import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers=new Map();
const pc={iceConnectionState:'connected',connectionState:'connected',iceGatheringState:'complete',addEventListener(name,fn){handlers.set(name,fn)},async getStats(){return new Map([
  ['local',{type:'local-candidate',candidateType:'srflx',protocol:'udp',address:'203.0.113.1'}],
  ['remote',{type:'remote-candidate',candidateType:'relay',address:'203.0.113.2'}],
  ['pair',{type:'candidate-pair',state:'succeeded',localCandidateId:'local',remoteCandidateId:'remote'}],
  ['transport',{type:'transport',selectedCandidatePairId:'pair'}]
])}};
const ctx={Date,Map,WeakMap,JSON,globalThis:null};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('src/js/46-connection-diagnostics.js','utf8'),ctx);
const conn={peerConnection:pc,on(){}};
ctx.c4ConnectionDiagnostics.observe(conn,'Direct Duel','guest');ctx.c4ConnectionDiagnostics.observe(conn,'Direct Duel','guest');
handlers.get('icecandidateerror')({errorCode:701,url:'turn:relay.example:443?transport=tcp',errorText:'private IP 203.0.113.1'});
const report=await ctx.c4ConnectionDiagnostics.report();const parsed=JSON.parse(report);
assert.equal(parsed.attempts.length,1,'observing a connection twice does not duplicate evidence');
assert.equal(parsed.attempts[0].errors[0].code,701);
assert.deepEqual(parsed.attempts[0].route,{local:'srflx',remote:'relay',protocol:'udp'});
assert.ok(!report.includes('203.0.113.'),'report excludes candidate addresses and free-form server errors');
for(let i=0;i<30;i++)handlers.get('iceconnectionstatechange')();
assert.equal(JSON.parse(await ctx.c4ConnectionDiagnostics.report()).attempts[0].events.length,20,'event history is bounded');
pc.getStats=async()=>{throw Error('closed peer')};
assert.equal(JSON.parse(await ctx.c4ConnectionDiagnostics.report()).attempts[0].errors[0].code,701,'closed connection evidence survives for a phone report');
console.log('PASS connection evidence: selected route, candidate types and ICE errors without addresses or payloads; bounded history survives closed attempts');
