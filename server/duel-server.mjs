#!/usr/bin/env node
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import {fileURLToPath} from 'url';
import {createDirectSignalStore,DirectSignalError} from './direct-signal-store.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(__dirname,'..');
const PORT=Number(process.env.PORT||8787);
const HOST=process.env.HOST||'0.0.0.0';
const ROOM_TTL_MS=2*60*60*1000;
const MAX_ROOMS=Number(process.env.MAX_ROOMS||500);
const ALLOWED_ORIGIN=process.env.ALLOWED_ORIGIN||'*';
const RATE_WINDOW_MS=60_000,RATE_LIMIT=Number(process.env.RATE_LIMIT||240);
const UPDATE_HISTORY_LIMIT=Math.max(4,Math.min(32,Number(process.env.UPDATE_HISTORY_LIMIT||8)));
const DIRECT_SIGNAL_TTL_MS=Number(process.env.DIRECT_SIGNAL_TTL_MS||180_000);
const MAX_SIGNAL_SESSIONS=Number(process.env.MAX_SIGNAL_SESSIONS||1000);
const rateBuckets=new Map();
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const H='human',A='ai',T=['rock','paper','scissors','decoy'];
const other=o=>o===H?A:H;

function makeState(starter=H){return{
  board:Array.from({length:8},()=>[]),
  inv:{human:Object.fromEntries(T.map(x=>[x,7])),ai:Object.fromEntries(T.map(x=>[x,7]))},
  turn:starter,winner:null,winReason:null,clashmate:null,draw:false,nextId:1,moveNumber:0,
  aiKnow:{},aiOpponentModel:{humanMoves:0,proactiveBlocks:0,immediateBlocks:0,counterThreatMoves:0},cooldowns:[],lastMove:null
}}
function loadRules(){
  const context={console};vm.createContext(context);
  vm.runInContext(`const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;`,context);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/js/10-rules.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'src/js/12-duel-projection.js'),'utf8'),context);
  vm.runInContext(`globalThis.rules={resolveRaw,criticalColsFor,detectClashmate,projectDuelState,projectEventsForViewer};`,context);
  return context.rules
}
const rules=loadRules();
const rooms=new Map();
const directSignals=createDirectSignalStore({ttlMs:DIRECT_SIGNAL_TTL_MS,maxSessions:MAX_SIGNAL_SESSIONS});
function randomCode(){for(let tries=0;tries<100;tries++){const bytes=crypto.randomBytes(6);let code='';for(const b of bytes)code+=CODE_ALPHABET[b%CODE_ALPHABET.length];if(!rooms.has(code))return code}throw new Error('Unable to allocate lobby code')}
function token(){return crypto.randomBytes(24).toString('base64url')}
function fairStarter(){return crypto.randomInt(0,2)===0?H:A}
function now(){return Date.now()}
function touch(room){room.updatedAt=now()}
function cleanup(){const cutoff=now()-ROOM_TTL_MS;for(const[code,room]of rooms)if(room.updatedAt<cutoff)rooms.delete(code);for(const[ip,b]of rateBuckets)if(b.resetAt<now())rateBuckets.delete(ip);directSignals.cleanup()}
setInterval(cleanup,60_000).unref();
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(body)}
function fail(res,status,error,detail){json(res,status,{ok:false,error,...(detail?{detail}:{})})}
async function readBody(req){return await new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>100_000){reject(new Error('body too large'));req.destroy()}});req.on('end',()=>{if(!s)return resolve({});try{resolve(JSON.parse(s))}catch{reject(new Error('invalid json'))}});req.on('error',reject)})}
function roomFor(code){return rooms.get(String(code||'').toUpperCase())}
function playerFor(room,rawToken){if(!room||!rawToken)return null;return room.players.find(p=>p.token===rawToken)||null}
function authToken(req,urlObj,body={}){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):body.token||urlObj.searchParams.get('token')||''}
function lobbyStatus(room){if(room.phase==='active')return'active';if(room.players.length<2)return'waiting-for-player';if(room.players.some(p=>!p.ready))return'waiting-for-ready';return room.phase}
function recordUpdate(room,state,events){
  room.history.push({version:room.version,state,events:events.map(e=>({...e}))});
  if(room.history.length>UPDATE_HISTORY_LIMIT)room.history.splice(0,room.history.length-UPDATE_HISTORY_LIMIT)
}
function parseSince(urlObj){
  const raw=urlObj.searchParams.get('since');if(raw===null||raw==='')return null;
  const value=Number(raw);return Number.isInteger(value)&&value>=0?value:null
}
function projectedHistory(room,player,since){
  if(since===null||room.phase!=='active'||!room.state)return{updates:[],historyGap:false};
  const entries=room.history.filter(entry=>entry.version>since);
  const historyGap=room.version>since&&(entries.length===0||entries[0].version>since+1);
  const updates=entries.map(entry=>{
    const revealAll=!!(entry.state&&(entry.state.winner||entry.state.draw));
    return{version:entry.version,state:rules.projectDuelState(entry.state,player.owner,{revealAll}),events:rules.projectEventsForViewer(entry.events||[],player.owner)}
  });
  return{updates,historyGap}
}
function projectedPayload(room,player,{since=null}={}){
  const revealAll=!!(room.state&&(room.state.winner||room.state.draw));
  const history=projectedHistory(room,player,since);
  return{ok:true,code:room.code,phase:room.phase,status:lobbyStatus(room),seat:player.owner,players:room.players.map(p=>({seat:p.owner,ready:p.ready,connected:true})),version:room.version,state:room.state?rules.projectDuelState(room.state,player.owner,{revealAll}):null,events:rules.projectEventsForViewer(room.lastEvents||[],player.owner),...history}
}
function createRoom(){const code=randomCode();const p1={owner:H,token:token(),ready:false};const room={code,createdAt:now(),updatedAt:now(),phase:'lobby',players:[p1],state:null,lastEvents:[],history:[],version:0};rooms.set(code,room);return{room,p1}}
function startIfReady(room){if(room.players.length===2&&room.players.every(p=>p.ready)&&room.phase==='lobby'){room.state=makeState(fairStarter());room.phase='active';room.version++;room.lastEvents=[];recordUpdate(room,room.state,room.lastEvents);touch(room)}}
function allowRequest(req){const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();const t=now();let b=rateBuckets.get(ip);if(!b||b.resetAt<=t){b={count:0,resetAt:t+RATE_WINDOW_MS};rateBuckets.set(ip,b)}b.count++;return b.count<=RATE_LIMIT}
function applyMove(room,player,type,column){
  if(room.phase!=='active'||!room.state)return{error:'match-not-active',status:409};const st=room.state;if(st.winner||st.draw)return{error:'match-complete',status:409};if(st.turn!==player.owner)return{error:'not-your-turn',status:409};if(!T.includes(type))return{error:'invalid-piece',status:400};
  const c=Number(column);if(!Number.isInteger(c)||c<0||c>=8)return{error:'invalid-column',status:400};const critical=new Set(rules.criticalColsFor(st,player.owner));const usedCritical=critical.has(c);const q=rules.resolveRaw(st,player.owner,type,c,{ignoreCooldown:usedCritical});if(q.error)return{error:q.error,status:409};let events=[...q.events];let next=q.state;
  if(usedCritical)events.unshift({kind:'critical-defense',column:c});if(!next.winner&&!next.draw&&rules.detectClashmate(next,player.owner,q.fresh)){next.winner=player.owner;next.winReason='clashmate';next.clashmate={owner:player.owner,column:q.fresh.column,pieceId:q.fresh.pieceId};events.push({kind:'clashmate',owner:player.owner,column:q.fresh.column})}
  room.state=next;room.lastEvents=events;room.version++;recordUpdate(room,room.state,room.lastEvents);touch(room);return{ok:true}
}
const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':ALLOWED_ORIGIN,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS'});return res.end()}
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);if(!allowRequest(req))return fail(res,429,'rate-limit');
  try{
    if(req.method==='GET'&&u.pathname==='/api/health')return json(res,200,{ok:true,service:'clash4-duel',rooms:rooms.size,updateHistory:UPDATE_HISTORY_LIMIT,directSignals:directSignals.size(),directSignalTtlMs:directSignals.ttlMs});

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
