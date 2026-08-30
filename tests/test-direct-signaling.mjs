import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';

const storeSource=fs.readFileSync('server/direct-signal-store.mjs','utf8');
for(const forbidden of ['10-rules.js','12-duel-projection.js','resolveRaw','projectDuelState','board:','inv:','lastEvents']){
  assert.ok(!storeSource.includes(forbidden),`signaling store must remain game-state blind: ${forbidden}`)
}

const PORT=18788;
const BASE=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,['server/duel-server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',ALLOWED_ORIGIN:'*',RATE_LIMIT:'1000',DIRECT_SIGNAL_TTL_MS:'60000',MAX_SIGNAL_SESSIONS:'20'},
  stdio:['ignore','pipe','pipe']
});
let stderr='';server.stderr.on('data',d=>stderr+=d);

async function request(path,{method='GET',token='',body=null,expect=200}={}){
  const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
  const res=await fetch(BASE+path,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  let data={};try{data=await res.json()}catch{}
  assert.equal(res.status,expect,`${method} ${path}: ${JSON.stringify(data)}`);
  return data
}
async function waitForHealth(){
  for(let i=0;i<60;i++){
    try{const h=await request('/api/health');if(h.ok)return h}catch{}
    await new Promise(r=>setTimeout(r,40))
  }
  throw new Error(`server did not become healthy: ${stderr}`)
}
function assertSignalOnly(payload,label){
  for(const forbidden of ['state','board','events','winner','turn','inventory','moveNumber'])assert.ok(!(forbidden in payload),`${label} leaked game field ${forbidden}`)
}

try{
  const health=await waitForHealth();
  assert.equal(health.directSignalTtlMs,60000);
  assert.equal(health.directSignals,0);

  const offer={type:'offer',sdp:'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=Clash4 Direct Test\r\nt=0 0\r\n'};
  const created=await request('/api/direct/signals',{method:'POST',expect:201,body:{offer}});
  assert.ok(created.id&&created.hostToken&&created.joinToken);
  assert.notEqual(created.hostToken,created.joinToken);
  assertSignalOnly(created,'create');

  const denied=await request(`/api/direct/signals/${created.id}`,{token:'wrong-token',expect:401});
  assert.equal(denied.error,'invalid-signal-token');

  const guest=await request(`/api/direct/signals/${created.id}`,{token:created.joinToken});
  assert.deepEqual(guest.offer,offer);
  assertSignalOnly(guest,'guest offer');

  const waiting=await request(`/api/direct/signals/${created.id}/answer`,{token:created.hostToken});
  assert.equal(waiting.ready,false);
  assertSignalOnly(waiting,'host waiting');

  const answer={type:'answer',sdp:'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\ns=Clash4 Direct Answer\r\nt=0 0\r\n'};
  const accepted=await request(`/api/direct/signals/${created.id}/answer`,{method:'POST',token:created.joinToken,body:{answer}});
  assert.equal(accepted.accepted,true);
  assertSignalOnly(accepted,'guest answer ack');

  const host=await request(`/api/direct/signals/${created.id}/answer`,{token:created.hostToken});
  assert.equal(host.ready,true);
  assert.deepEqual(host.answer,answer);
  assertSignalOnly(host,'host answer');

  const duplicate=await request(`/api/direct/signals/${created.id}/answer`,{method:'POST',token:created.joinToken,body:{answer},expect:409});
  assert.equal(duplicate.error,'signal-answer-already-set');

  const finalHealth=await request('/api/health');
  assert.equal(finalHealth.directSignals,1);
  console.log('PASS one-scan Direct signaling / token isolation / state-blind contract');
}finally{
  server.kill('SIGTERM');
}
