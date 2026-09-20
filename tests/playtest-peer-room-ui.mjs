import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=ui0204';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const browsers=[];

async function ready(page){
  await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomMatch&&globalThis.peerRoomTransaction,{timeout:20000});
  await page.evaluate(()=>{
    globalThis.__uiDrops=[];
    const old=globalThis.emitFeedback;
    if(typeof old==='function')globalThis.emitFeedback=function(kind,...args){
      if(kind==='drop')try{__uiDrops.push({t:performance.now(),move:s.moveNumber,column:dropPresentation?.column,owner:dropPresentation?.owner})}catch{}
      return old.call(this,kind,...args)
    }
  })
}

async function state(page){
  return page.evaluate(()=>{
    const seat=Number(peerRoom.seat), st=s;
    const physical=o=>o==='human'?seat:o==='ai'?(seat===1?2:1):null;
    return {
      seat,move:st.moveNumber,turnSeat:physical(st.turn),busy:!!busy,handled:duelSession.handledVersion,
      heights:st.board.map(c=>c.length),occupancy:st.board.map(c=>c.map(p=>physical(p.owner))),
      drops:[...(__uiDrops||[])],
      choices:[...document.querySelectorAll('.choice')].map((e,i)=>({i,text:e.textContent.trim().replace(/\s+/g,' '),disabled:e.disabled,selected:e.classList.contains('sel'),hidden:!!e.hidden,rect:{w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}})),
      canCells:[...document.querySelectorAll('.cell.can')].map((e,i)=>({i,aria:e.getAttribute('aria-label'),text:e.textContent.trim(),cls:e.className,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}})),
      discs:[...document.querySelectorAll('.disc')].map(e=>({cls:e.className,text:e.textContent.trim(),transform:getComputedStyle(e).transform,opacity:getComputedStyle(e).opacity,rect:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}}))
    }
  })
}

function sameBoard(a,b,msg){assert.deepEqual(a.occupancy,b.occupancy,msg);assert.deepEqual(a.heights,b.heights,msg+' heights')}

async function tapRealMove(page,index){
  await page.waitForFunction(()=>s.turn==='human'&&!busy&&document.querySelectorAll('.cell.can').length>0,{timeout:9000});
  const before=await state(page);
  let selected=page.locator('.choice.sel:not([disabled])').first();
  if(await selected.count()===0){
    const enabled=page.locator('.choice:not([disabled])').filter({visible:true}).first();
    assert.ok(await enabled.count(),`move ${index}: no enabled piece choice`);
    await enabled.tap();
  }
  await page.waitForFunction(()=>document.querySelectorAll('.cell.can').length>0,{timeout:3000});
  const cells=page.locator('.cell.can');
  const count=await cells.count();assert.ok(count>0,`move ${index}: no tappable board cell`);
  const target=cells.first();
  await target.tap();
  return before.move
}

try{
  const chrome=await chromium.launch({headless:true});browsers.push(chrome);
  const wk=await webkit.launch({headless:true});browsers.push(wk);
  const hc=await chrome.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const gc=await wk.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const host=await hc.newPage(),guest=await gc.newPage();
  const errors=[];
  host.on('pageerror',e=>errors.push('HOST '+e.message));guest.on('pageerror',e=>errors.push('GUEST '+e.message));

  await host.goto(BASE,{waitUntil:'domcontentloaded'});await ready(host);
  await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  await host.waitForFunction(()=>peerRoom.active&&peerRoom.role==='host'&&peerRoom.hostId,{timeout:20000});
  const invite=await host.evaluate(()=>peerRoomInviteLink());
  await guest.goto(invite,{waitUntil:'domcontentloaded'});await ready(guest);
  await guest.waitForFunction(()=>peerRoom.active&&Number(peerRoom.seat)===2,{timeout:25000});
  await host.waitForFunction(()=>peerRoom.seats.some(x=>x.seat===2&&x.connected),{timeout:10000});

  const start=host.locator('#peerRoomStartGame');
  await start.waitFor({state:'visible',timeout:5000});assert.equal(await start.isDisabled(),false,'real Start Match button stayed disabled');
  await start.tap();
  await host.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch.phase==='active'&&duelSession.active,{timeout:10000});

  let hs=await state(host),gs=await state(guest);sameBoard(hs,gs,'match start board mismatch');assert.equal(hs.turnSeat,gs.turnSeat,'match start physical turn mismatch');
  console.log('START',JSON.stringify({host:{turn:hs.turnSeat,choices:hs.choices,can:hs.canCells.length},guest:{turn:gs.turnSeat,choices:gs.choices,can:gs.canCells.length}}));

  for(let i=1;i<=6;i++){
    hs=await state(host);gs=await state(guest);sameBoard(hs,gs,`move ${i} before board mismatch`);assert.equal(hs.turnSeat,gs.turnSeat,`move ${i} turn mismatch before tap`);
    const mover=hs.turnSeat===1?host:guest;
    const beforeMove=await tapRealMove(mover,i);
    await sleep(35);
    const earlyH=await state(host),earlyG=await state(guest);
    console.log(`MOVE ${i} 35ms`,JSON.stringify({host:{move:earlyH.move,busy:earlyH.busy,drops:earlyH.drops.length,discs:earlyH.discs},guest:{move:earlyG.move,busy:earlyG.busy,drops:earlyG.drops.length,discs:earlyG.discs}}));
    await host.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:9000});
    await guest.waitForFunction(n=>s.moveNumber>=n&&!busy,beforeMove+1,{timeout:9000});
    const afterH=await state(host),afterG=await state(guest);
    sameBoard(afterH,afterG,`move ${i} final board mismatch`);assert.equal(afterH.move,beforeMove+1,`move ${i} host move count`);assert.equal(afterG.move,beforeMove+1,`move ${i} guest move count`);assert.equal(afterH.turnSeat,afterG.turnSeat,`move ${i} final turn mismatch`);assert.equal(afterH.drops.length,i,`move ${i} host emitted duplicate/missing drop`);assert.equal(afterG.drops.length,i,`move ${i} guest emitted duplicate/missing drop`);
    console.log(`MOVE ${i} FINAL`,JSON.stringify({move:afterH.move,turn:afterH.turnSeat,heights:afterH.heights,hostDrops:afterH.drops.length,guestDrops:afterG.drops.length}));
  }

  await host.screenshot({path:'artifacts/peer-room-ui-host.png'});await guest.screenshot({path:'artifacts/peer-room-ui-guest.png'});
  assert.deepEqual(errors,[],'browser page errors occurred');
  console.log('PASS touch-level Peer Room UI playtest: actual Start Match, piece controls and board taps stayed synchronized with one drop per client.');
} finally {for(const b of browsers)await b.close().catch(()=>{})}
