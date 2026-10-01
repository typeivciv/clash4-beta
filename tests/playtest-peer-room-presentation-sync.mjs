import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=sync0206';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browsers=[];
const COMBAT_CUES=new Set(['combat-win','combat-tie','decoy']);

async function waitRuntime(page){
  await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomMatch&&globalThis.peerRoomPresentationSync&&globalThis.peerRoomRenderSync,{timeout:20000});
  await page.evaluate(()=>{
    globalThis.__syncProbe={drops:[],waapiDrops:[],waapiFinishes:[],events:[]};
    document.addEventListener('peer-room-drop-created',event=>{
      try{__syncProbe.waapiDrops.push({...event.detail,wall:Date.now(),seat:Number(peerRoom?.seat||0),visibility:document.visibilityState})}catch{}
    });
    document.addEventListener('peer-room-drop-finished',event=>{
      try{__syncProbe.waapiFinishes.push({...event.detail,wall:Date.now(),seat:Number(peerRoom?.seat||0),visibility:document.visibilityState})}catch{}
    });
    const original=globalThis.emitFeedback;
    if(typeof original==='function')globalThis.emitFeedback=function(kind,...args){
      try{
        const entry={kind,wall:Date.now(),perf:performance.now(),move:s?.moveNumber??null,seat:Number(peerRoom?.seat||0),visibility:document.visibilityState};
        __syncProbe.events.push(entry);if(kind==='drop')__syncProbe.drops.push(entry)
      }catch{}
      return original.call(this,kind,...args)
    }
  })
}

async function snapshot(page){
  return page.evaluate(()=>{
    const seat=Number(peerRoom.seat),physical=owner=>owner==='human'?seat:owner==='ai'?(seat===1?2:1):null;
    const active=peerRoomRenderSyncState?.activeDrop||null,animation=active?.animation||null,timing=animation?.effect?.getComputedTiming?.()||null;
    let transform=null,translateY=null,opacity=null;
    if(active?.ghost?.isConnected){
      try{
        const computed=getComputedStyle(active.ghost);transform=computed.transform||null;opacity=Number.parseFloat(computed.opacity);
        if(transform&&transform!=='none'&&typeof DOMMatrixReadOnly==='function')translateY=new DOMMatrixReadOnly(transform).m42
      }catch{}
    }
    const progress=typeof timing?.progress==='number'&&Number.isFinite(timing.progress)?timing.progress:null;
    const currentTime=typeof animation?.currentTime==='number'&&Number.isFinite(animation.currentTime)?animation.currentTime:null;
    return{
      seat,move:s.moveNumber,turnSeat:physical(s.turn),busy:!!busy,handled:duelSession.handledVersion,visibility:document.visibilityState,
      occupancy:s.board.map(column=>column.map(piece=>physical(piece.owner))),heights:s.board.map(column=>column.length),
      drops:[...__syncProbe.drops],waapiDrops:[...__syncProbe.waapiDrops],waapiFinishes:[...__syncProbe.waapiFinishes],events:[...__syncProbe.events],
      animation:active?{id:active.id,targetAt:active.targetAt,duration:active.duration,createdAt:active.createdAt,delay:active.delay,playState:animation?.playState||null,currentTime,progress,transform,translateY,opacity}:null,
      renderSync:peerRoomRenderSyncEventState?.current?{
        id:peerRoomRenderSyncEventState.current.id,version:peerRoomRenderSyncEventState.current.version,
        hostDropReady:!!peerRoomRenderSyncEventState.current.hostDropReady,guestDropReady:!!peerRoomRenderSyncEventState.current.guestDropReady,
        dropAtHost:peerRoomRenderSyncEventState.current.dropAtHost,dropStarted:!!peerRoomRenderSyncEventState.current.dropStarted,
        hostCommitReady:!!peerRoomRenderSyncEventState.current.hostCommitReady,guestCommitReady:!!peerRoomRenderSyncEventState.current.guestCommitReady,
        eventsAtHost:peerRoomRenderSyncEventState.current.eventsAtHost
      }:null,
      sync:{synced:!!peerRoomPresentationSyncState.synced,offsetMs:peerRoomPresentationSyncState.offsetMs,bestRttMs:peerRoomPresentationSyncState.bestRttMs,lastSyncAt:peerRoomPresentationSyncState.lastSyncAt},
      lastPresentation:peerRoomPresentationSyncState.lastPresentation?{...peerRoomPresentationSyncState.lastPresentation}:null
    }
  })
}

