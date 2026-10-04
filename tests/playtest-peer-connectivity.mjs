import {chromium,webkit} from 'playwright';

const BASE=process.env.C4_CONNECT_BASE||'http://127.0.0.1:8080/multiplayer-alpha.html';
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>globalThis.peerRoomGameplayReady,{timeout:25000});
    for(const url of ['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443?transport=tcp','turns:openrelay.metered.ca:443?transport=tcp']){
      const sample=await page.evaluate(async url=>{
        const pc=new RTCPeerConnection({iceServers:[{urls:url,username:'openrelayproject',credential:'openrelayproject'}],iceTransportPolicy:'relay'});
        const candidates=[],errors=[];pc.onicecandidate=e=>{if(e.candidate)candidates.push({type:e.candidate.type,protocol:e.candidate.protocol})};
        pc.onicecandidateerror=e=>errors.push({code:e.errorCode,text:e.errorText,url:e.url});
        const done=new Promise(resolve=>{const timer=setTimeout(resolve,12000);pc.onicegatheringstatechange=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()}}});
        pc.createDataChannel('relay-probe');await pc.setLocalDescription(await pc.createOffer());await done;const gathering=pc.iceGatheringState;pc.close();return {candidates,errors,gathering}
      },url);
      console.log('RELAY_PROBE',name,url,JSON.stringify(sample));
    }
  }finally{await browser.close()}
}
