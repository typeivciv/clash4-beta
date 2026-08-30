// Shared authoritative match core for non-server Duel transports.
// Uses the canonical rules engine + Fog projection already loaded by the Alpha build.
'use strict';
function makeLocalDuelState(starter=H){
  return{
    board:Array.from({length:COLS},()=>[]),
    inv:{human:Object.fromEntries(T.map(x=>[x,7])),ai:Object.fromEntries(T.map(x=>[x,7]))},
    turn:starter,winner:null,winReason:null,clashmate:null,draw:false,nextId:1,moveNumber:0,
    aiKnow:{},aiOpponentModel:{humanMoves:0,proactiveBlocks:0,immediateBlocks:0,counterThreatMoves:0},cooldowns:[],lastMove:null
  }
}
function randomDuelStarter(){return crypto?.getRandomValues?((crypto.getRandomValues(new Uint8Array(1))[0]&1)?A:H):(Math.random()<.5?H:A)}
function applyLocalDuelMove(st,owner,type,column){
  if(!st||st.winner||st.draw)return{error:'match-complete'};
  if(st.turn!==owner)return{error:'not-your-turn'};
  if(!T.includes(type))return{error:'invalid-piece'};
  const c=Number(column);if(!Number.isInteger(c)||c<0||c>=COLS)return{error:'invalid-column'};
  const critical=new Set(criticalColsFor(st,owner)),usedCritical=critical.has(c);
  const q=resolveRaw(st,owner,type,c,{ignoreCooldown:usedCritical});if(q.error)return{error:q.error};
  let events=[...q.events],next=q.state;
  if(usedCritical)events.unshift({kind:'critical-defense',column:c});
  if(!next.winner&&!next.draw&&detectClashmate(next,owner,q.fresh)){
    next.winner=owner;next.winReason='clashmate';next.clashmate={owner,column:q.fresh.column,pieceId:q.fresh.pieceId};
    events.push({kind:'clashmate',owner,column:q.fresh.column})
  }
  return{state:next,events,error:null}
}
function localDuelPayload(state,viewer,version,events=[],players=[]){
  const revealAll=!!(state&&(state.winner||state.draw));
  return{ok:true,phase:'active',status:'active',seat:viewer,players,version,state:projectDuelState(state,viewer,{revealAll}),events:projectEventsForViewer(events,viewer),updates:[],historyGap:false}
}
globalThis.makeLocalDuelState=makeLocalDuelState;
globalThis.applyLocalDuelMove=applyLocalDuelMove;
globalThis.localDuelPayload=localDuelPayload;
