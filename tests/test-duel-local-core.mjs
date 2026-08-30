import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={console,Math,Uint8Array};vm.createContext(context);
vm.runInContext("const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;",context);
for(const file of ['src/js/10-rules.js','src/js/12-duel-projection.js','src/js/15-duel-local-core.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
vm.runInContext('globalThis.testApi={makeLocalDuelState,applyLocalDuelMove,projectDuelState,baseLegal,typesLeft,other,H,A,T};',context);
const {makeLocalDuelState,applyLocalDuelMove,projectDuelState,baseLegal,typesLeft,other,H,A}=context.testApi;

let moves=0,combats=0;
for(let game=0;game<300;game++){
  let st=makeLocalDuelState(game%2?A:H),guard=0;
  while(!st.winner&&!st.draw&&guard++<60){
    const owner=st.turn,legal=baseLegal(st,owner),types=typesLeft(st,owner);let result=null;
    for(let oi=0;oi<legal.length&&!result;oi++)for(let ti=0;ti<types.length&&!result;ti++){
      const c=legal[(oi+game+guard)%legal.length],type=types[(ti+game)%types.length],q=applyLocalDuelMove(st,owner,type,c);if(!q.error)result=q
    }
    assert.ok(result,'local authority should find a legal move');st=result.state;moves++;combats+=result.events.filter(e=>e.kind==='combat').length;
    if(!st.winner&&!st.draw){
      for(const viewer of [H,A]){
        const p=projectDuelState(st,viewer);for(const col of p.board)for(const piece of col)if(piece.owner!==viewer)assert.equal(piece.type,null,'non-terminal opponent piece identity leaked');
      }
    }
  }
  assert.ok(st.winner||st.draw,'local Duel game did not terminate');
  for(const viewer of [H,A]){
    const final=projectDuelState(st,viewer,{revealAll:true});for(const col of final.board)for(const piece of col)assert.ok(piece.type,'terminal reveal should expose full board')
  }
}
console.log(`PASS local Duel authority (${moves} moves, ${combats} combats, 300 games)`);
