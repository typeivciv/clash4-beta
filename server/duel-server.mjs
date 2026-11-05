#!/usr/bin/env node
import http from 'http';
import crypto from 'crypto';
import {createDirectSignalStore,DirectSignalError} from './direct-signal-store.mjs';
import {createTurnIssuer} from './turn-credentials.mjs';
import {ROOM_TTL_MS,UPDATE_HISTORY_LIMIT,CODE_ALPHABET,A,token,now,touch,playerFor,parseSince,projectedPayload,lobbyStatus,newLobby,startIfReady,applyMove} from './hosted-room-core.mjs';

const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||'0.0.0.0';
const MAX_ROOMS=Number(process.env.MAX_ROOMS||500);
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'*';
const RATE_WINDOW_MS=60_000,RATE_LIMIT=Number(process.env.RATE_LIMIT||240);
const DIRECT_SIGNAL_TTL_MS=Number(process.env.DIRECT_SIGNAL_TTL_MS||180_000);
const MAX_SIGNAL_SESSIONS=Number(process.env.MAX_SIGNAL_SESSIONS||1000);
const rateBuckets=new Map(),iceRateBuckets=new Map();
const issueTurnCredentials=createTurnIssuer();
const rooms=new Map();
const directSignals=createDirectSignalStore({ttlMs:DIRECT_SIGNAL_TTL_MS,maxSessions:MAX_SIGNAL_SESSIONS});
function randomCode(){for(let tries=0;tries<100;tries++){const bytes=crypto.randomBytes(6);let code='';for(const b of bytes)code+=CODE_ALPHABET[b%CODE_ALPHABET.length];if(!rooms.has(code))return code}throw new Error('Unable to allocate lobby code')}
function createRoom(){const result=newLobby(randomCode());rooms.set(result.room.code,result.room);return result}
function cleanup(){const cutoff=now()-ROOM_TTL_MS;for(const[code,room]of rooms)if(room.updatedAt<cutoff)rooms.delete(code);for(const buckets of [rateBuckets,iceRateBuckets])for(const[ip,b]of buckets)if(b.resetAt<now())buckets.delete(ip);directSignals.cleanup()}
setInterval(cleanup,60_000).unref();
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(body)}
function fail(res,status,error,detail){json(res,status,{ok:false,error,...(detail?{detail}:{})})}
async function readBody(req){return await new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>100_000){reject(new Error('body too large'));req.destroy()}});req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s))}catch{reject(new Error('invalid json'))}});req.on('error',reject)})}
function roomFor(code){return rooms.get(String(code||'').toUpperCase())}
function authToken(req,urlObj,body={}){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):body.token||urlObj.searchParams.get('token')||''}
function allowRequest(req,buckets=rateBuckets,limit=RATE_LIMIT){const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();const t=now();let b=buckets.get(ip);if(!b||b.resetAt<=t){b={count:0,resetAt:t+RATE_WINDOW_MS};rateBuckets.set(ip,b)}b.count++;return b.count<=RATE_LIMIT}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'});return res.end()}
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(!allowRequest(req))return fail(res,429,'rate-limit');
  try{
    if(req.method==='GET'&&u.pathname==='/api/health')return json(res,200,{ok:true,service:'clash4-duel',relayConfigured:!!issueTurnCredentials,rooms:rooms.size,updateHistory:UPDATE_HISTORY_LIMIT,directSignals:directSignals.size(),directSignalTtlMs:directSignals.ttlMs});

    if(req.method==='GET'&&u.pathname==='/api/ice'){
      if(!issueTurnCredentials)return fail(res,503,'relay-not-configured');
      if(ALLOWED_ORIGIN!=='*'&&req.headers.origin!==ALLOWED_ORIGIN)return fail(res,403,'origin-not-allowed');
      if(!allowRequest(req,iceRateBuckets,24))return fail(res,429,'rate-limit');
      return json(res,200,issueTurnCredentials())
    }

    // Direct Duel signaling is intentionally state-blind. These endpoints exchange only
    // WebRTC offer/answer descriptions and short-lived auth tokens; gameplay stays P2P.
    if(req.method==='POST'&&u.pathname==='/api/direct/signals'){
      const body=await readBody(req),created=directSignals.create(body.offer);
      return json(res,201,{ok:true,...created})
    }
    let sm=u.pathname.match(/^\/api\/direct\/signals\/([A-Z0-9]+)(\/answer)?$/i);
    if(sm){
      const id=sm[1],answerRoute=!!sm[2];
      if(req.method==='GET'&&!answerRoute){const data=directSignals.getOffer(id,authToken(req,u));return json(res,200,{ok:true,...data})}
      if(req.method==='POST'&&answerRoute){const body=await readBody(req),data=directSignals.putAnswer(id,authToken(req,u,body),body.answer);return json(res,200,{ok:true,...data})}
      if(req.method==='GET'&&answerRoute){const data=directSignals.getAnswer(id,authToken(req,u));return json(res,200,{ok:true,...data})}
    }

    if(req.method==='POST'&&u.pathname==='/api/lobbies'){if(rooms.size>=MAX_ROOMS)return fail(res,503,'server-capacity');const{room,p1}=createRoom();return json(res,201,{ok:true,code:room.code,token:p1.token,seat:p1.owner,status:lobbyStatus(room)})}
    let m=u.pathname.match(/^\/api\/lobbies\/([A-Z0-9]+)\/(join|ready|move)$/i);
    if(req.method==='POST'&&m){const code=m[1].toUpperCase(),action=m[2].toLowerCase(),room=roomFor(code);if(!room)return fail(res,404,'lobby-not-found');const body=await readBody(req);if(action==='join'){if(room.players.length>=2)return fail(res,409,'lobby-full');const p2={owner:A,token:token(),ready:false};room.players.push(p2);touch(room);return json(res,200,{ok:true,code,token:p2.token,seat:p2.owner,status:lobbyStatus(room)})}const raw=authToken(req,u,body),player=playerFor(room,raw);if(!player)return fail(res,401,'invalid-player-token');if(action==='ready'){player.ready=true;touch(room);startIfReady(room);return json(res,200,projectedPayload(room,player))}if(action==='move'){const r=applyMove(room,player,body.type,body.column);if(r.error)return fail(res,r.status,r.error);return json(res,200,projectedPayload(room,player))}}
    m=u.pathname.match(/^\/api\/lobbies\/([A-Z0-9]+)$/i);if(req.method==='GET'&&m){const room=roomFor(m[1]);if(!room)return fail(res,404,'lobby-not-found');const raw=authToken(req,u),player=playerFor(room,raw);if(!player)return fail(res,401,'invalid-player-token');touch(room);return json(res,200,projectedPayload(room,player,{since:parseSince(u)}))}
    fail(res,404,'not-found')
  }catch(err){if(err instanceof DirectSignalError)return fail(res,err.status,err.code);fail(res,400,'bad-request',err.message)}
});
server.listen(PORT,HOST,()=>console.log(`Clash 4 Duel server listening on http://${HOST}:${PORT}`));
