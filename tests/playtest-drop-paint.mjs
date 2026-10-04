import { chromium, webkit } from 'playwright';
import { PNG } from 'pngjs';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=paint0209';
const browsers=[];
async function runtime(page){await page.waitForFunction(()=>globalThis.c4DropRendering&&globalThis.peerRoomGameplayReady,{timeout:20000})}
async function installProbe(page){
  await page.evaluate(()=>{
    globalThis.__paintProbe={active:true,commit:null};
    const original=scheduleTimer;
    // Freeze the visual fixture so screenshots can inspect intermediate paint.
    // Shared-room completion already waits for animation.finished; Direct Duel
    // uses a separate timer, which is released after sampling the same drop.
    scheduleTimer=function(name,callback,delay){if(name==='drop'&&__paintProbe.active){__paintProbe.commit=callback;return}return original(name,callback,delay)};
    globalThis.__releasePaintCommit=()=>{__paintProbe.active=false;const callback=__paintProbe.commit;__paintProbe.commit=null;if(callback)callback()}
  })
}
async function freeze(page,mode){
  await page.waitForFunction(mode=>{
    const ghost=document.querySelector('#board .disc.justDropped');
    const animation=mode==='peer'?peerRoomRenderSyncState.activeDrop?.animation:ghost?.getAnimations()[0];
    return ghost?.isConnected&&animation
  },mode,{timeout:10000});
  await page.evaluate(mode=>{
    const ghost=document.querySelector('#board .disc.justDropped');
    const animation=mode==='peer'?peerRoomRenderSyncState.activeDrop.animation:ghost.getAnimations()[0];
    __paintProbe.ghost=ghost;__paintProbe.animation=animation;animation.pause();animation.currentTime=0
  },mode)
}
async function paintedFrames(page,label){
  const samples=[];
  for(const fraction of [.06,.18,.84]){
    const geometry=await page.evaluate(async fraction=>{
      const {ghost,animation}=__paintProbe;animation.currentTime=animation.effect.getTiming().duration*fraction;
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const rect=ghost.getBoundingClientRect(),boardRect=board.getBoundingClientRect();
      const column=dropPresentation.column,row=dropPresentation.targetRow,cell=board.querySelectorAll('.cell')[row*COLS+column],slot=cell.getBoundingClientRect();
      return {inButton:!!ghost.closest('button'),distance:ghost.style.getPropertyValue('--drop-distance'),
        center:{x:rect.left+rect.width/2,y:rect.top+rect.height/2},width:rect.width,height:rect.height,
        targetY:slot.top+slot.height/2,boardTop:boardRect.top,boardHeight:boardRect.height}
    },fraction);
    assert.equal(geometry.inButton,false,`${label}: falling checker must leave native button paint containment`);
    assert.ok(geometry.distance.endsWith('px'),`${label}: travel distance must have a resolved pixel reference`);
    if(fraction===.06)assert.ok(geometry.center.y<geometry.targetY-geometry.height,`${label}: first sample must be visibly above the landing slot`);
    const visible=await page.screenshot({path:`artifacts/${label}-${Math.round(fraction*100)}.png`,scale:'css'});
    await page.evaluate(()=>{__paintProbe.ghost.style.setProperty('visibility','hidden','important')});
    const hidden=await page.screenshot({scale:'css'});
    await page.evaluate(()=>{__paintProbe.ghost.style.removeProperty('visibility')});
    const a=PNG.sync.read(visible),b=PNG.sync.read(hidden);let changed=0,total=0;
    const radius=Math.floor(Math.min(geometry.width,geometry.height)*.27);
    for(let y=Math.max(0,Math.floor(geometry.center.y)-radius);y<Math.min(a.height,Math.floor(geometry.center.y)+radius);y++){
      for(let x=Math.max(0,Math.floor(geometry.center.x)-radius);x<Math.min(a.width,Math.floor(geometry.center.x)+radius);x++){
        const index=(y*a.width+x)*4;total++;
        if(Math.abs(a.data[index]-b.data[index])+Math.abs(a.data[index+1]-b.data[index+1])+Math.abs(a.data[index+2]-b.data[index+2])>45)changed++
      }
    }
    assert.ok(total>20&&changed/total>.45,`${label}: checker is not actually painted along its fall at ${fraction} (${changed}/${total} pixels)`);
    samples.push({...geometry,fraction,painted:changed/total});
  }
  console.log('PAINT',label,JSON.stringify(samples.map(x=>({fraction:x.fraction,painted:x.painted,centerY:x.center.y,targetY:x.targetY}))));return samples
}
async function release(page,mode){
  await page.evaluate(mode=>{if(mode==='peer')__paintProbe.animation.finish();else{__paintProbe.animation.finish();__releasePaintCommit()}},mode)
}
try{
  const chrome=await chromium.launch({headless:true}),wk=await webkit.launch({headless:true});browsers.push(chrome,wk);
  for(const mode of ['direct','peer'])for(const appleHost of [false,true]){
    const hostBrowser=appleHost?wk:chrome,guestBrowser=appleHost?chrome:wk;
    const hostCtx=await hostBrowser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const guestCtx=await guestBrowser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    const host=await hostCtx.newPage(),guest=await guestCtx.newPage(),errors=[];
    for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
    await host.goto(BASE,{waitUntil:'domcontentloaded'});await runtime(host);
    let invite;
    if(mode==='peer'){
      await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
      await host.waitForFunction(()=>peerRoom.active&&peerRoom.hostId,{timeout:25000});invite=await host.evaluate(()=>peerRoomInviteLink())
    }else{
      await host.evaluate(()=>{openDuelHub();directCreateNearby()});
      await host.waitForFunction(()=>document.getElementById('duelDirectSignal').value.includes('#'),{timeout:25000});invite=await host.locator('#duelDirectSignal').inputValue()
    }
    await guest.goto(invite,{waitUntil:'domcontentloaded'});await runtime(guest);
    if(mode==='peer'){
      await guest.waitForFunction(()=>peerRoom.active&&peerRoom.seat===2,{timeout:30000});await host.locator('#peerRoomStartGame').tap()
    }else{
      for(const page of [host,guest])await page.locator('#duelReadyButton').waitFor({state:'visible',timeout:30000});
      await host.locator('#duelReadyButton').tap();await guest.locator('#duelReadyButton').tap()
    }
    for(const page of [host,guest]){await page.waitForFunction(()=>duelSession.active,{timeout:10000});await installProbe(page)}
    for(let column=0;column<2;column++){
      const hostTurn=await host.evaluate(()=>s.turn===H),mover=hostTurn?host:guest;
      for(const page of [host,guest])await page.waitForFunction(()=>!busy,{timeout:10000});
      await mover.evaluate(()=>{__paintProbe.active=true});await mover.locator(`.cell.can[data-column="${column}"]`).first().tap();
      const pages=mode==='peer'?[host,guest]:[mover];await Promise.all(pages.map(page=>freeze(page,mode)));
      for(const page of pages){const label=`drop-${mode}-${page===host?'host':'guest'}-${(page===host?appleHost:!appleHost)?'webkit':'chromium'}-c${column}`;await paintedFrames(page,label)}
      await Promise.all(pages.map(page=>release(page,mode)));
      for(const page of [host,guest])await page.waitForFunction(n=>s.moveNumber===n&&!busy,column+1,{timeout:10000});
    }
    assert.deepEqual(errors,[]);await hostCtx.close();await guestCtx.close();
  }
  console.log('PASS actual drop paint: Chromium and WebKit host/guest, Direct Duel CSS and shared-room WAAPI, three visible intermediate frames, same canonical move completion')
}finally{for(const browser of browsers)await browser.close().catch(()=>{})}
