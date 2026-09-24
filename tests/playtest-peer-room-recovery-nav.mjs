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

  await guest.goto(invite,{waitUntil:'domcontentloaded'});await waitRuntime(guest);
  await guest.waitForFunction(()=>peerRoom.active&&Number(peerRoom.seat)===2&&peerRoom.conn?.open,{timeout:25000});
  await host.waitForFunction(()=>peerRoom.seats.some(s=>s.seat===2&&s.connected),{timeout:10000});
  assert.equal(await visible(guest,'#peerRoomBack'),true,'Peer Room guest lobby needs a visible Back button');

  const originalSeat=await guest.evaluate(()=>peerRoom.seat);
  await guest.evaluate(()=>peerRoom.conn?.close());
  await guest.waitForFunction(seat=>peerRoom.active&&peerRoom.conn?.open&&peerRoom.seat===seat,originalSeat,{timeout:30000});
  await host.waitForFunction(()=>peerRoom.seats.some(s=>s.seat===2&&s.connected),{timeout:10000});
  const recovery=await guest.evaluate(()=>({seat:peerRoom.seat,attempt:peerRoomRecoveryState.attempt,connecting:peerRoomRecoveryState.connecting,retryHidden:document.getElementById('peerRoomRetryConnection')?.hidden}));
  assert.equal(recovery.seat,2,'guest must reclaim Player 2');assert.equal(recovery.attempt,0,'recovery backoff must reset after welcome');assert.equal(recovery.connecting,false);assert.equal(recovery.retryHidden,true,'manual retry hides after recovery');

  const start=host.locator('#peerRoomStartGame');await start.waitFor({state:'visible',timeout:5000});await start.tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  assert.equal(await visible(host,'#peerRoomMatchLobbyButton'),true,'live host match needs a Back/Lobby control');
  assert.equal(await visible(guest,'#peerRoomMatchLobbyButton'),true,'live guest match needs a Back/Lobby control');

  await guest.locator('#peerRoomMatchLobbyButton').tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='lobby',{timeout:10000});
  await sleep(150);
  assert.equal(await visible(host,'#peerRoomBack'),true,'host lobby must regain Back after returning from match');
  assert.equal(await visible(guest,'#peerRoomBack'),true,'guest lobby must regain Back after returning from match');
  assert.deepEqual(errors,[],'browser page errors occurred');

  await host.screenshot({path:'artifacts/peer-room-recovery-host.png'});await guest.screenshot({path:'artifacts/peer-room-recovery-guest.png'});
  console.log('PASS Peer Room 0.20.6 real-browser recovery/nav: WebKit guest reconnects to the same seat after DataConnection close, retry state resets, and Back controls remain available in lobby and live match.');
} finally {for(const browser of browsers)await browser.close().catch(()=>{})}