import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const src=fs.readFileSync('src/js/40-peer-room-transaction.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');
const post=fs.readFileSync('src/js/22-duel-postmatch.js','utf8');

for(const token of [
  "PEER_ROOM_TRANSACTION_VERSION='0.20.4'",
  'peerRoomTransaction:true',
  'peerRoomTransactionCommit',
  'if(samePending&&dropPresentation)',
  "scheduleTimer('peerRoomMoveTransaction'",
  "kind:'room-rematch-request'",
  "'room-rematch-start'",
  'peerRoomRematchActionControls'
])assert.ok(src.includes(token),`missing 0.20.4 transaction contract: ${token}`);
assert.ok(loader.includes("src/js/40-peer-room-transaction.js"),'loader must mount 0.20.4 after presentation');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadTransaction"),'0.20.4 must wait for 0.20.3 presentation layer');
assert.ok(post.includes('peerRoomRematchHandleClick'),'post-match Rematch must route to Peer Room');
assert.ok(post.includes('peerRoomRematchHandleLobbyClick'),'post-match Return to Lobby must preserve the Peer Room');

function emptyState(){return{board:[[],[],[],[],[],[],[],[]],inv:{human:{rock:4,paper:4,scissors:4,decoy:2},ai:{rock:4,paper:4,scissors:4,decoy:2}},turn:'human',winner:null,draw:false,lastMove:null,moveNumber:0}}
function makeContext({seat=1,role=seat===1?'host':'guest'}={}){
  const timers=[];
  const context={
    console,Date,Math,Number,Object,Array,Set,Map,structuredClone,performance,
    H:'human',A:'ai',T:['rock','paper','scissors','decoy'],TIMING:{drop:220},PEER_ROOM_PROTOCOL:1,
    peerRoom:{seat,role,conn:{open:true},roomId:'room',hostId:'host'},
    peerRoomMatch:{phase:'active',spectator:false,matchId:'m1',watching:true,authority:{state:emptyState(),version:1},lastPayload:null},
    peerRoomPolishState:{previewPending:null},
    duelSession:{active:true,phase:'active',version:1,handledVersion:1,pendingLocal:null,deferredPayloads:[]},
    s:emptyState(),busy:false,ready:true,hoverCol:null,dropPresentation:null,
    publicMoveHistory:[],recentInteractions:[],
    activePresentation:null,postMatchView:'none',finishReplay:null,replayPhase:'idle',replayVisualState:null,replayStepIndex:-1,
    renderCount:0,feedbackCount:0,authorityCalls:[],sent:[],finishes:[],broadcasts:[],status:[],
    cloneState:value=>structuredClone(value),legalCols:()=>[0,1,2,3,4,5,6,7],dropTargetRow:()=>5,
    render:()=>{context.renderCount++},emitFeedback:()=>{context.feedbackCount++},
    peerRoomMatchMove:()=>{context.fallbackMove=true},
    peerRoomMatchAuthorityMove:(owner,type,column)=>context.authorityCalls.push({owner,type,column}),
    peerRoomSend:(conn,data)=>context.sent.push(data),
    duelApplyActiveUpdate:()=>{context.fallbackUpdate=true},
    duelProjectedStateToUi:value=>structuredClone(value),duelMapEvent:value=>({...value}),
    addEventsToStats:()=>{},publicMoveLog:(owner,events)=>({owner,events}),
    duelFinishNetworkPresentation:(events,column)=>context.finishes.push({events,column}),
    clearTimer:name=>{const i=timers.findIndex(t=>t.name===name);if(i>=0)timers.splice(i,1)},
    scheduleTimer:(name,fn,delay)=>{timers.push({name,fn,delay})},
    peerRoomMatchEnterPayload:()=>{},peerRoomMatchPrepareGameShell:()=>{},duelApplyPayload:()=>{},
    directConnectionBadge:()=>{},peerRoomPolishApplyGameColors:()=>{},peerRoomPolishSyncMatchChrome:()=>{},peerRoomPresentationSyncUtilities:()=>{},peerRoomRuntimeEnterChat:()=>{},
    msg:()=>{},peerRoomBroadcast:data=>context.broadcasts.push(data),duelPostMatchActionControls:()=>{},clearPresentationTimers:()=>{},
    end:{classList:{remove(){}}},peerRoomRandom:()=> 'newmatch',makeLocalDuelState:()=>emptyState(),randomDuelStarter:()=> 'human',
    peerRoomMatchBroadcast:(events,kind)=>context.broadcasts.push({kind,events}),peerRoomStatus:(text,tone)=>context.status.push({text,tone}),
    peerRoomHostMessage:()=>{},peerRoomGuestMessage:()=>{},peerRoomMatchStart:()=>{},peerRoomMatchReturnLocalLobby:()=>{},peerRoomMatchRequestLobby:()=>{},
    document:{body:{classList:{contains:name=>name==='peer-room-match-active'}}},
    globalThis:null
  };
  context.globalThis=context;
  vm.createContext(context);vm.runInContext(src,context,{filename:'40-peer-room-transaction.js'});
  return{context,timers}
}

