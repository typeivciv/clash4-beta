import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

export const ROOM_TTL_MS=2*60*60*1000;
export const UPDATE_HISTORY_LIMIT=Math.max(4,Math.min(32,Number(process.env.UPDATE_HISTORY_LIMIT||8)));
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
  vm.runInContext(fs.readFileSync(new URL('../src/js/10-rules.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('../src/js/12-duel-projection.js',import.meta.url),'utf8'),context);
  vm.runInContext(`globalThis.rules={resolveRaw,criticalColsFor,detectClashmate,projectDuelState,projectEventsForViewer};`,context);
  return context.rules
}
const rules=loadRules();
function token(){return crypto.randomBytes(24).toString('base64url')}
function fairStarter(){return crypto.randomInt(0,2)===0?H:A}
function now(){return Date.now()}
function touch(room){room.updatedAt=now()}
function playerFor(room,rawToken){if(!room||!rawToken)return null;return room.players.find(p=>p.token===rawToken)||null}
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
function newLobby(code){const p1={owner:H,token:token(),ready:false};const room={code,createdAt:now(),updatedAt:now(),phase:'lobby',players:[p1],state:null,lastEvents:[],history:[],version:0};return{room,p1}}
function startIfReady(room){if(room.players.length===2&&room.players.every(p=>p.ready)&&room.phase==='lobby'){room.state=makeState(fairStarter());room.phase='active';room.version++;room.lastEvents=[];recordUpdate(room,room.state,room.lastEvents);touch(room)}}
function applyMove(room,player,type,column){
  if(room.phase!=='active'||!room.state)return{error:'match-not-active',status:409};const st=room.state;if(st.winner||st.draw)return{error:'match-complete',status:409};if(st.turn!==player.owner)return{error:'not-your-turn',status:409};if(!T.includes(type))return{error:'invalid-piece',status:400};
  const c=Number(column);if(!Number.isInteger(c)||c<0||c>=8)return{error:'invalid-column',status:400};const critical=new Set(rules.criticalColsFor(st,player.owner));const usedCritical=critical.has(c);const q=rules.resolveRaw(st,player.owner,type,c,{ignoreCooldown:usedCritical});if(q.error)return{error:q.error,status:409};let events=[...q.events];let next=q.state;
  if(usedCritical)events.unshift({kind:'critical-defense',column:c});if(!next.winner&&!next.draw&&rules.detectClashmate(next,player.owner,q.fresh)){next.winner=player.owner;next.winReason='clashmate';next.clashmate={owner:player.owner,column:q.fresh.column,pieceId:q.fresh.pieceId};events.push({kind:'clashmate',owner:player.owner,column:q.fresh.column})}
  room.state=next;room.lastEvents=events;room.version++;recordUpdate(room,room.state,room.lastEvents);touch(room);return{ok:true}
}

export {CODE_ALPHABET,A,token,now,touch,playerFor,parseSince,projectedPayload,lobbyStatus,newLobby,startIfReady,applyMove};
