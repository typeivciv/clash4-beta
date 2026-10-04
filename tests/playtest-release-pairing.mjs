import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const browsers={chromium:await chromium.launch({headless:true}),webkit:await webkit.launch({headless:true})};
const report=[];
async function sample(page){return page.evaluate(()=>({
  version:document.querySelector('.alphaTesterNotice')?.textContent||document.title,
  direct:{role:directDuel.role,active:directDuel.active,ice:directPeerSession.lastIce,connection:directPeerSession.lastConnection,status:document.getElementById('duelDirectStatus')?.textContent},
  room:{role:globalThis.peerRoom?.role,active:globalThis.peerRoom?.active,seat:globalThis.peerRoom?.seat,status:document.getElementById('peerRoomStatus')?.textContent},
  rtc:globalThis.__rtcTrace
}))}
try{
  for(const mode of ['direct','peer'])for(const appleHost of [false,true])for(const version of ['0.20.6','0.20.8','0.20.9']){
    const contexts=[],pages=[],errors=[];
    for(const apple of [appleHost,!appleHost]){
      const context=await browsers[apple?'webkit':'chromium'].newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});contexts.push(context);
      await context.addInitScript(()=>{
        globalThis.__rtcTrace=[];const Native=RTCPeerConnection;
        globalThis.RTCPeerConnection=class extends Native{constructor(config,...rest){
          super(config,...rest);const trace={pool:config?.iceCandidatePoolSize,candidates:[],errors:[],ice:[]};__rtcTrace.push(trace);
          this.addEventListener('icecandidate',e=>{if(e.candidate)trace.candidates.push({type:e.candidate.type,protocol:e.candidate.protocol})});
          this.addEventListener('icecandidateerror',e=>trace.errors.push({code:e.errorCode,url:e.url}));
          this.addEventListener('iceconnectionstatechange',()=>trace.ice.push(this.iceConnectionState))
        }}
      });const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));pages.push(page)
    }
    const [host,guest]=pages,result={version,mode,appleHost,connected:false,errors};
    try{
      await host.goto(`http://127.0.0.1:8080/artifacts/releases/${version}/multiplayer-alpha.html`,{waitUntil:'domcontentloaded'});
      await host.waitForFunction(()=>globalThis.peerRoomRenderSync,{timeout:25000});
      let invite;
      if(mode==='peer'){
        await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
        await host.waitForFunction(()=>peerRoom.active&&peerRoom.hostId,{timeout:25000});invite=await host.evaluate(()=>peerRoomInviteLink())
      }else{
        await host.evaluate(()=>{openDuelHub();directCreateNearby()});
        await host.waitForFunction(()=>document.getElementById('duelDirectSignal').value.includes('#'),{timeout:25000});invite=await host.locator('#duelDirectSignal').inputValue()
      }
      await guest.goto(invite,{waitUntil:'domcontentloaded'});
      if(mode==='peer'){
        await guest.waitForFunction(()=>peerRoom.active&&peerRoom.seat===2,{timeout:35000});
        await host.waitForFunction(()=>peerRoom.connections.get(2)?.open,{timeout:5000})
      }else{
        await Promise.all(pages.map(page=>page.waitForFunction(()=>directDuel.active,{timeout:35000})))
      }
      result.connected=true
    }catch(error){result.failure=error.message.split('\n')[0]}
    finally{
      result.host=await sample(host).catch(error=>({error:error.message}));result.guest=await sample(guest).catch(error=>({error:error.message}));
      for(const [index,page] of pages.entries())await page.screenshot({path:`artifacts/release-${version}-${mode}-${appleHost?'apple-host':'apple-guest'}-${index===0?'host':'guest'}.png`}).catch(()=>{});
      report.push(result);console.log('RELEASE_PAIRING',JSON.stringify(result));
      fs.writeFileSync('artifacts/release-pairing.json',JSON.stringify(report,null,2));
      for(const context of contexts)await context.close()
    }
  }
  console.log('COMPARISON',JSON.stringify(report.map(({version,mode,appleHost,connected,errors})=>({version,mode,appleHost,connected,errors}))));
}finally{for(const browser of Object.values(browsers))await browser.close()}
