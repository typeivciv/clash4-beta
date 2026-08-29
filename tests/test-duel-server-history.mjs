import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const PORT=18787;
const BASE=`http://127.0.0.1:${PORT}`;
const server=spawn(process.execPath,['server/duel-server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(PORT),HOST:'127.0.0.1',ALLOWED_ORIGIN:'*',RATE_LIMIT:'1000',UPDATE_HISTORY_LIMIT:'4'},
  stdio:['ignore','pipe','pipe']
});
let stderr='';server.stderr.on('data',d=>stderr+=d);

async function request(path,{method='GET',token=null,body=null}={}){
  const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
  const res=await fetch(BASE+path,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok)throw new Error(`${res.status} ${JSON.stringify(data)}`);
  return data
}
async function waitForHealth(){
  for(let i=0;i<50;i++){
    try{const h=await request('/api/health');if(h.ok)return h}catch{}
    await new Promise(r=>setTimeout(r,50))
  }
  throw new Error(`server did not become healthy: ${stderr}`)
}

try{
  const health=await waitForHealth();
  assert.equal(health.updateHistory,4);

  const created=await request('/api/lobbies',{method:'POST',body:{}});
  const joined=await request(`/api/lobbies/${created.code}/join`,{method:'POST',body:{}});
  const tokens={human:created.token,ai:joined.token};

  await request(`/api/lobbies/${created.code}/ready`,{method:'POST',token:tokens.human,body:{}});
  const started=await request(`/api/lobbies/${created.code}/ready`,{method:'POST',token:tokens.ai,body:{}});
  assert.equal(started.phase,'active');
  assert.equal(started.version,1);

  let turn=started.state.turn;
  const columns=[0,0,2,2,4,4];
  for(const column of columns){
    const moved=await request(`/api/lobbies/${created.code}/move`,{method:'POST',token:tokens[turn],body:{type:'decoy',column}});
    assert.equal(moved.phase,'active');
    turn=moved.state.turn;
  }

  const p1Gap=await request(`/api/lobbies/${created.code}?since=1`,{token:tokens.human});
  assert.equal(p1Gap.version,7);
  assert.equal(p1Gap.historyGap,true);
  assert.deepEqual(p1Gap.updates.map(x=>x.version),[4,5,6,7]);

  const recent=await request(`/api/lobbies/${created.code}?since=5`,{token:tokens.human});
  assert.equal(recent.historyGap,false);
  assert.deepEqual(recent.updates.map(x=>x.version),[6,7]);

  const current=await request(`/api/lobbies/${created.code}?since=7`,{token:tokens.human});
  assert.equal(current.historyGap,false);
  assert.deepEqual(current.updates,[]);

  // Start a second room to verify two missed versions are returned in order and
  // each viewer still receives only their permitted Fog projection.
  const c2=await request('/api/lobbies',{method:'POST',body:{}});
  const j2=await request(`/api/lobbies/${c2.code}/join`,{method:'POST',body:{}});
  const t2={human:c2.token,ai:j2.token};
  await request(`/api/lobbies/${c2.code}/ready`,{method:'POST',token:t2.human,body:{}});
  const s2=await request(`/api/lobbies/${c2.code}/ready`,{method:'POST',token:t2.ai,body:{}});
  let first=s2.state.turn,second=first==='human'?'ai':'human';
  await request(`/api/lobbies/${c2.code}/move`,{method:'POST',token:t2[first],body:{type:'rock',column:0}});
  await request(`/api/lobbies/${c2.code}/move`,{method:'POST',token:t2[second],body:{type:'paper',column:2}});

  const humanCatchup=await request(`/api/lobbies/${c2.code}?since=1`,{token:t2.human});
  const aiCatchup=await request(`/api/lobbies/${c2.code}?since=1`,{token:t2.ai});
  assert.deepEqual(humanCatchup.updates.map(x=>x.version),[2,3]);
  assert.deepEqual(aiCatchup.updates.map(x=>x.version),[2,3]);
  assert.equal(humanCatchup.historyGap,false);
  assert.equal(aiCatchup.historyGap,false);

  const humanFinal=humanCatchup.updates.at(-1).state.board;
  const aiFinal=aiCatchup.updates.at(-1).state.board;
  for(const col of humanFinal)for(const piece of col){
    if(piece.owner==='human')assert.ok(piece.type,'human viewer must see own type');
    else assert.equal(piece.type,null,'human viewer must not see hidden opponent type');
  }
  for(const col of aiFinal)for(const piece of col){
    if(piece.owner==='ai')assert.ok(piece.type,'ai viewer must see own type');
    else assert.equal(piece.type,null,'ai viewer must not see hidden opponent type');
  }

  console.log('PASS duel server update history / ordered catch-up / Fog projection');
}finally{
  server.kill('SIGTERM');
}
