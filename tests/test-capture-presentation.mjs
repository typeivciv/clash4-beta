import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function harness(shared=false){
  let now=1000;
  const clocks=new Map(),renders=[];
  const context={console,Math,Date:{now:()=>now},dropPresentation:null,
    renderBoardGrid:options=>renders.push(options.viewBoard.map(col=>col.map(p=>p.id))),
    clearPresentationTimers:()=>clocks.clear(),duelClearActiveSession:()=>{},
    clearTimer:name=>clocks.delete(name),scheduleTimer:(name,fn,delay)=>clocks.set(name,{fn,due:now+delay}),
    peerRoomPresentationSyncActive:()=>shared,
    peerRoomPresentationSyncCancelSchedule:name=>clocks.delete(name),
    peerRoomPresentationSyncScheduleAt:(name,due,fn)=>clocks.set(name,{fn,due}),
    eventDuration:()=>2000
  };
  vm.createContext(context);
  vm.runInContext("const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;",context);
  for(const file of ['10-rules.js','12-duel-projection.js','15-duel-local-core.js','47-capture-presentation.js'])vm.runInContext(fs.readFileSync('src/js/'+file,'utf8'),context,{filename:file});
  vm.runInContext('globalThis.rules={makeLocalDuelState,resolveRaw,projectBoardForViewer,projectEventsForViewer};',context);
  return {context,clocks,renders,advance:ms=>{
    now+=ms;
    for(const [name,record] of [...clocks])if(record.due<=now){clocks.delete(name);record.fn()}
  },jump:ms=>{now+=ms},now:()=>now,ids:()=>JSON.parse(JSON.stringify(context.c4CapturePresentation.board?.[3].map(p=>p.id)??null))}
}
const scenarios=[
  {defenders:['scissors'],boards:[[200]]},
  {defenders:['scissors','scissors'],boards:[[100,200],[200]]},
  {defenders:['paper','scissors','scissors'],boards:[[100,101,200],[100,200],[100]]},
  {defenders:['paper'],boards:[[100]]},
  {defenders:['rock'],boards:[[100,200]]},
  {defenders:['decoy'],boards:[[100,200]]}
];
let count=0;
for(const shared of [false,true])for(const viewer of ['human','ai'])for(const scenario of scenarios){
  const h=harness(shared),c=h.context;
  const before=c.rules.makeLocalDuelState('human');before.nextId=200;
  before.board[3]=scenario.defenders.map((type,i)=>({owner:'ai',type,id:100+i}));
  const result=c.rules.resolveRaw(before,'human','rock',3);
  assert.equal(result.error,null);
  const snapshots=JSON.stringify({before,after:result.state});
  const projectedBefore={...before,board:c.rules.projectBoardForViewer(before.board,viewer)};
  const events=c.rules.projectEventsForViewer(result.events,viewer);
  c.c4CapturePrepare(projectedBefore,result.state,events,3);
  c.renderBoardGrid({viewBoard:result.state.board});
  assert.deepEqual(h.renders.at(-1)[3],[...scenario.defenders.map((_,i)=>100+i),200],'the settled board must show every defender and the attacker');
  // Existing hidden pieces retain exactly their projected identities.
  for(const p of c.c4CapturePresentation.board[3].filter(p=>p.id!==200))if(p.owner!==viewer)assert.equal(p.type,null);
  for(const [index,event] of events.filter(e=>e.kind==='combat').entries()){
    const current=h.ids();
    const target=h.now()+(shared?1200:0);
    c.c4CaptureCue(event,target);
    h.advance(shared?3199:1999);
    assert.deepEqual(h.ids(),current,'no piece can disappear before its individual clash deadline');
    h.advance(1);
    assert.deepEqual(h.ids(),scenario.boards[index],'only this clash loser is removed; later defenders stay');
    c.c4CaptureCue({kind:'chain-continue'});h.advance(600)
  }
  assert.equal(JSON.stringify({before,after:result.state}),snapshots,'presentation must never mutate authoritative state');
  assert.deepEqual(h.ids(),Array.from(result.state.board[3],p=>p.id),'staged sequence ends at the canonical board');
  c.c4CaptureFinish();assert.equal(c.c4CapturePresentation.board,null);assert.equal(h.clocks.size,0);count++
}

// An in-flight callback cannot remove a piece after navigation, a resync or rematch.
for(const clear of ['clearPresentationTimers','duelClearActiveSession','c4CaptureFinish']){
  const h=harness(true),c=h.context,before=c.rules.makeLocalDuelState('human');
  before.board[3]=[{owner:'ai',type:'scissors',id:100}];before.nextId=200;
  const result=c.rules.resolveRaw(before,'human','rock',3);
  c.c4CapturePrepare(before,result.state,result.events,3);c.renderBoardGrid({viewBoard:result.state.board});
  c.c4CaptureCue(result.events[0],h.now());const stale=[...h.clocks.values()].map(r=>r.fn);
  c[clear]();assert.equal(c.c4CapturePresentation.board,null);assert.equal(h.clocks.size,0);
  c.c4CapturePrepare(before,result.state,result.events,3);
  for(const fn of stale)fn();assert.deepEqual(h.ids(),[100,200],'retired callback must not touch a new presentation')
}

// Simulate the next-event callback winning the same-deadline race, then the retired
// capture callback firing. The first loser is removed once; the second is retained.
{
  const h=harness(true),c=h.context,before=c.rules.makeLocalDuelState('human');before.nextId=200;
  before.board[3]=[100,101].map(id=>({owner:'ai',type:'scissors',id}));
  const result=c.rules.resolveRaw(before,'human','rock',3),events=result.events.filter(e=>e.kind==='combat');
  c.c4CapturePrepare(before,result.state,result.events,3);c.renderBoardGrid({viewBoard:result.state.board});
  c.c4CaptureCue(events[0],h.now());const stale=[...h.clocks.values()][0].fn;
  h.jump(2600);c.c4CaptureCue(events[1],h.now());assert.deepEqual(h.ids(),[100,200]);
  stale();assert.deepEqual(h.ids(),[100,200]);h.advance(2000);assert.deepEqual(h.ids(),[200])
}

// Decoy contact must not reveal an opponent's ordinary incoming piece.
{
  const h=harness(),c=h.context,before=c.rules.makeLocalDuelState('human');before.nextId=200;
  before.board[3]=[{owner:'ai',type:'decoy',id:100}];
  const result=c.rules.resolveRaw(before,'human','rock',3),events=c.rules.projectEventsForViewer(result.events,'ai');
  c.c4CapturePrepare({board:c.rules.projectBoardForViewer(before.board,'ai')},result.state,events,3);
  assert.equal(c.c4CapturePresentation.board[3].at(-1).type,null,'decoy privacy projection must survive staging')
}
console.log(`PASS capture presentation: ${count} canonical fixture/viewer/clock combinations, per-clash removal, final boards, cancellation, callback races and decoy privacy`);