function authoritativeAfter(owner,column,type='rock'){
  const st=emptyState();st.board[column].push({owner,type,id:1});st.lastMove={owner,column,type,survived:true,eliminations:0,hadCombat:false};st.moveNumber=1;st.turn=owner==='human'?'ai':'human';return st
}

// Host local move begins a visible fall before authority is asked to commit it.
{
  const{context,timers}=makeContext({seat:1,role:'host'});
  context.peerRoomMatchMove('human','rock',2);
  assert.equal(context.renderCount,1,'host input must stage a local drop immediately');
  assert.equal(context.feedbackCount,1);
  assert.equal(context.dropPresentation?.column,2);
  assert.equal(context.authorityCalls.length,1);
  const rendersBeforeConfirm=context.renderCount;
  context.duelApplyActiveUpdate({version:2,state:authoritativeAfter('human',2,'rock'),events:[]});
  assert.equal(context.renderCount,rendersBeforeConfirm,'host confirmation must not rebuild/restart its already-running drop');
  assert.equal(context.feedbackCount,1,'host confirmation must not emit a second drop');
  const timer=timers.find(t=>t.name==='peerRoomMoveTransaction');assert.ok(timer);
  timer.fn();
  assert.equal(context.s.moveNumber,1,'canonical board commits after the drop');
  assert.equal(context.finishes.length,1)
}

// A remote Player 2 move on the host stages one fall before the committed board appears.
{
  const{context,timers}=makeContext({seat:1,role:'host'});
  const after=authoritativeAfter('ai',4,'paper');
  context.duelApplyActiveUpdate({version:2,state:after,events:[{kind:'combat'}]});
  assert.equal(context.s.moveNumber,0,'host must keep the previous visible board during the remote drop');
  assert.equal(context.dropPresentation?.owner,'ai');
  assert.equal(context.dropPresentation?.column,4);
  assert.equal(context.renderCount,1);
  assert.equal(context.feedbackCount,1);
  const timer=timers.find(t=>t.name==='peerRoomMoveTransaction');assert.equal(timer?.delay,220);
  timer.fn();assert.equal(context.s.moveNumber,1);assert.equal(context.finishes.length,1)
}

// Player 2 gets one optimistic drop; authoritative confirmation adopts it without replay.
{
  const{context,timers}=makeContext({seat:2,role:'guest'});
  context.peerRoomMatchMove('human','scissors',5);
  assert.equal(context.renderCount,1);assert.equal(context.feedbackCount,1);assert.equal(context.sent.length,1);
  const rendersBeforeConfirm=context.renderCount;
  context.duelApplyActiveUpdate({version:2,state:authoritativeAfter('human',5,'scissors'),events:[]});
  assert.equal(context.renderCount,rendersBeforeConfirm,'P2 confirmation must not create a second drop node');
  assert.equal(context.feedbackCount,1,'P2 must receive exactly one drop feedback event');
  const timer=timers.find(t=>t.name==='peerRoomMoveTransaction');assert.ok(timer&&timer.delay<=220);
  timer.fn();assert.equal(context.s.moveNumber,1)
}

// Same-room rematch requires both players, then starts a fresh authority without leaving.
{
  const{context}=makeContext({seat:1,role:'host'});context.s.winner='human';
  assert.equal(context.peerRoomRematchRequest(),true);assert.equal(context.peerRoomTransactionState.rematchVotes[1],true);
  const guestConn={__peerRoomSeat:2};
  context.peerRoomHostMessage(guestConn,{kind:'room-rematch-request',protocol:1});
  assert.equal(context.peerRoomMatch.matchId,'prm_newmatch');
  assert.equal(context.peerRoomMatch.phase,'active');
  assert.equal(context.peerRoomMatch.authority.version,1);
  assert.ok(context.broadcasts.some(item=>item.kind==='room-rematch-start'),'host must broadcast the fresh match to the same room')
}

console.log('PASS Peer Room 0.20.4 transaction: host and P2 each render exactly one drop per move, remote drops commit after presentation, and rematch stays in the room');
