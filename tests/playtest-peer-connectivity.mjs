import {chromium,webkit} from 'playwright';

const BASE=process.env.C4_CONNECT_BASE||'http://127.0.0.1:8080/multiplayer-alpha.html';
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.peerRoomGameplayReady,{timeout:25000});
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
    }));
  }finally{await browser.close()}
}
