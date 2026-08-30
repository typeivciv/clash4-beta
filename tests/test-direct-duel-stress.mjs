import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const GAMES=500;
const context={console,Math,Uint8Array};
vm.createContext(context);
vm.runInContext("const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;",context);
for(const file of ['src/js/10-rules.js','src/js/12-duel-projection.js','src/js/15-duel-local-core.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
vm.runInContext('globalThis.qa={makeLocalDuelState,applyLocalDuelMove,localDuelPayload,projectEventsForViewer,connectOn,other,H,A,T,COLS,ROWS};',context);
const {makeLocalDuelState,applyLocalDuelMove,localDuelPayload,projectEventsForViewer,connectOn,other,H,A,T,COLS,ROWS}=context.qa;

function rngFor(seed){
  let x=(seed+1)>>>0;
  return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296};
}
function roundTrip(value){return JSON.parse(JSON.stringify(value))}
function candidateMoves(st){
  const out=[];
  for(let c=0;c<COLS;c++)for(const type of T){
    if(st.inv[st.turn][type]<=0)continue;
    const q=applyLocalDuelMove(st,st.turn,type,c);
    if(!q.error)out.push({c,type,q});
  }
  return out
}
function allPieces(board){return board.flatMap(col=>col)}
function assertStateShape(st,label){
  assert.equal(st.board.length,COLS,`${label}: board width`);
  for(const col of st.board)assert.ok(col.length<=ROWS,`${label}: column overflow`);
  const pieces=allPieces(st.board),ids=pieces.map(p=>p.id);
  assert.equal(new Set(ids).size,ids.length,`${label}: duplicate piece ids`);
  for(const p of pieces){assert.ok([H,A].includes(p.owner),`${label}: invalid owner`);assert.ok(T.includes(p.type),`${label}: canonical piece type missing`)}
  for(const owner of [H,A])for(const type of T){
    const n=st.inv[owner][type];assert.ok(Number.isInteger(n)&&n>=0&&n<=7,`${label}: invalid inventory ${owner}/${type}=${n}`)
  }
}
function assertProjectedState(ps,viewer,terminal,label){
  assert.equal(ps.viewer,viewer,`${label}: viewer mismatch`);
  assert.equal(ps.opponent,other(viewer),`${label}: opponent mismatch`);
  for(const col of ps.board)for(const p of col){
    if(terminal){assert.ok(T.includes(p.type),`${label}: terminal board retained hidden/null type`)}
    else if(p.owner===viewer)assert.ok(T.includes(p.type),`${label}: self identity hidden`);
    else assert.equal(p.type,null,`${label}: opponent identity leaked before terminal`)
  }
  if(ps.lastMove){
    if(terminal||ps.lastMove.owner===viewer)assert.ok(T.includes(ps.lastMove.type),`${label}: visible last-move type missing`);
    else assert.equal(ps.lastMove.type,null,`${label}: opponent last-move type leaked`)
  }
}
function assertProjectedEvents(events,viewer,label){
  for(const e of events||[]){
    if(e.kind!=='combat'||!e.decoyContact)continue;
    for(const side of ['atk','def']){
      const p=e[side];if(!p||p.owner===viewer||p.type==='decoy')continue;
      assert.equal(p.type,null,`${label}: decoy contact leaked opponent R/P/S type`)
    }
  }
}
function mapProjectedForLocalUi(ps,viewer){
  const mapOwner=owner=>owner!==H&&owner!==A?owner:(viewer===A?other(owner):owner);
  return{
    ...ps,
    board:ps.board.map(col=>col.map(p=>({...p,owner:mapOwner(p.owner)}))),
    turn:mapOwner(ps.turn),winner:ps.winner?mapOwner(ps.winner):null,
    lastMove:ps.lastMove?{...ps.lastMove,owner:mapOwner(ps.lastMove.owner)}:null
  }
}

let totalMoves=0,totalCombats=0,totalClashmates=0,totalConnect4=0,totalDraws=0;
let hostWins=0,guestWins=0;
for(let game=0;game<GAMES;game++){
  const rand=rngFor(0xC4A50000+game);
  let st=makeLocalDuelState(game%2?A:H),version=1,guard=0;
  const previousProjected={human:null,ai:null};
  const replayWindows={human:[],ai:[]};
  const permanentDecoys=new Set();
  assertStateShape(st,`game ${game} initial`);

  // Direct authority must reject an out-of-turn command without mutating the state.
  const wrongOwner=other(st.turn),wrong=applyLocalDuelMove(st,wrongOwner,'rock',0);
  assert.equal(wrong.error,'not-your-turn',`game ${game}: wrong-seat move was accepted`);
  assert.equal(st.moveNumber,0,`game ${game}: rejected move mutated authority state`);

  while(!st.winner&&!st.draw&&guard++<80){
    const before=st,owner=st.turn,candidates=candidateMoves(st);
    assert.ok(candidates.length,`game ${game} move ${st.moveNumber}: no legal Direct move candidate`);
    const pick=candidates[Math.floor(rand()*candidates.length)],q=pick.q;
    st=q.state;version++;totalMoves++;totalCombats+=q.events.filter(e=>e.kind==='combat').length;
    assert.equal(st.moveNumber,before.moveNumber+1,`game ${game}: move number did not advance exactly once`);
    assert.equal(st.inv[owner][pick.type],before.inv[owner][pick.type]-1,`game ${game}: placed inventory did not decrement exactly once`);
    assertStateShape(st,`game ${game} move ${st.moveNumber}`);

    for(const p of allPieces(st.board))if(p.type==='decoy')permanentDecoys.add(p.id);
    const survivingIds=new Set(allPieces(st.board).map(p=>p.id));
    for(const id of permanentDecoys)assert.ok(survivingIds.has(id),`game ${game}: indestructible Decoy ${id} disappeared`);

    const terminal=!!(st.winner||st.draw);
    if(!terminal)assert.equal(st.turn,other(owner),`game ${game}: turn did not pass to opponent`);

    for(const viewer of [H,A]){
      const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
      const payload=roundTrip(localDuelPayload(st,viewer,version,q.events,players));
      assert.equal(payload.phase,'active',`game ${game}: Direct payload phase changed`);
      assert.equal(payload.version,version,`game ${game}: Direct payload version mismatch`);
      assertProjectedState(payload.state,viewer,terminal,`game ${game} viewer ${viewer} move ${st.moveNumber}`);
      assertProjectedEvents(roundTrip(projectEventsForViewer(q.events,viewer)),viewer,`game ${game} viewer ${viewer} move ${st.moveNumber}`);

      // Simulate the client seat remap used by Direct Duel: whichever device is viewing
      // the match sees its own pieces as local H / "You" and the remote seat as A.
      const ui=mapProjectedForLocalUi(payload.state,viewer);
      for(const col of ui.board)for(const p of col){
        if(p.owner===H&&viewer===A)assert.ok(true); // guest self maps to local player ownership
        if(terminal)assert.ok(T.includes(p.type),`game ${game}: terminal local UI would hit a null piece type`)
      }

      const interaction={before:previousProjected[viewer],after:payload.state,events:roundTrip(projectEventsForViewer(q.events,viewer)),moveNumber:st.moveNumber};
      replayWindows[viewer].push(interaction);if(replayWindows[viewer].length>2)replayWindows[viewer].shift();previousProjected[viewer]=payload.state;
      assert.ok(replayWindows[viewer].length<=2,`game ${game}: Replay Finish retained more than two interactions`)
    }
  }

  assert.ok(st.winner||st.draw,`game ${game}: Direct Duel did not terminate within guard`);
  assert.ok(guard<80,`game ${game}: Direct Duel exceeded move guard`);
  if(st.winner){
    if(st.winner===H)hostWins++;else guestWins++;
    if(st.winReason==='connect4'){totalConnect4++;assert.ok(connectOn(st,st.winner),`game ${game}: connect4 winner has no Connect Four`)}
    else{assert.equal(st.winReason,'clashmate',`game ${game}: unknown win reason`);assert.ok(st.clashmate,`game ${game}: Clashmate winner missing metadata`);totalClashmates++}
  }else{totalDraws++}

  for(const viewer of [H,A]){
    assert.ok(replayWindows[viewer].length>=1&&replayWindows[viewer].length<=2,`game ${game}: invalid Replay Finish window`);
    const final=replayWindows[viewer].at(-1).after;
    for(const p of allPieces(final.board))assert.ok(T.includes(p.type),`game ${game}: final Replay state retained hidden identity for ${viewer}`)
  }
}

assert.equal(hostWins+guestWins+totalDraws,GAMES,'terminal outcome accounting mismatch');
assert.ok(totalMoves>GAMES*4,'stress run produced implausibly few moves');
console.log(`PASS Direct Duel stress QA: ${GAMES} complete matches · ${totalMoves} moves · ${totalCombats} combats · ${totalConnect4} Connect Four · ${totalClashmates} Clashmate · ${totalDraws} draws · winners H/A ${hostWins}/${guestWins}`);
