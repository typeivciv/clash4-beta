import assert from 'node:assert/strict';
import {createHostedHandler} from '../server/vercel-hosted-room.mjs';

const data=new Map();
const handler=createHostedHandler({
  async read(key){return structuredClone(data.get(key)??{rooms:{},etag:null})},
  async write(key,rooms,etag){
    if((data.get(key)?.etag??null)!==etag)return false;
    data.set(key,{rooms:structuredClone(rooms),etag:(etag??0)+1});
    return true
  }
});
const origin='https://typeivciv.github.io';
async function request(route,{method='GET',token,body,source=origin,since}={}){
  const url=new URL('https://test.vercel.app/api/hosted');
  url.searchParams.set('route',route);
  if(since!==undefined)url.searchParams.set('since',since);
  const headers={origin:source};
  if(token)headers.authorization='Bearer '+token;
  if(body)headers['content-type']='application/json';
  const response=await handler(new Request(url,{method,headers,body:JSON.stringify(body)}));
  return {status:response.status,headers:response.headers,data:method==='OPTIONS'?null:await response.json()};
}
assert.equal((await request('health')).status,200);
assert.equal((await request('health',{source:'https://other.example'})).status,403);
const cors=await request('lobbies',{method:'OPTIONS'});
assert.equal(cors.status,204);
assert.equal(cors.headers.get('access-control-allow-origin'),origin);
const created=await request('lobbies',{method:'POST'});
assert.equal(created.status,201);
const host=created.data,room='lobbies/'+host.code;
const joins=await Promise.all([request(room+'/join',{method:'POST'}),request(room+'/join',{method:'POST'})]);
assert.deepEqual(joins.map(j=>j.status).sort(),[200,409]);
const guest=joins.find(j=>j.status===200).data;
assert.equal((await request(room,{token:'0'.repeat(32)})).status,401);
const players={[host.seat]:host.token,[guest.seat]:guest.token};
const ready=await Promise.all([host,guest].map(({token})=>request(room+'/ready',{method:'POST',token})));
assert.deepEqual(ready.map(x=>x.status),[200,200]);
const started=(await request(room,{token:host.token})).data;
assert.equal(started.phase,'active');
assert.equal(started.version,1);
const first=started.state.turn,second=Object.keys(players).find(p=>p!==first);
const moves=await Promise.all([0,1].map(column=>request(room+'/move',{method:'POST',token:players[first],body:{type:'rock',column}})));
assert.deepEqual(moves.map(x=>x.status).sort(),[200,409]);
const secondMove=await request(room+'/move',{method:'POST',token:players[second],body:{type:'paper',column:3}});
assert.equal(secondMove.status,200);
for(const [seat,token] of Object.entries(players)){
  const response=await request(room,{token,since:1});
  assert.equal(response.status,200);
  assert.deepEqual(response.data.updates.map(u=>u.version),[2,3]);
  for(const piece of response.data.state.board.flat())assert.equal(Boolean(piece.type),piece.owner===seat);
}
for(const {rooms} of data.values())for(const r of Object.values(rooms))r.updatedAt=0;
assert.equal((await request(room,{token:host.token})).status,404);
console.log('PASS Vercel Hosted Room concurrent join, ready, move, catch-up, and Fog');
