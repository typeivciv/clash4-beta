// The provider publishes the static-auth test secret and endpoints:
// https://www.metered.ca/tools/openrelay/#-static-auth
import {createHmac,randomBytes} from 'node:crypto';
import {chromium} from 'playwright';

const username=Math.floor(Date.now()/1000+600)+':clash4-probe-'+randomBytes(5).toString('hex');
const credential=createHmac('sha1','openrelayprojectsecret').update(username).digest('base64');
const endpoints=[
  ['legacy UDP', 'turn:openrelay.metered.ca:80?transport=udp', 'openrelayproject','openrelayproject'],
  ['legacy TCP', 'turn:openrelay.metered.ca:443?transport=tcp', 'openrelayproject','openrelayproject'],
  ['static UDP', 'turn:staticauth.openrelay.metered.ca:443?transport=udp', username,credential],
  ['static TCP', 'turn:staticauth.openrelay.metered.ca:443?transport=tcp', username,credential],
  ['static TLS', 'turns:staticauth.openrelay.metered.ca:443?transport=tcp', username,credential]
];

const browser=await chromium.launch();
try {
  const page=await browser.newPage();
  const reports=await page.evaluate(async entries=>Promise.all(entries.map(async ([label,urls,username,credential])=>{
    const config={iceTransportPolicy:'relay',iceServers:[{urls,username,credential}]};
    const a=new RTCPeerConnection(config),b=new RTCPeerConnection(config);
    const errors=new Set(),candidateCounts=[0,0];
    let timeout;
    const completed=new Promise(resolve=>{
      b.ondatachannel=e=>e.channel.onmessage=m=>e.channel.send(m.data);
      timeout=setTimeout(()=>resolve(false),16000);
    });
    for(const [i,local,remote] of [[0,a,b],[1,b,a]]){
      local.onicecandidate=e=>{
        if(e.candidate?.type==='relay')candidateCounts[i]++;
        if(e.candidate&&remote.remoteDescription)remote.addIceCandidate(e.candidate).catch(()=>{});
      };
      local.onicecandidateerror=e=>errors.add(e.errorCode);
    }
    const signal=a.createDataChannel('probe');
    const roundtrip=new Promise(resolve=>{
      signal.onopen=()=>signal.send('clash4-relay');
      signal.onmessage=e=>resolve(e.data==='clash4-relay')
    });
    try{
      // Collect both streams while setting remote descriptions; flushing keeps
      // candidates that arrive before their matching offer/answer.
      const earlyA=[],earlyB=[];
      a.addEventListener('icecandidate',e=>{if(e.candidate&&!b.remoteDescription)earlyA.push(e.candidate)});
      b.addEventListener('icecandidate',e=>{if(e.candidate&&!a.remoteDescription)earlyB.push(e.candidate)});
      await a.setLocalDescription(await a.createOffer());
      await b.setRemoteDescription(a.localDescription);
      await Promise.all(earlyA.map(c=>b.addIceCandidate(c)));
      await b.setLocalDescription(await b.createAnswer());
      await a.setRemoteDescription(b.localDescription);
      await Promise.all(earlyB.map(c=>a.addIceCandidate(c)));
      const passed=await Promise.race([roundtrip,completed]);
      return {label,passed,candidateCounts,errors:[...errors]};
    }finally{clearTimeout(timeout);a.close();b.close()}
  })),endpoints);
  for(const report of reports)console.log(JSON.stringify(report));
  if(!reports.some(r=>r.passed))process.exitCode=1;
}finally{await browser.close()}
