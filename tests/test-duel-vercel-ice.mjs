import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createIceHandler} from '../server/vercel-ice.mjs';

const origin='https://typeivciv.github.io';
const req=(method='GET',ip='192.0.2.1',source=origin)=>new Request('https://example.vercel.app/api/ice',{
  method,headers:{origin:source,'x-vercel-forwarded-for':ip}
});
const url='turns:turn.cloudflare.com:443?transport=tcp';
const env={CF_TURN_KEY_ID:'key-id',CF_TURN_KEY_API_TOKEN:'fixture-private-key'};
let calls=0,clock=0;
const cloud=createIceHandler(env,{clock:()=>clock,fetcher:async (endpoint,options)=>{
  calls++;
  assert.equal(endpoint,'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers');
  assert.equal(options.headers.authorization,'Bearer fixture-private-key');
  assert.equal(options.method,'POST');
  assert.equal(options.redirect,'error');
  assert.equal(JSON.parse(options.body).ttl,14400);
  return Response.json({iceServers:[
    {urls:['stun:stun.cloudflare.com:3478']},
    {urls:[url,url,'turn:turn.cloudflare.com:53','turn:unexpected.example:443'],username:'fixture-user',credential:'fixture-temporary-password'}
  ]},{status:201})
}});
assert.equal((await cloud(req('GET',undefined,'https://other.example'))).status,403);
assert.equal((await cloud(req('OPTIONS'))).status,204);
assert.equal((await cloud(req('POST'))).status,405);
assert.equal(calls,0);
const res=await cloud(req());
assert.equal(res.status,200);
assert.equal(res.headers.get('cache-control'),'no-store');
assert.equal(res.headers.get('access-control-allow-origin'),origin);
const body=await res.json();
assert.ok(body.expiresAt>Date.now()+14390*1000);
assert.deepEqual(body.iceServers,[{urls:[url],username:'fixture-user',credential:'fixture-temporary-password'}]);
assert.ok(!JSON.stringify(body).includes(env.CF_TURN_KEY_API_TOKEN));
for(let i=1;i<24;i++)assert.equal((await cloud(req())).status,200);
assert.equal((await cloud(req())).status,429);
assert.equal((await cloud(req('GET','192.0.2.2'))).status,200);
assert.equal(calls,25);
clock=60000;
assert.equal((await cloud(req())).status,200);
const invalid=createIceHandler(env,{fetcher:async()=>Response.json({iceServers:[]},{status:201})});
const denied=createIceHandler(env,{fetcher:async()=>Response.json({providerDebug:env.CF_TURN_KEY_API_TOKEN},{status:401})});
const partial=createIceHandler({CF_TURN_KEY_ID:env.CF_TURN_KEY_ID});
for(const handler of [invalid,denied,partial,createIceHandler({})]){
  const res=await handler(req());
  assert.equal(res.status,503);
  assert.deepEqual(await res.json(),{ok:false,error:'relay-unavailable'});
}
const turnUrl='turn:relay.example:3478?transport=tcp',secret='s'.repeat(32);
const self=createIceHandler({TURN_URLS:turnUrl,TURN_SHARED_SECRET:secret});
const result=await (await self(req())).json(),[ice]=result.iceServers;
assert.deepEqual(ice.urls,[turnUrl]);
assert.equal(createHmac('sha1',secret).update(ice.username).digest('base64'),ice.credential);
assert.equal(Number(ice.username.split(':')[0])*1000,result.expiresAt);
console.log('PASS Vercel relay credential issuance, CORS, rate limits, and fail-closed behavior');
