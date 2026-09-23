import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=sync0205';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browsers=[];

async function waitRuntime(page){
  await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomMatch&&globalThis.peerRoomPresentationSync,{timeout:20000});
  await page.evaluate(()=>{
    globalThis.__syncProbe={drops:[],events:[]};
    const old=globalThis.emitFeedback;
    if(typeof old==='function')globalThis.emitFeedback=function(kind,...args){
      try{
        const entry={kind,wall:Date.now(),perf:performance.now(),move:s?.moveNumber??null,seat:Number(peerRoom?.seat||0),visibility:document.visibilityState};
        __syncProbe.events.push(entry);if(kind==='drop')__syncProbe.drops.push(entry)
      }catch{}
      return old.call(this,kind,...args)
    }
  })
}

async function snapshot(page){
  return page.evaluate(()=>{
    const seat=Number(peerRoom.seat),physical=o=>o==='human'?seat:o==='ai'?(seat===1?2:1):null;
    return{
      seat,move:s.moveNumber,turnSeat:physical(s.turn),busy:!!busy,handled:duelSession.handledVersion,visibility:document.visibilityState,
      occupancy:s.board.map(c=>c.map(p=>physical(p.owner))),heights:s.board.map(c=>c.length),
      drops:[...__syncProbe.drops],events:[...__syncProbe.events],sync:{...peerRoomPresentationSyncState,pendingPings:undefined,pendingHostTransactions:undefined,pendingGuestTransactions:undefined},
      lastPresentation:peerRoomPresentationSyncState.lastPresentation?{...peerRoomPresentationSyncState.lastPresentation}:null
    }
  })
}
function sameBoard(a,b,label){assert.deepEqual(a.occupancy,b.occupancy,label);assert.deepEqual(a.heights,b.heights,`${label} heights`)}

async function installTransportJitter(page,role){
  await page.evaluate(role=>{
    if(globalThis.__peerRoomJitterInstalled)return;globalThis.__peerRoomJitterInstalled=true;
    const original=peerRoomSend;
    peerRoomSend=function(target,data){
      let delay=0;
      if(role==='host'&&data?.kind==='room-match-payload')delay=110;
      if(role==='guest'&&data?.kind==='room-match-move')delay=70;
      if(!delay)return original(target,data);
      setTimeout(()=>original(target,data),delay);return true
    };
    globalThis.peerRoomSend=peerRoomSend
  },role)
}

async function tapMove(page){
  await page.waitForFunction(()=>s.turn==='human'&&!busy&&document.querySelectorAll('.cell.can').length>0,{timeout:10000});
  const move=await page.evaluate(()=>s.moveNumber);
  const selected=page.locator('.choice.sel:not([disabled])').first();
  if(await selected.count()===0)await page.locator('.choice:not([disabled])').first().tap();
  await page.locator('.cell.can').first().tap();
  return move
}

