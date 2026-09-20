import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src=fs.readFileSync('src/js/39-peer-room-presentation.js','utf8');
const css=fs.readFileSync('src/styles/70-peer-room-presentation.css','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

for(const token of [
  "PEER_ROOM_PRESENTATION_VERSION='0.20.3'",
  'const duelApplyActiveUpdateBeforePeerPresentation=duelApplyActiveUpdate',
  'sameLocalMove',
  'peerOptimistic',
  'peerRoomPresentationFinishDrop(events,lm.column,remaining)',
  'owner:lm.owner',
  'targetRow:dropTargetRow(sourceBefore,column)',
  "bar.id='peerRoomMatchUtilityBar'",
  "document.getElementById('directChatFab')",
  "document.getElementById('peerRoomMatchLobbyButton')"
])assert.ok(src.includes(token),`missing 0.20.3 presentation contract: ${token}`);

assert.ok(loader.includes("src/js/39-peer-room-presentation.js"),'loader must mount Peer Room 0.20.3 presentation JS');
assert.ok(loader.includes("src/styles/70-peer-room-presentation.css"),'loader must mount Peer Room 0.20.3 presentation CSS');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadPresentation"),'presentation layer must load after polish');
assert.ok(css.includes('grid-template-areas:"brand actions" "turn turn"'),'mobile Peer Room header must give turn status its own row');
assert.ok(css.includes('.peerRoomMatchUtilityBar'),'Peer Room live utilities need a dedicated row');
assert.ok(css.includes('body.peer-room-match-active .topActions #matchDifficultyBadge{display:none!important}'),'irrelevant difficulty badge must not consume multiplayer header width');

function makeContext(){
  const timers=[];
  const bodyClasses=new Set(['peer-room-match-active']);
  const context={
    console,Date,Math,Number,Object,Array,Set,Map,
    H:'human',A:'ai',TIMING:{drop:220},
    peerRoom:{seat:1},peerRoomMatch:{phase:'active',spectator:false},peerRoomPolishState:{previewPending:null},
    duelSession:{handledVersion:1,pendingLocal:null},
    s:{board:[[],[],[],[],[],[],[],[]],lastMove:null,moveNumber:0},
    busy:false,hoverCol:null,dropPresentation:null,
    publicMoveHistory:[],recentInteractions:[],
    cloneState:value=>structuredClone(value),
    duelProjectedStateToUi:value=>structuredClone(value),
    duelMapEvent:value=>({...value}),
    addEventsToStats:()=>{},publicMoveLog:(owner,events)=>({owner,events}),
    dropTargetRow:()=>2,render:()=>{context.renderCount++},emitFeedback:()=>{context.feedbackCount++},
    renderCount:0,feedbackCount:0,finishCalls:[],
    duelFinishNetworkPresentation:(events,column)=>context.finishCalls.push({events,column}),
    clearTimer:name=>{context.cleared.push(name)},cleared:[],
    scheduleTimer:(name,fn,delay)=>{timers.push({name,fn,delay})},
    duelApplyActiveUpdate:()=>{context.fallbackCalls++},fallbackCalls:0,
    peerRoomMatchEnterPayload:()=>{},peerRoomMatchReturnLocalLobby:()=>{},peerRoomPolishSyncMatchChrome:()=>{},
    document:{
      body:{classList:{contains:name=>bodyClasses.has(name)}},
      getElementById:()=>null,
      querySelector:()=>null,
      createElement:()=>({className:'',hidden:false,setAttribute(){},after(){},append(){}})
    },
    window:{addEventListener(){}},requestAnimationFrame:fn=>fn(),
    globalThis:null
  };
  context.globalThis=context;
  vm.createContext(context);vm.runInContext(src,context,{filename:'39-peer-room-presentation.js'});
  return{context,timers}
}

// Remote opponent moves must now receive the same drop stage instead of snapping directly
// to the committed board before clash/special events.
{
  const{context,timers}=makeContext();
  const state={board:[[],[],[],[],[],[],[],[]],lastMove:{owner:'ai',column:3,type:null},moveNumber:1};
  context.duelApplyActiveUpdate({version:2,state,events:[{kind:'combat'}]});
  assert.equal(context.dropPresentation.owner,'ai');
  assert.equal(context.dropPresentation.column,3);
  assert.equal(context.feedbackCount,1);
  assert.equal(timers.at(-1)?.delay,220);
  assert.equal(context.finishCalls.length,0,'events must wait until drop presentation completes');
  timers.at(-1).fn();
  assert.equal(context.finishCalls.length,1);
  assert.equal(context.finishCalls[0].column,3)
}

// Host/local moves keep the same canonical drop contract.
{
  const{context,timers}=makeContext();
  const before={board:[[],[],[],[],[],[],[],[]],lastMove:null,moveNumber:0};
  context.duelSession.pendingLocal={type:'rock',column:2,before,baseVersion:1};
  const state={board:[[],[],[],[],[],[],[],[]],lastMove:{owner:'human',column:2,type:'rock'},moveNumber:1};
  context.duelApplyActiveUpdate({version:2,state,events:[]});
  assert.equal(context.dropPresentation.owner,'human');
  assert.equal(context.dropPresentation.type,'rock');
  assert.equal(context.dropPresentation.column,2);
  assert.equal(timers.at(-1)?.delay,220)
}

// Player 2's optimistic drop should finish the already-running animation instead of
// restarting it after the host reply.
{
  const{context,timers}=makeContext();context.peerRoom.seat=2;
  const before={board:[[],[],[],[],[],[],[],[]],lastMove:null,moveNumber:0};
  context.duelSession.pendingLocal={type:'paper',column:4,before,baseVersion:1,peerOptimistic:true,previewStartedAt:Date.now()-60};
  context.dropPresentation={before,owner:'human',type:'paper',column:4,targetRow:2,moveNumber:1,duration:220};
  const state={board:[[],[],[],[],[],[],[],[]],lastMove:{owner:'human',column:4,type:'paper'},moveNumber:1};
  context.duelApplyActiveUpdate({version:2,state,events:[{kind:'special'}]});
  const timer=timers.at(-1);
  assert.ok(timer.delay>=0&&timer.delay<220,'authoritative reply should only wait for the remaining optimistic-drop time');
  assert.equal(context.feedbackCount,0,'authoritative reply must not replay drop feedback');
  assert.equal(context.duelSession.pendingLocal,null);
  assert.equal(context.finishCalls.length,0);
  timer.fn();assert.equal(context.finishCalls.length,1)
}

console.log('PASS Peer Room 0.20.3 presentation: P1/P2 share drop-event sequencing, optimistic P2 drops reconcile without replay, and live controls cannot collide with the turn banner');