async function diagnostics(page,label){
  const snap=await snapshot(page);
  const transport=await page.evaluate(()=>{
    const pc=peerRoom?.conn?.peerConnection||null;
    return{role:peerRoom?.role,active:!!peerRoom?.active,connOpen:!!peerRoom?.conn?.open,ice:pc?.iceConnectionState||null,connection:pc?.connectionState||null,authorityVersion:peerRoomMatch?.authority?.version??null,authorityMove:peerRoomMatch?.authority?.state?.moveNumber??null}
  });
  return{label,now:Date.now(),...snap,...transport}
}

async function waitDropPair(host,guest,count){
  try{
    await host.waitForFunction(n=>__syncProbe.waapiDrops.length>=n,count,{timeout:5000});
    await guest.waitForFunction(n=>__syncProbe.waapiDrops.length>=n,count,{timeout:5000})
  }catch(error){
    const [hostDiag,guestDiag]=await Promise.all([diagnostics(host,`host move ${count} timeout`),diagnostics(guest,`guest move ${count} timeout`)]);
    console.log(`MOVE ${count} DROP WAIT TIMEOUT`,JSON.stringify({host:hostDiag,guest:guestDiag}));throw error
  }
}

function sameBoard(host,guest,label){
  assert.deepEqual(host.occupancy,guest.occupancy,label);assert.deepEqual(host.heights,guest.heights,`${label} heights`)
}

function assertAnimationEvidence(sample,expectedFinishes,label){
  if(sample.waapiFinishes.length>=expectedFinishes)return;
  const animation=sample.animation;
  assert.ok(animation,`${label}: synchronized checker animation disappeared before completion evidence`);
  assert.ok(animation.playState==='running'||animation.playState==='finished',`${label}: WAAPI playState is ${animation.playState}`);
  const progress=animation.progress;
  const progressed=typeof progress==='number'&&progress>0;
  const visiblyMoved=typeof animation.translateY==='number'&&Math.abs(animation.translateY)>.5;
  assert.ok(progressed||visiblyMoved||animation.playState==='finished',`${label}: WAAPI effect has no cross-engine evidence of active visual progress (${JSON.stringify(animation)})`)
}

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
  const move=await page.evaluate(()=>s.moveNumber),selectedChoice=page.locator('.choice.sel:not([disabled])').first();
  if(await selectedChoice.count()===0)await page.locator('.choice:not([disabled])').first().tap();
  await page.locator('.cell.can').first().tap();return move
}

