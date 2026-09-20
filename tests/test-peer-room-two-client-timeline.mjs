import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/40-peer-room-transaction.js','utf8');

function emptyState(){return{board:[[],[],[],[],[],[],[],[]],inv:{human:{rock:7,paper:7,scissors:7,decoy:7},ai:{rock:7,paper:7,scissors:7,decoy:7}},turn:'human',winner:null,draw:false,lastMove:null,moveNumber:0}}
function after(owner,column,type='rock'){
  const st=emptyState();st.board[column].push({owner,type,id:1});st.lastMove={owner,column,type,survived:true,eliminations:0,hadCombat:false};st.moveNumber=1;st.turn=owner==='human'?'ai':'human';return st
}
function client({seat,role}){
  const clock={now:1000},timers=[];
  const c={console,Date,Math,Number,Object,Array,Set,Map,structuredClone,
    performance:{now:()=>clock.now},H:'human',A:'ai',T:['rock','paper','scissors','decoy'],TIMING:{drop:220},PEER_ROOM_PROTOCOL:1,
    peerRoom:{seat,role,conn:{open:true}},peerRoomMatch:{phase:'active',spectator:false,matchId:'m1',authority:{state:emptyState(),version:1}},peerRoomPolishState:{previewPending:null},
    duelSession:{active:true,handledVersion:1,pendingLocal:null,deferredPayloads:[]},s:emptyState(),busy:false,ready:true,hoverCol:null,dropPresentation:null,
    publicMoveHistory:[],recentInteractions:[],activePresentation:null,postMatchView:'none',finishReplay:null,replayPhase:'idle',replayVisualState:null,replayStepIndex:-1,
    cloneState:v=>structuredClone(v),legalCols:()=>[0,1,2,3,4,5,6,7],dropTargetRow:()=>5,render:()=>{},emitFeedback:()=>{},
    peerRoomMatchMove:()=>{},peerRoomMatchAuthorityMove:()=>{},peerRoomSend:()=>{},duelApplyActiveUpdate:()=>{},duelProjectedStateToUi:v=>structuredClone(v),duelMapEvent:e=>({...e}),
    addEventsToStats:()=>{},publicMoveLog:()=>({}),duelFinishNetworkPresentation:()=>{},clearTimer:name=>{const i=timers.findIndex(t=>t.name===name);if(i>=0)timers.splice(i,1)},
    scheduleTimer:(name,fn,delay)=>timers.push({name,fn,delay,start:clock.now,due:clock.now+delay}),peerRoomMatchEnterPayload:()=>{},peerRoomMatchPrepareGameShell:()=>{},duelApplyPayload:()=>{},
    directConnectionBadge:()=>{},peerRoomPolishApplyGameColors:()=>{},peerRoomPolishSyncMatchChrome:()=>{},peerRoomPresentationSyncUtilities:()=>{},peerRoomRuntimeEnterChat:()=>{},
    msg:()=>{},peerRoomBroadcast:()=>{},duelPostMatchActionControls:()=>{},clearPresentationTimers:()=>{},end:{classList:{remove(){}}},peerRoomRandom:()=> 'x',makeLocalDuelState:()=>emptyState(),randomDuelStarter:()=> 'human',
    peerRoomMatchBroadcast:()=>{},peerRoomStatus:()=>{},peerRoomHostMessage:()=>{},peerRoomGuestMessage:()=>{},peerRoomMatchStart:()=>{},peerRoomMatchReturnLocalLobby:()=>{},peerRoomMatchRequestLobby:()=>{},
    document:{body:{classList:{contains:n=>n==='peer-room-match-active'}}},globalThis:null};
  c.globalThis=c;vm.createContext(c);vm.runInContext(src,c);return{c,clock,timers}
}
function due(client){return client.timers.find(t=>t.name==='peerRoomMoveTransaction')?.due}

const BASE=1000,LATENCY=80;

// P1 moves: host starts immediately. P2 cannot begin until the authoritative packet arrives.
{
  const p1=client({seat:1,role:'host'}),p2=client({seat:2,role:'guest'});
  p1.clock.now=BASE;p1.c.peerRoomMatchMove('human','rock',2);p1.c.duelApplyActiveUpdate({version:2,state:after('human',2),events:[]});
  p2.clock.now=BASE+LATENCY;p2.c.duelApplyActiveUpdate({version:2,state:after('ai',2),events:[]});
  assert.equal(due(p1),BASE+220);assert.equal(due(p2),BASE+LATENCY+220);
  assert.equal(due(p2)-due(p1),LATENCY,'P2 visual commit is one network leg behind P1');
}

// P2 moves: P2 starts optimistically. Host starts only when the move reaches it; confirmation returns later.
{
  const p1=client({seat:1,role:'host'}),p2=client({seat:2,role:'guest'});
  p2.clock.now=BASE;p2.c.peerRoomMatchMove('human','paper',4);
  p1.clock.now=BASE+LATENCY;p1.c.duelApplyActiveUpdate({version:2,state:after('ai',4,'paper'),events:[]});
  p2.clock.now=BASE+LATENCY*2;p2.c.duelApplyActiveUpdate({version:2,state:after('human',4,'paper'),events:[]});
  assert.equal(due(p2),BASE+220);assert.equal(due(p1),BASE+LATENCY+220);
  assert.equal(due(p1)-due(p2),LATENCY,'host visual commit is one network leg behind P2');
}

console.log(`DIAGNOSTIC REPRODUCED: 0.20.4 guarantees a ${LATENCY}ms side-to-side presentation offset when one-way latency is ${LATENCY}ms. Move drop, clash/event start, and turn handoff therefore cannot be simultaneous on both devices.`);
