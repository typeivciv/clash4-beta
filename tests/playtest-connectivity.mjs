import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';

const live='https://typeivciv.github.io/clash4-beta/multiplayer-alpha.html';
const mode=process.env.C4_MODE;
const engines={chromium,webkit}, results=[];
const wait=(page,fn,arg,timeout=25000)=>page.waitForFunction(fn,arg,{timeout});
async function details(page){
  return page.evaluate(async()=>{
    const room=typeof peerRoom!=='undefined'?peerRoom:null;
    const direct=typeof directPeerSession!=='undefined'?directPeerSession:null;
    const pc=typeof directDuel!=='undefined'?directDuel.pc:null;
    const report=globalThis.c4ConnectionDiagnostics?JSON.parse(await c4ConnectionDiagnostics.report()):{};
    return {version:typeof ALPHA_TESTER_VERSION==='string'?ALPHA_TESTER_VERSION:null,
      broker:room?.peer?.open||direct?.peer?.open||false,
      directOpen:direct?.opened||false,roomSeat:room?.seat||null,
      state:pc?.connectionState||null,ice:pc?.iceConnectionState||null,
      status:['duelDirectStatus','peerRoomStatus','duelEntryStatus'].map(id=>document.getElementById(id)?.textContent?.trim()).filter(Boolean),
      attempts:(report.attempts||[]).map(x=>({mode:x.mode,role:x.role,ice:x.ice,connection:x.connection,localTypes:x.localTypes,remoteTypes:x.remoteTypes,errors:x.errors,route:x.route,dataError:x.dataError}))};
  }).catch(()=>({unavailable:true}));
}
async function test(label,hostEngine,guestEngine,relay,scenario){
  const browsers=[],pages=[];let stage='launch';
  const step=name=>{stage=name;console.log('STAGE',label,name)};
  try{
    for(const engine of guestEngine?[hostEngine,guestEngine]:[hostEngine]){
      const browser=await engines[engine].launch();browsers.push(browser);
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      if(relay)await context.addInitScript(()=>{
        const RTC=window.RTCPeerConnection;
        window.RTCPeerConnection=class extends RTC {
          constructor(config){super({...config,iceTransportPolicy:'relay'})}
        };
      });
      pages.push(await context.newPage());
    }
    await scenario(pages,step);results.push({label,pass:true,stage});
  }catch(error){results.push({label,pass:false,stage,error:String(error.message).split('\n')[0]})}
  finally{
    const observed=await Promise.all(pages.map(details));
    console.log('CONNECTIVITY',JSON.stringify({...results.at(-1),observed}));
    await Promise.all(browsers.map(b=>b.close().catch(()=>{})));
  }
}
async function startAndMove(host,guest,room,step){
  step('start-match');
  if(room)await host.locator('#peerRoomStartGame').tap({timeout:10000});
  else for(const page of [host,guest])await page.locator('#duelReadyButton').tap({timeout:10000});
  await Promise.all([host,guest].map(p=>wait(p,()=>duelSession.active,undefined,12000)));
  step('first-move');
  const mover=(await host.evaluate(()=>s.turn===H))?host:guest;
  await mover.locator('.cell.can').first().tap({timeout:10000});
  await Promise.all([host,guest].map(p=>wait(p,()=>s.moveNumber===1&&!busy,undefined,18000)));
}
async function pair([host,guest],step,room,relay=false){
  step('load-live-runtime');
  await host.goto(live,{waitUntil:'domcontentloaded',timeout:25000});
  await wait(host,()=>globalThis.peerRoomGameplayReady&&typeof Peer==='function');
  step('broker-create-invite');
  if(room)await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  else await host.evaluate(()=>{openDuelHub();directCreateNearby()});
  await wait(host,room?()=>peerRoom.active&&peerRoom.peer?.open:()=>document.getElementById('duelDirectSignal').value.includes('#c4peer='));
  const invite=await host.evaluate(room=>room?peerRoomInviteLink():document.getElementById('duelDirectSignal').value,room);
  step('invite-join-and-data-channel');
  await guest.goto(invite,{waitUntil:'domcontentloaded',timeout:25000});
  await wait(guest,()=>globalThis.peerRoomGameplayReady&&typeof Peer==='function');
  if(room)await wait(guest,()=>peerRoom.active&&peerRoom.seat===2&&peerRoom.conn?.open,undefined,45000);
  else await wait(guest,()=>directPeerSession.opened&&directDuel.channel?.readyState==='open',undefined,45000);
  if(room&&!relay){
    const spectators=[];
    try{
      for(const seat of [3,4]){
        step('join-seat-'+seat);
        const context=await host.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        const page=await context.newPage();spectators.push([context,page]);
        await page.goto(invite,{waitUntil:'domcontentloaded',timeout:25000});
        await wait(page,()=>globalThis.peerRoomGameplayReady&&typeof Peer==='function');
        await wait(page,n=>peerRoom.active&&peerRoom.seat===n&&peerRoom.conn?.open,seat,35000);
      }
      await startAndMove(host,guest,true,step);
      step('four-seat-move-propagation');
      await Promise.all(spectators.map(([,page])=>wait(page,()=>peerRoomMatch.watching&&s.moveNumber===1,undefined,15000)));
    }finally{await Promise.all(spectators.map(([context])=>context.close()))}
  }else await startAndMove(host,guest,room,step);
}
if(mode==='direct'||mode==='room'){
  const room=mode==='room';
  await test(mode+'-chromium-host','chromium','webkit',false,(pages,step)=>pair(pages,step,room));
  await test(mode+'-webkit-host','webkit','chromium',false,(pages,step)=>pair(pages,step,room));
  await test(mode+'-relay-required','chromium','chromium',true,(pages,step)=>pair(pages,step,room,true));
}else{
  await test('manual-direct','chromium','webkit',false,async([host,guest],step)=>{
    step('load-live-runtime');await Promise.all([host,guest].map(p=>p.goto(live,{waitUntil:'domcontentloaded',timeout:25000})));
    step('manual-offer-answer');
    await host.evaluate(()=>directCreate('remote'));
    const offer=await host.locator('#duelDirectSignal').inputValue();
    assert.ok(offer,'host offer empty');
    await guest.evaluate(offer=>directJoinSignal(offer,'remote'),offer);
    const answer=await guest.locator('#duelDirectSignal').inputValue();
    assert.ok(answer,'guest answer empty');
    await host.evaluate(answer=>directAcceptAnswer(answer),answer);
    step('manual-data-channel');await wait(guest,()=>directDuel.channel?.readyState==='open',undefined,35000);
    await startAndMove(host,guest,false,step);
  });
  await test('pass-and-play-offline','chromium',null,false,async([page],step)=>{
    await page.goto(live,{waitUntil:'domcontentloaded',timeout:25000});
    await page.context().setOffline(true);
    step('first-handoff');await page.evaluate(()=>startPassPlay());
    await page.locator('#passDuelContinue').tap({timeout:10000});
    await page.locator('.cell.can').first().tap({timeout:10000});
    step('second-handoff');await page.locator('#passDuelContinue').tap({timeout:10000});
    await wait(page,()=>passDuel.active&&passDuel.state.moveNumber===1);
  });
  await test('hosted-room-fresh-browser','chromium',null,false,async([page],step)=>{
    await page.goto(live,{waitUntil:'domcontentloaded',timeout:25000});
    step('hosted-server-configuration');await page.evaluate(()=>openDuelLobby());
    const server=await page.locator('#duelServerInput').inputValue();
    assert.ok(server,'Hosted Room has no server URL on a fresh browser');
    step('hosted-health');assert.ok(await page.evaluate(()=>duelHealthCheck()));
  });
}
if(results.some(x=>!x.pass))process.exitCode=1;