try{
  const chrome=await chromium.launch({headless:true});browsers.push(chrome);
  const wk=await webkit.launch({headless:true});browsers.push(wk);
  const hostContext=await chrome.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const guestContext=await wk.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const host=await hostContext.newPage(),guest=await guestContext.newPage(),pageErrors=[];
  host.on('pageerror',error=>pageErrors.push(`HOST ${error.message}`));guest.on('pageerror',error=>pageErrors.push(`GUEST ${error.message}`));

  await host.goto(BASE,{waitUntil:'domcontentloaded'});await waitRuntime(host);await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  await host.waitForFunction(()=>peerRoom.active&&peerRoom.role==='host'&&peerRoom.hostId,{timeout:20000});const invite=await host.evaluate(()=>peerRoomInviteLink());
  await guest.goto(invite,{waitUntil:'domcontentloaded'});await waitRuntime(guest);await guest.waitForFunction(()=>peerRoom.active&&Number(peerRoom.seat)===2,{timeout:25000});
  await host.waitForFunction(()=>peerRoom.seats.some(seat=>seat.seat===2&&seat.connected),{timeout:10000});
  await guest.waitForFunction(()=>peerRoomPresentationSyncState.synced&&Number.isFinite(peerRoomPresentationSyncState.bestRttMs),{timeout:7000});await sleep(250);

  const initialSync=await guest.evaluate(()=>({offset:peerRoomPresentationSyncState.offsetMs,rtt:peerRoomPresentationSyncState.bestRttMs,last:peerRoomPresentationSyncState.lastSyncAt,visibility:document.visibilityState}));
  console.log('CLOCK SYNC',JSON.stringify(initialSync));assert.ok(initialSync.rtt<1500,'guest clock sync RTT is unusably high');
  await installTransportJitter(host,'host');await installTransportJitter(guest,'guest');

  const start=host.locator('#peerRoomStartGame');await start.waitFor({state:'visible',timeout:5000});await start.tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});await guest.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  let hostState=await snapshot(host),guestState=await snapshot(guest);sameBoard(hostState,guestState,'start board');assert.equal(hostState.turnSeat,guestState.turnSeat,'start turn mismatch');
  console.log('START',JSON.stringify({turn:hostState.turnSeat,hostSync:hostState.sync.synced,guestSync:guestState.sync.synced}));

  let combatCount=0;
  for(let moveIndex=1;moveIndex<=6;moveIndex++){
    hostState=await snapshot(host);guestState=await snapshot(guest);sameBoard(hostState,guestState,`move ${moveIndex} before`);assert.equal(hostState.turnSeat,guestState.turnSeat,`move ${moveIndex} physical turn before input`);
    const mover=hostState.turnSeat===1?host:guest;
    console.log(`MOVE ${moveIndex} BEFORE INPUT`,JSON.stringify({host:{move:hostState.move,turnSeat:hostState.turnSeat,busy:hostState.busy,heights:hostState.heights},guest:{move:guestState.move,turnSeat:guestState.turnSeat,busy:guestState.busy,heights:guestState.heights},mover:hostState.turnSeat}));
    const beforeMove=await tapMove(mover);

    await waitDropPair(host,guest,moveIndex);
    const dropHost=await snapshot(host),dropGuest=await snapshot(guest),hostDrop=dropHost.waapiDrops[moveIndex-1],guestDrop=dropGuest.waapiDrops[moveIndex-1];
    const targetDelta=Math.abs(Number(hostDrop.targetAt)-Number(guestDrop.targetAt)),hostLead=Number(hostDrop.targetAt)-Number(hostDrop.createdAt),guestLead=Number(guestDrop.targetAt)-Number(guestDrop.createdAt);
    console.log(`MOVE ${moveIndex} DROP SYNC`,JSON.stringify({hostTarget:hostDrop.targetAt,guestTarget:guestDrop.targetAt,targetDeltaMs:targetDelta,hostLeadMs:hostLead,guestLeadMs:guestLead,hostCreated:hostDrop.createdAt,guestCreated:guestDrop.createdAt,hostBarrier:dropHost.renderSync,guestBarrier:dropGuest.renderSync,hostPrepareCost:dropHost.lastPresentation?.prepareCostMs,guestPrepareCost:dropGuest.lastPresentation?.prepareCostMs,hostEngine:dropHost.lastPresentation?.animationEngine,guestEngine:dropGuest.lastPresentation?.animationEngine}));
    assert.ok(dropHost.renderSync?.hostDropReady&&dropHost.renderSync?.guestDropReady,`move ${moveIndex}: host started checker without both DROP READY signals`);
    assert.ok(dropHost.renderSync?.dropStarted,`move ${moveIndex}: host DROP GO did not start the prepared checker`);
    assert.ok(dropGuest.renderSync?.dropStarted,`move ${moveIndex}: guest created checker without receiving DROP GO`);
    assert.ok(targetDelta<=12,`move ${moveIndex}: WAAPI checker targets differ by ${targetDelta}ms`);
    assert.ok(hostLead>=20,`move ${moveIndex}: host did not receive enough animation lead (${hostLead}ms)`);
    assert.ok(guestLead>=20,`move ${moveIndex}: guest did not receive enough animation lead (${guestLead}ms)`);

    const probeWait=Math.max(0,Math.min(Number(hostDrop.targetAt),Number(guestDrop.targetAt))+120-Date.now());if(probeWait)await sleep(probeWait);
    const midHost=await snapshot(host),midGuest=await snapshot(guest);
    assertAnimationEvidence(midHost,moveIndex,`move ${moveIndex} host`);assertAnimationEvidence(midGuest,moveIndex,`move ${moveIndex} guest`);

    await host.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:12000});await guest.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:12000});
    const afterHost=await snapshot(host),afterGuest=await snapshot(guest);sameBoard(afterHost,afterGuest,`move ${moveIndex} final`);assert.equal(afterHost.turnSeat,afterGuest.turnSeat,`move ${moveIndex} final turn mismatch`);assert.equal(afterHost.move,beforeMove+1);assert.equal(afterGuest.move,beforeMove+1);
    assert.equal(afterHost.waapiDrops.length,moveIndex,`move ${moveIndex}: host duplicate/missing WAAPI checker`);assert.equal(afterGuest.waapiDrops.length,moveIndex,`move ${moveIndex}: guest duplicate/missing WAAPI checker`);
    assert.equal(afterHost.waapiFinishes.length,moveIndex,`move ${moveIndex}: host WAAPI checker did not finish once`);assert.equal(afterGuest.waapiFinishes.length,moveIndex,`move ${moveIndex}: guest WAAPI checker did not finish once`);

    const canonicalMove=beforeMove+1,hostCombat=afterHost.events.filter(event=>event.move===canonicalMove&&COMBAT_CUES.has(event.kind)),guestCombat=afterGuest.events.filter(event=>event.move===canonicalMove&&COMBAT_CUES.has(event.kind));
    assert.equal(hostCombat.length,guestCombat.length,`move ${moveIndex}: host/guest combat cue count mismatch`);
    for(let combatIndex=0;combatIndex<hostCombat.length;combatIndex++){
      assert.equal(hostCombat[combatIndex].kind,guestCombat[combatIndex].kind,`move ${moveIndex} combat ${combatIndex+1}: cue mismatch`);
      const eventDelta=Math.abs(hostCombat[combatIndex].wall-guestCombat[combatIndex].wall);
      console.log(`MOVE ${moveIndex} COMBAT ${combatIndex+1} SYNC`,JSON.stringify({kind:hostCombat[combatIndex].kind,host:hostCombat[combatIndex].wall,guest:guestCombat[combatIndex].wall,deltaMs:eventDelta}));
      assert.ok(eventDelta<=90,`move ${moveIndex} combat ${combatIndex+1}: presentation started ${eventDelta}ms apart`);combatCount++
    }
  }

  assert.ok(combatCount>=2,'playtest should exercise at least two combat presentations');assert.deepEqual(pageErrors,[],'browser page errors occurred');
  await host.screenshot({path:'artifacts/peer-room-sync-host.png'});await guest.screenshot({path:'artifacts/peer-room-sync-guest.png'});
  console.log(`PASS Peer Room 0.20.6 real-browser presentation sync: 6 touch moves, ${combatCount} matched combat cues, asymmetric 70/110ms transport jitter, explicit DROP READY barrier, WAAPI drops, and post-commit event barriers.`)
} finally {
  for(const browser of browsers)await browser.close().catch(()=>{})
}
