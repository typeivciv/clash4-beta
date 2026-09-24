import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=sync0206';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browsers=[];
const COMBAT_CUES=new Set(['combat-win','combat-tie','decoy']);

async function waitRuntime(page){
  await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomMatch&&globalThis.peerRoomPresentationSync,{timeout:20000});
  await page.evaluate(()=>{
    globalThis.__syncProbe={drops:[],cssDrops:[],events:[]};
    document.addEventListener('animationstart',event=>{
      if(event.animationName!=='c4-peer-room-sync-drop')return;
      try{
        const target=Number(event.target?.dataset?.peerRoomSyncTarget);
        __syncProbe.cssDrops.push({wall:Date.now(),perf:performance.now(),target:Number.isFinite(target)?target:null,seat:Number(peerRoom?.seat||0),visibility:document.visibilityState})
      }catch{}
    },true);
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
      drops:[...__syncProbe.drops],cssDrops:[...__syncProbe.cssDrops],events:[...__syncProbe.events],sync:{...peerRoomPresentationSyncState,pendingPings:undefined,pendingHostTransactions:undefined,pendingGuestTransactions:undefined,schedules:undefined},
      lastPresentation:peerRoomPresentationSyncState.lastPresentation?{...peerRoomPresentationSyncState.lastPresentation}:null
    }
  })
}
async function diagnostics(page,label){
  return page.evaluate(label=>{
    const pc=peerRoom?.conn?.peerConnection||null;
    const seat=Number(peerRoom?.seat||0),physical=o=>o==='human'?seat:o==='ai'?(seat===1?2:1):null;
    const pendingHost=[...(peerRoomPresentationSyncState?.pendingHostTransactions?.values?.()||[])].map(tx=>({id:tx.id,version:tx.version,finalized:!!tx.finalized,preparedAt:tx.preparedAt,matchId:tx.matchId}));
    const pendingGuest=[...(peerRoomPresentationSyncState?.pendingGuestTransactions?.values?.()||[])].map(tx=>({id:tx.id,version:tx.version,receivedAt:tx.receivedAt,matchId:tx.matchId}));
    const schedules=[...(peerRoomPresentationSyncState?.schedules?.entries?.()||[])].map(([name,v])=>({name,targetAt:v?.targetAt,cancelled:!!v?.cancelled}));
    let legal=[];try{legal=legalCols(H)}catch{}
    return{
      label,now:Date.now(),seat,role:peerRoom?.role,active:!!peerRoom?.active,matchPhase:peerRoomMatch?.phase,matchId:peerRoomMatch?.matchId,
      move:s?.moveNumber,turn:s?.turn,turnSeat:physical(s?.turn),ready:!!ready,busy:!!busy,winner:s?.winner||null,draw:!!s?.draw,selected,
      legal,heights:s?.board?.map?.(c=>c.length)||[],handled:duelSession?.handledVersion,sessionVersion:duelSession?.version,
      pendingLocal:duelSession?.pendingLocal?{type:duelSession.pendingLocal.type,column:duelSession.pendingLocal.column,baseVersion:duelSession.pendingLocal.baseVersion,peerRoomSynchronized:!!duelSession.pendingLocal.peerRoomSynchronized,requestedAt:duelSession.pendingLocal.requestedAt}:null,
      authorityVersion:peerRoomMatch?.authority?.version??null,authorityMove:peerRoomMatch?.authority?.state?.moveNumber??null,
      connOpen:!!peerRoom?.conn?.open,peerId:peerRoom?.conn?.peer||null,ice:pc?.iceConnectionState||null,connection:pc?.connectionState||null,
      pendingHost,pendingGuest,schedules,cssDrops:__syncProbe?.cssDrops?.length||0,dropFeedback:__syncProbe?.drops?.length||0,
      lastPresentation:peerRoomPresentationSyncState?.lastPresentation?{...peerRoomPresentationSyncState.lastPresentation}:null
    }
  },label)
}
async function waitCssDropPair(host,guest,n){
  try{
    await host.waitForFunction(count=>__syncProbe.cssDrops.length>=count,n,{timeout:5000});
    await guest.waitForFunction(count=>__syncProbe.cssDrops.length>=count,n,{timeout:5000})
  }catch(error){
    const [hd,gd]=await Promise.all([diagnostics(host,`host move ${n} timeout`),diagnostics(guest,`guest move ${n} timeout`)]);
    console.log(`MOVE ${n} DROP WAIT TIMEOUT`,JSON.stringify({host:hd,guest:gd}));
    throw error
  }
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
    console.log(`MOVE ${i} BEFORE INPUT`,JSON.stringify({host:{move:hs.move,turnSeat:hs.turnSeat,busy:hs.busy,heights:hs.heights},guest:{move:gs.move,turnSeat:gs.turnSeat,busy:gs.busy,heights:gs.heights},mover:hs.turnSeat}));
    const beforeMove=await tapMove(mover);

    await sleep(45);
    const intentH=await snapshot(host),intentG=await snapshot(guest);
    assert.ok(intentH.cssDrops.length<=i-1,`move ${i}: host CSS checker started before presentation transaction`);
    assert.ok(intentG.cssDrops.length<=i-1,`move ${i}: guest CSS checker started before presentation transaction`);

    await waitCssDropPair(host,guest,i);
    const dropH=await snapshot(host),dropG=await snapshot(guest);
    const hDrop=dropH.cssDrops[i-1],gDrop=dropG.cssDrops[i-1],dispatchDelta=Math.abs(hDrop.wall-gDrop.wall),targetDelta=Math.abs(Number(hDrop.target)-Number(gDrop.target));
    const hp=dropH.lastPresentation||{},gp=dropG.lastPresentation||{};
    console.log(`MOVE ${i} DROP SYNC`,JSON.stringify({
      hostAnimationStart:hDrop.wall,guestAnimationStart:gDrop.wall,dispatchDeltaMs:dispatchDelta,targetDeltaMs:targetDelta,
      hostCssTarget:hDrop.target,guestCssTarget:gDrop.target,
      hostDispatchLate:hDrop.wall-Number(hDrop.target),guestDispatchLate:gDrop.wall-Number(gDrop.target),
      hostReceived:hp.receivedAt,guestReceived:gp.receivedAt,hostTarget:hp.targetAt,guestTarget:gp.targetAt,
      hostPrepared:hp.preparedAt,guestPrepared:gp.preparedAt,hostPrepareCost:hp.prepareCostMs,guestPrepareCost:gp.prepareCostMs,
      hostCssDelay:hp.cssDelayMs,guestCssDelay:gp.cssDelayMs,hostVisibility:dropH.visibility,guestVisibility:dropG.visibility
    }));
    assert.ok(targetDelta<=12,`move ${i}: CSS checker targets differ by ${targetDelta}ms`);
    assert.ok(dispatchDelta<=140,`move ${i}: CSS animationstart events dispatched ${dispatchDelta}ms apart`);

    await host.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:10000});
    await guest.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:10000});
    const afterH=await snapshot(host),afterG=await snapshot(guest);sameBoard(afterH,afterG,`move ${i} final`);assert.equal(afterH.turnSeat,afterG.turnSeat,`move ${i} final turn mismatch`);assert.equal(afterH.move,beforeMove+1);assert.equal(afterG.move,beforeMove+1);
    assert.equal(afterH.cssDrops.length,i,`move ${i}: host duplicate/missing CSS checker drop`);assert.equal(afterG.cssDrops.length,i,`move ${i}: guest duplicate/missing CSS checker drop`);

    const canonicalMove=beforeMove+1;
    const hCombat=afterH.events.filter(e=>e.move===canonicalMove&&COMBAT_CUES.has(e.kind));
    const gCombat=afterG.events.filter(e=>e.move===canonicalMove&&COMBAT_CUES.has(e.kind));
    assert.equal(hCombat.length,gCombat.length,`move ${i}: host/guest combat cue count mismatch`);
    for(let j=0;j<hCombat.length;j++){
      assert.equal(hCombat[j].kind,gCombat[j].kind,`move ${i} combat ${j+1}: cue mismatch`);
      const eventDelta=Math.abs(hCombat[j].wall-gCombat[j].wall);
      console.log(`MOVE ${i} COMBAT ${j+1} SYNC`,JSON.stringify({kind:hCombat[j].kind,host:hCombat[j].wall,guest:gCombat[j].wall,deltaMs:eventDelta}));
      assert.ok(eventDelta<=90,`move ${i} combat ${j+1}: presentation started ${eventDelta}ms apart`);
      combatCount++
    }
  }

  assert.ok(combatCount>=2,'playtest should exercise at least two combat presentations');
  assert.deepEqual(pageErrors,[],'browser page errors occurred');
  await host.screenshot({path:'artifacts/peer-room-sync-host.png'});await guest.screenshot({path:'artifacts/peer-room-sync-guest.png'});
  console.log(`PASS Peer Room 0.20.6 real-browser presentation sync: 6 touch moves, ${combatCount} matched combat cues, asymmetric 70/110ms transport jitter, CSS-clock checker starts and host-timed event timeline.`)
} finally {for(const b of browsers)await b.close().catch(()=>{})}
