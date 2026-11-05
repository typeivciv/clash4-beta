import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.C4_TARGET||'http://127.0.0.1:8080/multiplayer-alpha.html';
const hostName=process.env.C4_HOST||'chromium';
const suite=process.env.C4_SUITE||'all';
assert.ok(['all','relay','hosted'].includes(suite),'Unknown multiplayer gate suite');
const browsers={},contexts=[],pages=[],failures=[];
const wait=(p,fn,arg=null,timeout=30000)=>p.waitForFunction(fn,arg,{timeout});
async function client(engine,relay=true){
  const context=await browsers[engine].newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  contexts.push(context);
  if(relay)await context.addInitScript(()=>{
    const RTC=window.RTCPeerConnection;
    window.RTCPeerConnection=class extends RTC {
      constructor(config){super({...config,iceTransportPolicy:'relay',iceCandidatePoolSize:0})}
    };
  });
  const page=await context.newPage();pages.push(page);return page
}
async function load(page,url=BASE){
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await wait(page,()=>globalThis.peerRoomGameplayReady&&globalThis.c4PeerNetwork)
}
async function assertRelay(page,mode){
  const result=await page.evaluate(async mode=>{
    const pc=mode==='room'?(peerRoom.role==='host'?peerRoom.connections.get(2):peerRoom.conn)?.peerConnection:
      (mode==='manual'?directDuel.pc:directPeerSession.conn?.peerConnection);
    if(!pc)return {setup:c4PeerNetwork.state.relay,route:null};
    const stats=await pc.getStats();
    let pair=null;
    for(const stat of stats.values())if(stat.type==='transport'&&stat.selectedCandidatePairId){pair=stats.get(stat.selectedCandidatePairId);break}
    if(!pair)for(const stat of stats.values())if(stat.type==='candidate-pair'&&stat.state==='succeeded'&&stat.nominated){pair=stat;break}
    return {setup:c4PeerNetwork.state.relay,route:stats.get(pair?.localCandidateId)?.candidateType||null};
  },mode);
  assert.deepEqual(result,{setup:'managed',route:'relay'},'a managed relay must carry the selected route')
}
async function firstMove(host,guest,spectators=[]){
  await Promise.all([host,guest].map(p=>wait(p,()=>duelSession.active&&!busy)));
  const mover=(await host.evaluate(()=>s.turn===H))?host:guest;
  await mover.locator('.cell.can').first().tap({timeout:12000});
  await Promise.all([host,guest,...spectators].map(p=>wait(p,()=>s.moveNumber===1&&!busy,null,22000)))
}
async function online(mode){
  const guestName=hostName==='chromium'?'webkit':'chromium';
  const host=await client(hostName),guest=await client(guestName);
  await load(host);
  // Fail early on the real configuration, rather than interpreting a local
  // direct route or a timeout as relay readiness.
  assert.equal(await host.evaluate(async()=>{await c4PreparePeerNetwork();return c4PeerNetwork.state.relay}),'managed','No usable managed relay credentials');
  const spectators=[];
  if(mode==='direct'){
    await host.evaluate(()=>{openDuelHub();directCreateNearby()});
    await wait(host,()=>document.getElementById('duelDirectSignal').value.includes('#c4peer='));
    await load(guest,await host.locator('#duelDirectSignal').inputValue());
  }else if(mode==='room'){
    await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
    await wait(host,()=>peerRoom.active&&peerRoom.peer?.open);
    const invite=await host.evaluate(()=>peerRoomInviteLink());
    await load(guest,invite);await wait(guest,()=>peerRoom.active&&peerRoom.seat===2&&peerRoom.conn?.open,null,40000);
    for(const seat of [3,4]){
      const page=await client(hostName);spectators.push(page);await load(page,invite);
      await wait(page,seat=>peerRoom.active&&peerRoom.seat===seat&&peerRoom.conn?.open,seat,35000);
      await assertRelay(page,'room')
    }
  }else{
    await load(guest);await host.evaluate(()=>directCreate('remote'));
    const offer=await host.locator('#duelDirectSignal').inputValue();assert.ok(offer);
    await guest.evaluate(offer=>directJoinSignal(offer,'remote'),offer);
    const answer=await guest.locator('#duelDirectSignal').inputValue();assert.ok(answer);
    await host.evaluate(answer=>directAcceptAnswer(answer),answer)
  }
  if(mode==='room')await host.locator('#peerRoomStartGame').tap({timeout:35000});
  else for(const page of [host,guest])await page.locator('#duelReadyButton').tap({timeout:45000});
  await firstMove(host,guest,spectators);
  for(const page of [host,guest])await assertRelay(page,mode);
  console.log('PASS',mode,hostName+' host',mode==='room'?'four seats':'two players','first move delivered over managed TURN')
}
async function hosted(){
  const host=await client('chromium',false),guest=await client('webkit',false);
  for(const page of [host,guest]){
    await load(page);
    await page.evaluate(()=>{duelSession.server='';openDuelOnlineMode()});
    await wait(page,()=>duelConnectionBadge.textContent==='Server online');
  }
  await host.locator('#duelCreateButton').tap();
  await host.locator('#duelReadyButton').waitFor({state:'visible'});
  const code=await host.locator('#duelLobbyCode').textContent();assert.match(code,/^[A-Z0-9]{6}$/);
  await guest.locator('#duelJoinModeButton').tap();await guest.locator('#duelCodeInput').fill(code);await guest.locator('#duelJoinButton').tap();
  for(const page of [guest,host])await page.locator('#duelReadyButton').tap();
  await firstMove(host,guest);
  console.log('PASS Hosted Room from published configuration: create, join, ready and synchronized move')
}
try{
  browsers.chromium=await chromium.launch();browsers.webkit=await webkit.launch();
  const onlineCases=suite!=='hosted'?[['direct',()=>online('direct')],['room',()=>online('room')],...(hostName==='chromium'?[['manual',()=>online('manual')]]:[])]:[];
  const hostedCases=suite!=='relay'&&hostName==='chromium'?[['hosted',hosted]]:[];
  for(const [name,run] of [...onlineCases,...hostedCases]){
    try{await run()}catch(error){
      failures.push(name);console.error('FAIL',name,String(error.message).split('\n').slice(0,8).join('\n'));
      for(const page of pages){
        const evidence=await page.evaluate(async()=>{
          const report=globalThis.c4ConnectionDiagnostics?JSON.parse(await c4ConnectionDiagnostics.report()):{};
          return {relay:c4PeerNetwork?.state.relay,attempts:(report.attempts||[]).map(a=>({
            mode:a.mode,role:a.role,ice:a.ice,connection:a.connection,local:a.localTypes,remote:a.remoteTypes,
            errors:[...new Set(a.errors.map(x=>x.code))],route:a.route,dataError:a.dataError
          }))};
        }).catch(()=>null);
        console.log('GATE EVIDENCE',name,JSON.stringify(evidence));
      }
    }
    finally{pages.length=0;await Promise.all(contexts.splice(0).map(c=>c.close().catch(()=>{})))}
  }
  assert.deepEqual(failures,[],'Multiplayer release gate failed');
}finally{await Promise.all(Object.values(browsers).map(b=>b.close().catch(()=>{})))}
