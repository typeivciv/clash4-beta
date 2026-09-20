import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.PLAYTEST_URL||'http://127.0.0.1:8080/multiplayer-alpha.html?playtest=0204';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function physicalOwner(localOwner,seat){
  if(localOwner==='human')return seat;
  if(localOwner==='ai')return seat===1?2:1;
  return null;
}

async function waitRuntime(page){
  await page.waitForFunction(()=>globalThis.peerRoomFoundation&&globalThis.peerRoomMatch&&globalThis.peerRoomTransaction,{timeout:20000});
}

async function installProbe(page,name){
  await page.evaluate(name=>{
    globalThis.__peerPlaytest={name,feedback:[],renders:[],errors:[]};
    const oldFeedback=globalThis.emitFeedback;
    if(typeof oldFeedback==='function')globalThis.emitFeedback=function(kind,...rest){
      try{globalThis.__peerPlaytest.feedback.push({t:performance.now(),kind,move:s?.moveNumber??null,busy:!!busy,drop:dropPresentation?{column:dropPresentation.column,owner:dropPresentation.owner,moveNumber:dropPresentation.moveNumber}:null})}catch{}
      return oldFeedback.call(this,kind,...rest)
    };
    const oldRender=globalThis.render;
    if(typeof oldRender==='function')globalThis.render=function(...args){
      const out=oldRender.apply(this,args);
      try{globalThis.__peerPlaytest.renders.push({t:performance.now(),move:s?.moveNumber??null,busy:!!busy,handled:duelSession?.handledVersion??null,drop:dropPresentation?{column:dropPresentation.column,owner:dropPresentation.owner,moveNumber:dropPresentation.moveNumber}:null,discCount:document.querySelectorAll('.disc').length})}catch{}
      return out
    };
  },name);
}

async function snap(page,label){
  return page.evaluate(label=>{
    const seat=Number(globalThis.peerRoom?.seat||0);
    const st=globalThis.s||{};
    const board=(st.board||[]).map(col=>(col||[]).map(p=>({owner:p.owner,type:p.type??null,id:p.id??null})));
    const turnSeat=st.turn==='human'?seat:st.turn==='ai'?(seat===1?2:1):null;
    const lm=st.lastMove||null;
    const lastMoveSeat=lm?.owner==='human'?seat:lm?.owner==='ai'?(seat===1?2:1):null;
    return {
      label,seat,role:peerRoom?.role||null,phase:peerRoomMatch?.phase||null,matchId:peerRoomMatch?.matchId||'',
      moveNumber:Number(st.moveNumber||0),turn:st.turn||null,turnSeat,winner:st.winner||null,draw:!!st.draw,
      lastMove:lm?{owner:lm.owner,seat:lastMoveSeat,column:Number(lm.column),type:lm.type??null}:null,
      board,heights:board.map(c=>c.length),
      busy:!!globalThis.busy,ready:!!globalThis.ready,handled:Number(duelSession?.handledVersion??-1),
      pending:duelSession?.pendingLocal?{column:Number(duelSession.pendingLocal.column),type:duelSession.pendingLocal.type,tx:!!duelSession.pendingLocal.peerRoomTransaction}:null,
      drop:dropPresentation?{column:Number(dropPresentation.column),owner:dropPresentation.owner,type:dropPresentation.type??null,moveNumber:Number(dropPresentation.moveNumber||0)}:null,
      canonical:peerRoom?.role==='host'&&peerRoomMatch?.authority?{version:Number(peerRoomMatch.authority.version),moveNumber:Number(peerRoomMatch.authority.state?.moveNumber||0),turn:peerRoomMatch.authority.state?.turn||null}:null,
      discs:document.querySelectorAll('.disc').length,
      probe:globalThis.__peerPlaytest?{feedback:[...__peerPlaytest.feedback],renders:[...__peerPlaytest.renders]}:null
    }
  },label);
}

function normalizeBoard(snap){
  return snap.board.map(col=>col.map(p=>({seat:physicalOwner(p.owner,snap.seat),type:p.type})))
}
function occupancy(snap){return snap.board.map(col=>col.map(p=>physicalOwner(p.owner,snap.seat)))}
function reportPair(tag,h,g){
  console.log(`\n=== ${tag} ===`);
  console.log('HOST',JSON.stringify({move:h.moveNumber,turnSeat:h.turnSeat,handled:h.handled,busy:h.busy,drop:h.drop,heights:h.heights,discs:h.discs,canonical:h.canonical,lastMove:h.lastMove}));
  console.log('GUEST',JSON.stringify({move:g.moveNumber,turnSeat:g.turnSeat,handled:g.handled,busy:g.busy,drop:g.drop,heights:g.heights,discs:g.discs,lastMove:g.lastMove}));
}

async function chooseMove(page,preferredColumn){
  return page.evaluate(preferredColumn=>{
    const legal=legalCols(H);
    const column=legal.includes(preferredColumn)?preferredColumn:legal[0];
    const type=T.find(t=>(s?.inv?.human?.[t]||0)>0);
    if(column===undefined||!type)return null;
    return {column,type,moveNumber:s.moveNumber,handled:duelSession.handledVersion};
  },preferredColumn);
}

