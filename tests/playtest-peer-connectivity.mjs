import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.C4_CONNECT_BASE||'http://127.0.0.1:8080/multiplayer-alpha.html';
const engines={};let configured=false;
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.peerRoomGameplayReady,{timeout:25000});
    await page.evaluate(()=>c4PreparePeerNetwork());
    configured=await page.evaluate(()=>c4PeerNetwork.state.source==='configured');
    await Promise.all(['runtime-config','turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443?transport=tcp','turn:staticauth.openrelay.metered.ca:80','turn:staticauth.openrelay.metered.ca:443?transport=tcp','turns:staticauth.openrelay.metered.ca:443?transport=tcp'].map(async url=>{
      const sample=await page.evaluate(async url=>{
        let username='openrelayproject',credential='openrelayproject';
        if(url.includes('staticauth.')){
          // Provider-published public static-auth test service, not an account key.
          username=String(Math.floor(Date.now()/1000)+86400);
          const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('openrelayprojectsecret'),{name:'HMAC',hash:'SHA-1'},false,['sign']);
          const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
          credential=btoa(String.fromCharCode(...digest));
        }
        const iceServers=url==='runtime-config'?DIRECT_RTC_CONFIG.iceServers:[{urls:url,username,credential}];
        const pc=new RTCPeerConnection({iceServers,iceTransportPolicy:'relay'});
        const candidates=[],errors=[];pc.onicecandidate=e=>{if(e.candidate)candidates.push({type:e.candidate.type,protocol:e.candidate.protocol})};
        pc.onicecandidateerror=e=>errors.push({code:e.errorCode,text:e.errorText,url:e.url});
        const done=new Promise(resolve=>{const timer=setTimeout(resolve,12000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()}}});
        pc.createDataChannel('relay-probe');await pc.setLocalDescription(await pc.createOffer());await done;const gathering=pc.iceGatheringState;pc.close();return {candidates,errors,gathering}
      },url);
      console.log('RELAY_PROBE',name,url,JSON.stringify(sample));
      if(url==='runtime-config'&&configured)assert.ok(sample.candidates.some(x=>x.type==='relay'),`${name}: configured service must allocate a relay candidate`);
    }));
  }finally{await browser.close()}
}
if(!configured){
  console.log('BLOCKED: no managed relay is configured; diagnostics are not a mobile-data connection PASS.');
}else{
  for(const [name,engine] of [['chromium',chromium],['webkit',webkit]])engines[name]=await engine.launch({headless:true});
  try{
    for(const mode of ['direct','peer'])for(const appleHost of [false,true]){
      const contexts=[],pages=[];
      for(const apple of [appleHost,!appleHost]){
        const context=await engines[apple?'webkit':'chromium'].newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});contexts.push(context);
        await context.addInitScript(()=>{
          const Native=RTCPeerConnection;
          globalThis.RTCPeerConnection=class extends Native{constructor(config,...rest){super({...config,iceTransportPolicy:'relay'},...rest)}}
        });pages.push(await context.newPage())
      }
      const [host,guest]=pages,errors=[];for(const page of pages)page.on('pageerror',error=>errors.push(error.message));
      try{
        await host.goto(BASE,{waitUntil:'domcontentloaded'});await host.waitForFunction(()=>globalThis.peerRoomGameplayReady,{timeout:25000});
        let invite;
        if(mode==='peer'){
          await host.evaluate(()=>peerRoomFoundation.create());await host.waitForFunction(()=>peerRoom.active&&peerRoom.hostId,{timeout:25000});invite=await host.evaluate(()=>peerRoomInviteLink())
        }else{
          await host.evaluate(()=>{openDuelHub();return directCreateNearby()});await host.waitForFunction(()=>document.getElementById('duelDirectSignal').value.includes('#'),{timeout:25000});invite=await host.locator('#duelDirectSignal').inputValue()
        }
        await guest.goto(invite,{waitUntil:'domcontentloaded'});
        if(mode==='peer'){
          await guest.waitForFunction(()=>peerRoom.seat===2&&peerRoom.active,{timeout:45000});await host.locator('#peerRoomStartGame').tap()
        }else{
          for(const page of pages)await page.locator('#duelReadyButton').waitFor({state:'visible',timeout:45000});
          await host.locator('#duelReadyButton').tap();await guest.locator('#duelReadyButton').tap()
        }
        for(const page of pages){
          await page.waitForFunction(()=>duelSession.active&&!busy,{timeout:15000});
          await page.waitForFunction(async mode=>{
            const conn=mode==='direct'?directPeerSession.conn:peerRoom.role==='host'?peerRoom.connections.get(2):peerRoom.conn;
            return await directAlphaRouteKind(conn)==='relay'
          },mode,{timeout:10000})
        }
        const mover=await host.evaluate(()=>s.turn===H)?host:guest;await mover.locator('.cell.can').first().tap();
        for(const page of pages)await page.waitForFunction(()=>s.moveNumber===1&&!busy,{timeout:15000});
        assert.deepEqual(errors,[]);console.log('PASS forced relay join + canonical move',mode,appleHost?'WebKit host':'WebKit guest')
      }finally{for(const context of contexts)await context.close()}
    }
  }finally{for(const browser of Object.values(engines))await browser.close()}
}
