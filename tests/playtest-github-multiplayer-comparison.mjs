import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base=(process.env.C4_COMPARE_URL||'http://127.0.0.1:8080/multiplayer-check/').replace(/\/?$/,'/');
const engines={chromium,webkit};
const hostName=process.env.C4_HOST||'chromium';
const guestName=hostName==='chromium'?'webkit':'chromium';
const wait=(page,fn,ms=25000)=>page.waitForFunction(fn,null,{timeout:ms});
const browsers={};
const failures=[];

try{
  for(const name of [hostName,guestName])browsers[name]=await engines[name].launch();
  for(const version of ['0.20.10','0.20.11'])for(const mode of ['direct','room']){
    const contexts=[],pages=[];
    try{
      for(const name of [hostName,guestName]){
        const context=await browsers[name].newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
        contexts.push(context);
        pages.push(await context.newPage());
      }
      const [host,guest]=pages;
      const url=new URL(version+'/multiplayer-alpha.html',base);
      await host.goto(url.href,{waitUntil:'domcontentloaded'});
      await wait(host,()=>globalThis.peerRoomRenderSync);
      assert.equal(await host.evaluate(()=>ALPHA_TESTER_VERSION),version);
      let invite;
      if(mode==='room'){
        await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
        await wait(host,()=>peerRoom.active&&peerRoom.hostId);
        invite=await host.evaluate(()=>peerRoomInviteLink());
      }else{
        await host.evaluate(()=>{openDuelHub();directCreateNearby()});
        await wait(host,()=>document.getElementById('duelDirectSignal').value.includes('#c4peer='));
        invite=await host.locator('#duelDirectSignal').inputValue();
      }
      assert.equal(new URL(invite).pathname,url.pathname,'invite must keep the exact same version');
      await guest.goto(invite,{waitUntil:'domcontentloaded'});
      await wait(guest,()=>globalThis.peerRoomRenderSync);
      assert.equal(await guest.evaluate(()=>ALPHA_TESTER_VERSION),version);
      if(mode==='room'){
        await wait(guest,()=>peerRoom.active&&peerRoom.seat===2&&peerRoom.conn?.open,35000);
        await host.locator('#peerRoomStartGame').tap({timeout:12000});
      }else{
        for(const page of pages)await page.locator('#duelReadyButton').tap({timeout:35000});
      }
      await Promise.all(pages.map(page=>wait(page,()=>duelSession.active&&!busy)));
      const mover=(await host.evaluate(()=>s.turn===H))?host:guest;
      await mover.locator('.cell.can').first().tap({timeout:12000});
      await Promise.all(pages.map(page=>wait(page,()=>s.moveNumber===1&&!busy)));
      const routes=await Promise.all(pages.map(page=>page.evaluate(async mode=>{
        const conn=mode==='room'?(peerRoom.role==='host'?peerRoom.connections.get(2):peerRoom.conn):directPeerSession.conn;
        return await directAlphaRouteKind(conn);
      },mode)));
      console.log('PASS',JSON.stringify({version,mode,host:hostName,firstMove:'both phones',routes}));
    }catch(error){
      const evidence=await Promise.all(pages.map(page=>page.evaluate(async()=>{
        const report=JSON.parse(await c4ConnectionDiagnostics.report());
        return (report.attempts||[]).map(({role,ice,connection,localTypes,remoteTypes,route,errors})=>({
          role,ice,connection,localTypes,remoteTypes,route,codes:[...new Set(errors.map(e=>e.code))]
        }));
      }).catch(()=>[])));
      failures.push({version,mode});
      console.error('FAIL',JSON.stringify({version,mode,host:hostName,error:error.message.split('\n')[0],evidence}));
    }finally{await Promise.all(contexts.map(context=>context.close()))}
  }
  assert.deepEqual(failures,[],'Compare both releases before attributing a failure to a build');
}finally{await Promise.all(Object.values(browsers).map(browser=>browser.close()))}
