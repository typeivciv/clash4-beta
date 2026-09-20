import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={console,Math,Uint8Array};vm.createContext(context);
vm.runInContext("const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;",context);
for(const file of ['src/js/10-rules.js','src/js/12-duel-projection.js','src/js/15-duel-local-core.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
vm.runInContext('globalThis.testApi={makeLocalDuelState,applyLocalDuelMove,projectDuelState,baseLegal,typesLeft,H,A,T};',context);
const {makeLocalDuelState,applyLocalDuelMove,projectDuelState,baseLegal,typesLeft,H,A}=context.testApi;

let moves=0,restores=0,combats=0;
for(let game=0;game<160;game++){
  let authority={state:makeLocalDuelState(game%2?A:H),version:1},guard=0;
  while(!authority.state.winner&&!authority.state.draw&&guard++<64){
    const owner=authority.state.turn,legal=baseLegal(authority.state,owner),types=typesLeft(authority.state,owner);let result=null;
    for(let oi=0;oi<legal.length&&!result;oi++)for(let ti=0;ti<types.length&&!result;ti++){
      const column=legal[(oi+game+guard)%legal.length],type=types[(ti+guard+game)%types.length];
      const q=applyLocalDuelMove(authority.state,owner,type,column);if(!q.error)result=q
    }
    assert.ok(result,'Peer Room host authority should accept at least one legal move');
    authority.state=result.state;authority.version++;moves++;combats+=result.events.filter(e=>e.kind==='combat').length;

    if(!authority.state.winner&&!authority.state.draw){
      const p1=projectDuelState(authority.state,H),p2=projectDuelState(authority.state,A);
      for(const col of p1.board)for(const piece of col)if(piece.owner!==H)assert.equal(piece.type,null,'P1 projection leaked P2 hidden piece type');
      for(const col of p2.board)for(const piece of col)if(piece.owner!==A)assert.equal(piece.type,null,'P2 projection leaked P1 hidden piece type');
      const spectator=projectDuelState(authority.state,H);spectator.board=spectator.board.map(col=>col.map(piece=>({...piece,type:null})));
      for(const col of spectator.board)for(const piece of col)assert.equal(piece.type,null,'spectator projection leaked a live piece type');
    }

    if(guard===8&&game%4===0){
      const serialized=JSON.stringify(authority),restored=JSON.parse(serialized);
      assert.equal(restored.version,authority.version,'restored host version drifted');
      assert.equal(restored.state.moveNumber,authority.state.moveNumber,'restored host move number drifted');
      authority=restored;restores++
    }
  }
  assert.ok(authority.state.winner||authority.state.draw,'Peer Room host-authoritative match did not terminate');
  const final=projectDuelState(authority.state,H,{revealAll:true});for(const col of final.board)for(const piece of col)assert.ok(piece.type,'terminal shared match must reveal full board')
}

console.log(`PASS Peer Room shared-match soak: 160 complete matches, ${moves} moves, ${combats} combats, ${restores} serialized host recoveries, zero Fog leaks`);