try{
  const chrome=await chromium.launch({headless:true});browsers.push(chrome);
  const wk=await webkit.launch({headless:true});browsers.push(wk);
  const hc=await chrome.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const gc=await wk.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const host=await hc.newPage(),guest=await gc.newPage();
  const pageErrors=[];host.on('pageerror',e=>pageErrors.push(`HOST ${e.message}`));guest.on('pageerror',e=>pageErrors.push(`GUEST ${e.message}`));

  await host.goto(BASE,{waitUntil:'domcontentloaded'});await waitRuntime(host);
  await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  await host.waitForFunction(()=>peerRoom.active&&peerRoom.role==='host'&&peerRoom.hostId,{timeout:20000});
  const invite=await host.evaluate(()=>peerRoomInviteLink());

  await guest.goto(invite,{waitUntil:'domcontentloaded'});await waitRuntime(guest);
  await guest.waitForFunction(()=>peerRoom.active&&Number(peerRoom.seat)===2,{timeout:25000});
  await host.waitForFunction(()=>peerRoom.seats.some(x=>x.seat===2&&x.connected),{timeout:10000});
  await guest.waitForFunction(()=>peerRoomPresentationSyncState.synced&&Number.isFinite(peerRoomPresentationSyncState.bestRttMs),{timeout:7000});
  await sleep(250);

  const initialSync=await guest.evaluate(()=>({offset:peerRoomPresentationSyncState.offsetMs,rtt:peerRoomPresentationSyncState.bestRttMs,last:peerRoomPresentationSyncState.lastSyncAt,visibility:document.visibilityState}));
  console.log('CLOCK SYNC',JSON.stringify(initialSync));
  assert.ok(initialSync.rtt<1500,'guest clock sync RTT is unusably high');

  await installTransportJitter(host,'host');await installTransportJitter(guest,'guest');

  const start=host.locator('#peerRoomStartGame');await start.waitFor({state:'visible',timeout:5000});await start.tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});

  let hs=await snapshot(host),gs=await snapshot(guest);sameBoard(hs,gs,'start board');assert.equal(hs.turnSeat,gs.turnSeat,'start turn mismatch');
  console.log('START',JSON.stringify({turn:hs.turnSeat,hostSync:hs.sync.synced,guestSync:gs.sync.synced,hostVisibility:hs.visibility,guestVisibility:gs.visibility}));

  let combatCount=0;
  for(let i=1;i<=6;i++){
    hs=await snapshot(host);gs=await snapshot(guest);sameBoard(hs,gs,`move ${i} before`);assert.equal(hs.turnSeat,gs.turnSeat,`move ${i} physical turn before input`);
    const mover=hs.turnSeat===1?host:guest;
    const beforeMove=await tapMove(mover);

    await sleep(45);
    const intentH=await snapshot(host),intentG=await snapshot(guest);
    assert.ok(intentH.drops.length<=i-1,`move ${i}: host started checker before host presentation transaction`);
    assert.ok(intentG.drops.length<=i-1,`move ${i}: guest started checker before host presentation transaction`);

    await host.waitForFunction(n=>__syncProbe.drops.length>=n,i,{timeout:5000});
    await guest.waitForFunction(n=>__syncProbe.drops.length>=n,i,{timeout:5000});
    const dropH=await snapshot(host),dropG=await snapshot(guest);
    const hDrop=dropH.drops[i-1],gDrop=dropG.drops[i-1],delta=Math.abs(hDrop.wall-gDrop.wall);
    const hp=dropH.lastPresentation||{},gp=dropG.lastPresentation||{};
    console.log(`MOVE ${i} DROP SYNC`,JSON.stringify({
      host:hDrop.wall,guest:gDrop.wall,deltaMs:delta,
      hostReceived:hp.receivedAt,guestReceived:gp.receivedAt,
      hostTarget:hp.targetAt,guestTarget:gp.targetAt,
      hostStaged:hp.stagedAt,guestStaged:gp.stagedAt,
      hostReceiveLead:Number(hp.targetAt)-Number(hp.receivedAt),guestReceiveLead:Number(gp.targetAt)-Number(gp.receivedAt),
      hostTimerLate:Number(hp.stagedAt)-Number(hp.targetAt),guestTimerLate:Number(gp.stagedAt)-Number(gp.targetAt),
      hostRenderAfterStage:hDrop.wall-Number(hp.stagedAt),guestRenderAfterStage:gDrop.wall-Number(gp.stagedAt),
      hostStageLate:hDrop.wall-Number(hp.targetAt),guestStageLate:gDrop.wall-Number(gp.targetAt),
      hostVisibility:dropH.visibility,guestVisibility:dropG.visibility
    }));
    assert.ok(delta<=65,`move ${i}: checker drops started ${delta}ms apart under induced jitter`);

    await host.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:10000});
    await guest.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:10000});
    const afterH=await snapshot(host),afterG=await snapshot(guest);sameBoard(afterH,afterG,`move ${i} final`);assert.equal(afterH.turnSeat,afterG.turnSeat,`move ${i} final turn mismatch`);assert.equal(afterH.move,beforeMove+1);assert.equal(afterG.move,beforeMove+1);
    assert.equal(afterH.drops.length,i,`move ${i}: host duplicate/missing checker drop`);assert.equal(afterG.drops.length,i,`move ${i}: guest duplicate/missing checker drop`);

    const hTies=afterH.events.filter(e=>e.kind==='combat-tie'),gTies=afterG.events.filter(e=>e.kind==='combat-tie');
    if(hTies.length>combatCount&&gTies.length>combatCount){
      const eventDelta=Math.abs(hTies[combatCount].wall-gTies[combatCount].wall);console.log(`COMBAT ${combatCount+1} SYNC`,JSON.stringify({deltaMs:eventDelta}));assert.ok(eventDelta<=90,`combat ${combatCount+1}: presentation started ${eventDelta}ms apart`);combatCount++
    }
  }

  assert.ok(combatCount>=2,'playtest should exercise at least two combat presentations');
  assert.deepEqual(pageErrors,[],'browser page errors occurred');
  await host.screenshot({path:'artifacts/peer-room-sync-host.png'});await guest.screenshot({path:'artifacts/peer-room-sync-guest.png'});
  console.log(`PASS Peer Room 0.20.5 real-browser presentation sync: 6 touch moves, ${combatCount} combats, asymmetric 70/110ms transport jitter, synchronized host-timed drops.`)
} finally {for(const b of browsers)await b.close().catch(()=>{})}
