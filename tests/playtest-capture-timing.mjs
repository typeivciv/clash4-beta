import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const BASE='http://127.0.0.1:8080/multiplayer-alpha.html?playtest=capture-timing';
const cases=[
  {name:'single-capture',defenders:['scissors'],outcomes:['win']},
  {name:'two-captures',defenders:['scissors','scissors'],outcomes:['win','win']},
  {name:'two-captures-then-attacker-loss',defenders:['paper','scissors','scissors'],outcomes:['win','win','lose']},
  {name:'attacker-loss',defenders:['paper'],outcomes:['lose']},
  {name:'tie',defenders:['rock'],outcomes:['tie']},
  {name:'decoy',defenders:['decoy'],outcomes:['tie']}
];
const browsers=[],pages=[],results=[];
async function runtime(page){await page.waitForFunction(()=>globalThis.peerRoomGameplayReady,{timeout:25000})}
async function probe(page){
  await page.evaluate(()=>{
    globalThis.__captureProbe={active:false,frames:[],cues:[],renders:[]};
    const ids=()=>[...document.querySelectorAll('#board .disc[data-probe-id]')].map(el=>Number(el.dataset.probeId)).sort((a,b)=>a-b);
    const grid=renderBoardGrid;
    renderBoardGrid=function(args){
      const out=grid(args),cells=board.querySelectorAll('.cell');
      const viewBoard=!dropPresentation&&globalThis.c4CapturePresentation?.board||args.viewBoard;
      for(let i=0;i<cells.length;i++){
        const piece=viewBoard[Number(cells[i].dataset.column)]?.[ROWS-1-Math.floor(i/COLS)];
        const disc=cells[i].querySelector('.disc:not(.justDropped)');if(piece&&disc)disc.dataset.probeId=String(piece.id)
      }
      if(__captureProbe.active)__captureProbe.renders.push({at:performance.now(),ids:ids(),drop:!!dropPresentation});
      return out
    };
    const event=showEvent;
    showEvent=function(e){const out=event(e);if(__captureProbe.active)__captureProbe.cues.push({at:performance.now(),wall:Date.now(),kind:e.kind,outcome:e.o,atk:e.atk?.id,def:e.def?.id,duration:eventDuration(e),ids:ids(),captureHold:gameplayFlowCaptureHoldMs(e)});return out};
    const captureCue=c4CaptureCue;
    c4CaptureCue=function(e,targetAt){
      const out=captureCue(e,targetAt),cue=__captureProbe.cues.at(-1);
      if(__captureProbe.active&&cue?.kind===e.kind)cue.scheduledStartMs=performance.now()+((targetAt??Date.now())-Date.now());
      return out
    };
    const tick=()=>{
      if(__captureProbe.active){
        const frame={at:performance.now(),ids:ids(),drop:!!dropPresentation,combat:activePresentation?.event?.kind==='combat',outcome:activePresentation?.event?.o,overlay:overlay.classList.contains('show')};
        const last=__captureProbe.frames.at(-1);
        if(!last||JSON.stringify({...last,at:0})!==JSON.stringify({...frame,at:0}))__captureProbe.frames.push(frame)
      }
      requestAnimationFrame(tick)
    };requestAnimationFrame(tick);
    globalThis.__captureStart=()=>{__captureProbe={active:true,frames:[{at:performance.now(),ids:ids(),drop:false}],cues:[],renders:[]}};
    render()
  })
}
async function fixture(host,guest,mode,scenario,index){
  for(const page of [host,guest])await page.evaluate(()=>{duelSession.active=false;clearPresentationTimers();busy=false});
  await host.evaluate(({mode,scenario,index})=>{
    const owner=index%2===0?H:A,st=makeLocalDuelState(owner);
    st.board[3]=scenario.defenders.map((type,i)=>({owner:other(owner),type,id:100+i}));
    st.nextId=200;st.moveNumber=10;
    const auth={state:st,version:100+index*10};
    if(mode==='peer'){peerRoomMatch.authority=auth;peerRoomMatch.matchId=`capture_${index}`;peerRoomMatch.phase='active';peerRoomMatchBroadcast([],'room-match-start')}
    else{directDuel.authority=auth;const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];directSend({kind:'payload',payload:localDuelPayload(st,A,auth.version,[],players)});duelApplyPayload(localDuelPayload(st,H,auth.version,[],players))}
  },{mode,scenario,index});
  for(const page of [host,guest])await page.waitForFunction(()=>duelSession.active&&s.moveNumber===10&&!busy,{timeout:10000});
}
function summarize(raw,scenario){
  const combats=raw.cues.filter(c=>c.kind==='combat');
  assert.deepEqual(combats.map(c=>c.outcome),scenario.outcomes,'simulation must exercise the intended canonical combat outcomes');
  const captures=combats.filter(c=>c.outcome!=='tie').map(c=>{
    const victim=c.outcome==='win'?c.def:c.atk;
    const firstShown=raw.frames.find(f=>f.ids.includes(victim)&&!f.drop);
    const firstAbsent=firstShown?raw.frames.find(f=>f.at>=firstShown.at&&!f.ids.includes(victim)&&!f.drop):null;
    const firstDomAbsent=raw.renders.find(f=>f.at>=c.at&&!f.drop&&!f.ids.includes(victim));
    const scheduledEnd=(c.scheduledStartMs??c.at)+c.duration;
    assert.ok(c.ids.includes(victim),`losing piece ${victim} must remain on the board when its own clash starts`);
    assert.ok(firstAbsent,`losing piece ${victim} must disappear after its clash`);
    assert.ok(firstDomAbsent&&firstDomAbsent.at>=scheduledEnd-12,`losing piece ${victim} was removed before its scheduled clash resolved`);
    assert.ok(firstAbsent.at<=scheduledEnd+1000,`losing piece ${victim} did not disappear promptly after resolution`);
    return {victim,outcome:c.outcome,combatStartMs:c.at,combatEndMs:c.at+c.duration,scheduledCombatEndMs:scheduledEnd,boardAbsentMs:firstAbsent.at,absentRelativeToCombatStartMs:Math.round(firstAbsent.at-c.at),absentRelativeToCombatEndMs:Math.round(firstAbsent.at-c.at-c.duration),absentRelativeToScheduledEndMs:Math.round(firstDomAbsent.at-scheduledEnd),presentAtCue:c.ids.includes(victim),incomingCheckerNeverShownOnBoard:victim===200&&!firstShown,captureHoldMs:c.captureHold}
  });
  return {captures,combats:combats.length,finalIds:raw.frames.at(-1)?.ids,timingBasis:'performance.now; board absence sampled on animation frames'}
}
try{
  const chrome=await chromium.launch({headless:true}),wk=await webkit.launch({headless:true});browsers.push(chrome,wk);
  const modes=process.env.CAPTURE_MODE?[process.env.CAPTURE_MODE]:['peer','direct'];
  const hosts=process.env.CAPTURE_HOST?[process.env.CAPTURE_HOST==='webkit']:[false,true];
  for(const mode of modes)for(const appleHost of hosts){
    const contexts=await Promise.all([appleHost?wk:chrome,appleHost?chrome:wk].map(browser=>browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2})));
    const [host,guest]=await Promise.all(contexts.map(context=>context.newPage()));pages.push(host,guest);
    const errors=[];for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
    await host.goto(BASE,{waitUntil:'domcontentloaded'});await runtime(host);
    if(mode==='peer')await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});else await host.evaluate(()=>{openDuelHub();directCreateNearby()});
    await host.waitForFunction(mode=>mode==='peer'?peerRoom.active&&peerRoom.hostId:document.getElementById('duelDirectSignal').value.includes('#'),mode,{timeout:25000});
    const invite=await host.evaluate(mode=>mode==='peer'?peerRoomInviteLink():document.getElementById('duelDirectSignal').value,mode);
    await guest.goto(invite,{waitUntil:'domcontentloaded'});await runtime(guest);
    if(mode==='peer'){await guest.waitForFunction(()=>peerRoom.active&&peerRoom.seat===2,{timeout:30000});await host.locator('#peerRoomStartGame').tap()}
    else{
      const ready=()=>Promise.all([host,guest].map(page=>page.locator('#duelReadyButton').waitFor({state:'visible',timeout:25000})));
      try{await ready()}catch(error){
        console.log('SETUP RETRY',mode,appleHost?'webkit-host':'webkit-guest',String(error));
        // Retry the same valid invite using the shipped recovery action. Capture
        // measurement begins only after both clients have joined successfully.
        await guest.evaluate(()=>directRetryNearbyConnection());await ready()
      }
      await host.locator('#duelReadyButton').tap();await guest.locator('#duelReadyButton').tap()
    }
    for(const page of [host,guest]){await page.waitForFunction(()=>duelSession.active,{timeout:12000});await probe(page)}
    for(let index=0;index<cases.length;index++){
      const scenario=cases[index],label=`${mode}-${appleHost?'webkit-host':'webkit-guest'}-${scenario.name}`;
      await fixture(host,guest,mode,scenario,index);
      for(const page of [host,guest])await page.evaluate(()=>__captureStart());
      const mover=index%2===0?host:guest;
      await mover.locator('.choice[aria-label^="Rock,"]').tap();await mover.locator('.cell.can[data-column="3"]').first().tap();
      await host.waitForFunction(()=>__captureProbe.cues.some(c=>c.kind==='combat'),{timeout:10000});
      await host.screenshot({path:`artifacts/${label}-first-combat.png`});
      for(const page of [host,guest])await page.waitForFunction(()=>s.moveNumber===11&&!busy,{timeout:20000});
      // One final paint sample after the handoff.
      for(const page of [host,guest])await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const raw=await Promise.all([host,guest].map(page=>page.evaluate(()=>{__captureProbe.active=false;return __captureProbe})));
      const summary=raw.map((r,i)=>({role:i===0?'host':'guest',engine:(i===0?appleHost:!appleHost)?'webkit':'chromium',...summarize(r,scenario)}));
      assert.deepEqual(summary[0].finalIds,summary[1].finalIds,'both boards finish with the same surviving pieces');
      const expected=scenario.outcomes.every(o=>o==='tie')?[100,200]:scenario.outcomes.at(-1)==='lose'?[100]:[200];
      assert.deepEqual(summary[0].finalIds,expected,'correct surviving pieces after the presentation');
      const result={label,mode,scenario:scenario.name,mover:index%2===0?'host':'guest',summary,raw};results.push(result);
      await fs.writeFile(`artifacts/${label}.json`,JSON.stringify(result,null,2));
      console.log('CAPTURE TIMING',JSON.stringify({label,summary}))
    }
    assert.deepEqual(errors,[],'no browser errors');for(const context of contexts)await context.close()
  }
  console.log(`PASS ${results.length} capture simulations: each loser present at its own cue, removed at scheduled resolution; correct final boards, ties and decoys preserved`);
}catch(error){
  console.log('CAPTURE FAILURE',String(error));
  for(let i=0;i<pages.length;i++)if(!pages[i].isClosed())try{console.log('PAGE',i,await pages[i].evaluate(async()=>({move:s.moveNumber,busy,turn:s.turn,report:await alphaTesterInfo()})))}catch{}
  throw error;
}finally{
  await fs.writeFile('artifacts/capture-timing-summary.json',JSON.stringify(results.map(({raw,...result})=>result),null,2));
  for(const browser of browsers)await browser.close().catch(()=>{})
}