async function performMove(mover,host,guest,preferredColumn,index){
  const move=await chooseMove(mover,preferredColumn);
  assert.ok(move,`move ${index}: no legal move`);
  const beforeH=await snap(host,`m${index}-before-h`),beforeG=await snap(guest,`m${index}-before-g`);
  assert.equal(beforeH.moveNumber,beforeG.moveNumber,`move ${index}: clients start on different move numbers`);
  assert.deepEqual(occupancy(beforeH),occupancy(beforeG),`move ${index}: clients start with different physical board occupancy`);

  await mover.evaluate(({type,column})=>peerRoomMatchMove(H,type,column),move);
  await sleep(35);
  const earlyH=await snap(host,`m${index}-35ms-h`),earlyG=await snap(guest,`m${index}-35ms-g`);
  reportPair(`MOVE ${index} @ 35ms`,earlyH,earlyG);

  await sleep(235);
  const midH=await snap(host,`m${index}-270ms-h`),midG=await snap(guest,`m${index}-270ms-g`);
  reportPair(`MOVE ${index} @ 270ms`,midH,midG);

  await host.waitForFunction(n=>s?.moveNumber>=n&&!busy,move.moveNumber+1,{timeout:9000});
  await guest.waitForFunction(n=>s?.moveNumber>=n&&!busy,move.moveNumber+1,{timeout:9000});
  const finalH=await snap(host,`m${index}-final-h`),finalG=await snap(guest,`m${index}-final-g`);
  reportPair(`MOVE ${index} FINAL`,finalH,finalG);

  assert.equal(finalH.moveNumber,move.moveNumber+1,`move ${index}: host did not commit exactly one move`);
  assert.equal(finalG.moveNumber,move.moveNumber+1,`move ${index}: guest did not commit exactly one move`);
  assert.equal(finalH.handled,finalG.handled,`move ${index}: handled versions diverged`);
  assert.equal(finalH.turnSeat,finalG.turnSeat,`move ${index}: physical turn diverged`);
  assert.deepEqual(occupancy(finalH),occupancy(finalG),`move ${index}: physical board occupancy diverged`);

  const hf=finalH.probe.feedback.filter(x=>x.kind==='drop');
  const gf=finalG.probe.feedback.filter(x=>x.kind==='drop');
  console.log(`drop feedback cumulative host=${hf.length} guest=${gf.length}`);
  return {finalH,finalG};
}

const browsers=[];
try{
  const hostBrowser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});browsers.push(hostBrowser);
  const guestBrowser=await webkit.launch({headless:true});browsers.push(guestBrowser);
  const hostCtx=await hostBrowser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const guestCtx=await guestBrowser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const host=await hostCtx.newPage(),guest=await guestCtx.newPage();
  const pageErrors=[];
  for(const [name,page] of [['HOST',host],['GUEST',guest]]){
    page.on('pageerror',e=>{pageErrors.push(`${name}: ${e.message}`);console.log(`${name} PAGEERROR`,e.message)});
    page.on('console',m=>{if(['error','warning'].includes(m.type()))console.log(`${name} ${m.type().toUpperCase()}:`,m.text())});
  }

  console.log('Opening host runtime',BASE);
  await host.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await waitRuntime(host);await installProbe(host,'host');
  await host.evaluate(()=>{peerRoomOpen();peerRoomFoundation.create()});
  await host.waitForFunction(()=>peerRoom?.active&&peerRoom?.role==='host'&&peerRoom?.hostId,{timeout:20000});
  const invite=await host.evaluate(()=>peerRoomInviteLink());
  console.log('Invite',invite.replace(/c4room=.*/,'c4room=<redacted>'));

  await guest.goto(invite,{waitUntil:'domcontentloaded',timeout:30000});await waitRuntime(guest);await installProbe(guest,'guest');
  await guest.waitForFunction(()=>peerRoom?.active&&peerRoom?.role==='guest'&&Number(peerRoom?.seat)===2,{timeout:25000});
  await host.waitForFunction(()=>peerRoom?.seats?.some(s=>s.seat===2&&s.connected),{timeout:10000});
  console.log('JOIN OK host seat2 connected, guest seat',await guest.evaluate(()=>peerRoom.seat));

  await host.evaluate(()=>peerRoomMatchStart());
  await host.waitForFunction(()=>peerRoomMatch?.phase==='active'&&duelSession?.active,{timeout:10000});
  await guest.waitForFunction(()=>peerRoomMatch?.phase==='active'&&duelSession?.active,{timeout:10000});
  let h=await snap(host,'start-h'),g=await snap(guest,'start-g');reportPair('MATCH START',h,g);
  assert.equal(h.turnSeat,g.turnSeat,'starting physical turn differs');
  assert.deepEqual(occupancy(h),occupancy(g),'starting board differs');

  const columns=[3,3,4,4,2,2,5,5];
  for(let i=0;i<columns.length;i++){
    h=await snap(host,`pre-${i}-h`);g=await snap(guest,`pre-${i}-g`);
    const seat=h.turnSeat;
    assert.equal(seat,g.turnSeat,`move ${i+1}: turn differs before input`);
    const mover=seat===1?host:guest;
    await performMove(mover,host,guest,columns[i],i+1);
    if((await snap(host,'terminal')).winner)break;
  }

  h=await snap(host,'end-h');g=await snap(guest,'end-g');
  console.log('\nHOST render trace',JSON.stringify(h.probe.renders.slice(-30)));
  console.log('\nGUEST render trace',JSON.stringify(g.probe.renders.slice(-30)));
  console.log('\nHOST feedback',JSON.stringify(h.probe.feedback));
  console.log('\nGUEST feedback',JSON.stringify(g.probe.feedback));

  await host.screenshot({path:'artifacts/peer-room-host.png',fullPage:true});
  await guest.screenshot({path:'artifacts/peer-room-guest.png',fullPage:true});
  if(pageErrors.length)throw new Error(`Browser errors:\n${pageErrors.join('\n')}`);
  console.log('\nPASS real browser Peer Room playtest: Chromium host + WebKit guest stayed on the same physical board/version/turn through live WebRTC moves.');
} finally {
  for(const b of browsers)await b.close().catch(()=>{});
}
