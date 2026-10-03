import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('src/js/41-peer-room-presentation-sync.js','utf8');
const scheduler=source.slice(source.indexOf('function peerRoomPresentationSyncCancelSchedule('),source.indexOf('function peerRoomPresentationSyncSendPing('));
function harness(){
  let now=1000,id=0;
  const timers=new Map(),frames=new Map(),state={schedules:new Map()};
  const ctx=vm.createContext({Number,Date:{now:()=>now},peerRoomPresentationSyncState:state,
    setTimeout:fn=>{const key=++id;timers.set(key,fn);return key},clearTimeout:key=>timers.delete(key),
    requestAnimationFrame:fn=>{const key=++id;frames.set(key,fn);return key},cancelAnimationFrame:key=>frames.delete(key)});
  vm.runInContext(scheduler,ctx);
  return {ctx,state,timers,frames,time:value=>{now=value},run:queue=>{const pending=[...queue.values()];queue.clear();for(const fn of pending)fn()}};
}
for(const clock of ['timers','frames']){
  const h=harness();let calls=0;
  h.ctx.peerRoomPresentationSyncScheduleAt('event',1100,()=>calls++);
  h.time(1050);h.run(h[clock]);assert.equal(calls,0,'early clock must not fire');
  h.time(1100);h.run(h[clock]);assert.equal(calls,1,`${clock} must rescue the stalled other clock`);
  h.run(h.timers);h.run(h.frames);assert.equal(calls,1,'racing clocks must fire once');
  assert.equal(h.state.schedules.size,0);assert.equal(h.frames.size+h.timers.size,0);
}
{
  const h=harness();let calls=0;
  h.ctx.peerRoomPresentationSyncScheduleAt('event',1100,()=>calls++);
  const stale=[...h.timers.values(),...h.frames.values()];
  h.ctx.peerRoomPresentationSyncScheduleAt('event',1200,()=>calls+=10);
  h.time(1100);for(const fn of stale)fn();assert.equal(calls,0,'replaced callbacks must stay cancelled');
  h.time(1200);h.run(h.timers);h.run(h.frames);assert.equal(calls,10);
  h.ctx.peerRoomPresentationSyncScheduleAt('event',1300,()=>calls++);
  h.ctx.peerRoomPresentationSyncCancelAllSchedules();h.time(1400);h.run(h.timers);h.run(h.frames);assert.equal(calls,10);
}
console.log('PASS dual-clock scheduler: stalled timers/frames, early callbacks, exactly-once dispatch, replacement and cancellation.');
