import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=recovery0206';
const browsers=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function waitRuntime(page){await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomRecoveryNav&&globalThis.peerRoomMatchApi,{timeout:20000})}
async function visible(page,selector){return page.locator(selector).isVisible()}

try{
  const chrome=await chromium.launch({headless:true});browsers.push(chrome);
  const wk=await webkit.launch({headless:true});browsers.push(wk);
  const hostCtx=await chrome.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const guestCtx=await wk.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const host=await hostCtx.newPage(),guest=await guestCtx.newPage();
  const errors=[];host.on('pageerror',e=>errors.push(`HOST ${e.message}`));guest.on('pageerror',e=>errors.push(`GUEST ${e.message}`));

  await host.goto(BASE,{waitUntil:'domcontentloaded'});await waitRuntime(host);
  await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  await host.waitForFunction(()=>peerRoom.active&&peerRoom.role==='host'&&peerRoom.hostId,{timeout:20000});
  const invite=await host.evaluate(()=>peerRoomInviteLink());
  assert.equal(await visible(host,'#peerRoomBack'),true,'Peer Room host lobby needs a visible Back button');

  let releaseRuntime;const runtimeGate=new Promise(resolve=>{releaseRuntime=resolve});
  await guest.route('**/src/js/43-peer-room-render-sync.js*',async route=>{await runtimeGate;await route.continue()});
  await guest.goto(invite,{waitUntil:'domcontentloaded'});
  await host.waitForFunction(()=>peerRoom.seats.some(s=>s.seat===2&&s.connected),{timeout:20000});
  await host.locator('#peerRoomStartGame').tap();
  releaseRuntime();await waitRuntime(guest);
  await guest.waitForFunction(()=>globalThis.peerRoomGameplayReady&&peerRoomMatch.phase==='active'&&duelSession.active,{timeout:15000});
  assert.equal(await host.evaluate(()=>peerRoomMatch.matchId),await guest.evaluate(()=>peerRoomMatch.matchId),'cold invite must enter the same match');
  await guest.locator('#peerRoomMatchLobbyButton').tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await guest.waitForFunction(()=>peerRoom.active&&Number(peerRoom.seat)===2&&peerRoom.conn?.open,{timeout:25000});
  await host.waitForFunction(()=>peerRoom.seats.some(s=>s.seat===2&&s.connected),{timeout:10000});
  assert.equal(await visible(guest,'#peerRoomBack'),true,'Peer Room guest lobby needs a visible Back button');

  const spectators=[];
  for(const seat of [3,4]){
    const context=await chrome.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(`P${seat} ${e.message}`));
    await page.goto(invite,{waitUntil:'domcontentloaded'});await waitRuntime(page);
    await page.waitForFunction(seat=>globalThis.peerRoomGameplayReady&&peerRoom.active&&peerRoom.seat===seat,seat,{timeout:20000});spectators.push(page);
  }

  const originalSeat=await guest.evaluate(()=>peerRoom.seat);
  await guest.evaluate(()=>peerRoom.conn?.close());
  await guest.waitForFunction(seat=>peerRoom.active&&peerRoom.conn?.open&&peerRoom.seat===seat,originalSeat,{timeout:30000});
  await host.waitForFunction(()=>peerRoom.seats.some(s=>s.seat===2&&s.connected),{timeout:10000});
  const recovery=await guest.evaluate(()=>({seat:peerRoom.seat,attempt:peerRoomRecoveryState.attempt,connecting:peerRoomRecoveryState.connecting,retryHidden:document.getElementById('peerRoomRetryConnection')?.hidden}));
  assert.equal(recovery.seat,2,'guest must reclaim Player 2');assert.equal(recovery.attempt,0,'recovery backoff must reset after welcome');assert.equal(recovery.connecting,false);assert.equal(recovery.retryHidden,true,'manual retry hides after recovery');

  const start=host.locator('#peerRoomStartGame');await start.waitFor({state:'visible',timeout:5000});await start.tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  for(const page of spectators)await page.waitForFunction(()=>peerRoomMatch.phase==='active'&&peerRoomMatch.watching,{timeout:10000});
  assert.equal(await visible(host,'#peerRoomMatchLobbyButton'),true,'live host match needs a Back/Lobby control');
  assert.equal(await visible(guest,'#peerRoomMatchLobbyButton'),true,'live guest match needs a Back/Lobby control');

  for(const [label,page] of [['host',host],['guest',guest]]){
    const geometry=await page.evaluate(()=>{
      const board=document.getElementById('board').getBoundingClientRect();
      return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
        board:{left:board.left,right:board.right,top:board.top,bottom:board.bottom,width:board.width,height:board.height}};
    });
    assert.ok(geometry.scrollWidth<=geometry.width+1,`${label}: mobile page overflows horizontally`);
    assert.ok(geometry.board.width>0&&geometry.board.height>0,`${label}: mobile board is hidden`);
    assert.ok(geometry.board.left>=-1&&geometry.board.right<=geometry.width+1,`${label}: mobile board is clipped horizontally`);
    assert.ok(geometry.board.top>=-1&&geometry.board.bottom<=geometry.height+1,`${label}: mobile board is clipped vertically`);
    await page.screenshot({path:`artifacts/peer-room-mobile-match-${label}.png`});
  }

  await guest.locator('#peerRoomMatchLobbyButton').tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await sleep(150);
  assert.equal(await visible(host,'#peerRoomBack'),true,'host lobby must regain Back after returning from match');
  assert.equal(await visible(guest,'#peerRoomBack'),true,'guest lobby must regain Back after returning from match');
  // Independent regular Direct Duel: the toolbar action must actually leave the match.
  const regularHostCtx=await chrome.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true}),regularGuestCtx=await wk.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const regularHost=await regularHostCtx.newPage(),regularGuest=await regularGuestCtx.newPage();
  for(const page of [regularHost,regularGuest])page.on('pageerror',e=>errors.push(`DIRECT ${e.message}`));
  await regularHost.goto(BASE,{waitUntil:'domcontentloaded'});await waitRuntime(regularHost);
  await regularHost.evaluate(()=>{openDuelHub();directCreateNearby()});
  await regularHost.waitForFunction(()=>document.getElementById('duelDirectSignal').value.includes('#'),{timeout:20000});
  const directInvite=await regularHost.locator('#duelDirectSignal').inputValue();
  await regularGuest.goto(directInvite,{waitUntil:'domcontentloaded'});await waitRuntime(regularGuest);
  for(const page of [regularHost,regularGuest])await page.locator('#duelReadyButton').waitFor({state:'visible',timeout:25000});
  await regularHost.locator('#duelReadyButton').tap();await regularGuest.locator('#duelReadyButton').tap();
  for(const page of [regularHost,regularGuest]){
    await page.waitForFunction(()=>duelSession.active,{timeout:15000});
    const lobby=page.locator('#c4UniversalBack');await lobby.waitFor({state:'visible',timeout:5000});
    assert.equal(await lobby.textContent(),'← Lobby');
    assert.equal(await lobby.evaluate(el=>getComputedStyle(el).position),'static','regular Lobby must be anchored');
  }
  await regularGuest.locator('#c4UniversalBack').tap();
  await regularGuest.waitForFunction(()=>!duelSession.active&&!directDuel.active&&document.getElementById('duelEntryPanel').getClientRects().length>0,{timeout:10000});
  await regularHost.waitForFunction(()=>!directDuel.active,{timeout:10000});
  await regularGuest.screenshot({path:'artifacts/direct-duel-return-lobby.png'});
  assert.deepEqual(errors,[],'browser page errors occurred');

  await host.screenshot({path:'artifacts/peer-room-recovery-host.png'});await guest.screenshot({path:'artifacts/peer-room-recovery-guest.png'});
  console.log('PASS Peer Room 0.20.6 real-browser recovery/nav: WebKit guest reconnects to the same seat after DataConnection close, retry state resets, and Back controls remain available in lobby and live match.');
} finally {for(const browser of browsers)await browser.close().catch(()=>{})}
