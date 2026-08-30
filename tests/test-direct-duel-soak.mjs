import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Headless QA of the same host-authoritative rules/projection path used by Direct Duel.
// This intentionally does not pretend to test radio/NAT behavior; it stress-tests gameplay,
// per-player Fog projections, ordered payload progression, terminal reveal, replay inputs,
// and fresh-match reset semantics across hundreds of complete matches.
const context={console,Math,Uint8Array};vm.createContext(context);
vm.runInContext("const ROWS=6,COLS=8,H='human',A='ai',T=['rock','paper','scissors','decoy'];const other=o=>o===H?A:H;",context);
for(const file of ['src/js/10-rules.js','src/js/12-duel-projection.js','src/js/15-duel-local-core.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
vm.runInContext('globalThis.qa={makeLocalDuelState,applyLocalDuelMove,localDuelPayload,projectInteractionForViewer,baseLegal,typesLeft,other,H,A,T};',context);
const {makeLocalDuelState,applyLocalDuelMove,localDuelPayload,projectInteractionForViewer,baseLegal,typesLeft,other,H,A,T}=context.qa;

function rng32(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function occupied(board){return board.reduce((n,col)=>n+col.length,0)}
function flatten(board){return board.flat().map(p=>({owner:p.owner,id:p.id,type:p.type}))}
function authorityById(st){return new Map(st.board.flat().map(p=>[p.id,p]))}
function localOwner(owner,viewer){return viewer===A&&(owner===H||owner===A)?other(owner):owner}
function assertProjection(authority,payload,viewer,{terminal=false}={}){
  assert.equal(payload.ok,true);assert.equal(payload.phase,'active');assert.equal(payload.seat,viewer);
  assert.equal(payload.state.viewer,viewer);assert.equal(payload.state.moveNumber,authority.moveNumber);
  assert.equal(payload.state.turn,authority.turn);assert.equal(payload.state.winner,authority.winner);
  assert.equal(payload.state.draw,!!authority.draw);assert.equal(occupied(payload.state.board),occupied(authority.board));
  assert.ok(!('human' in payload.state.inventory)&&!('ai' in payload.state.inventory),'projection leaked full authority inventory shape');
  assert.deepEqual({...payload.state.inventory.self},{...authority.inv[viewer]},'viewer inventory must equal authoritative own inventory');
  const opp=other(viewer),oppTotal=T.reduce((n,t)=>n+authority.inv[opp][t],0);assert.equal(payload.state.inventory.opponentTotal,oppTotal);
  const auth=authorityById(authority);
  for(const col of payload.state.board)for(const piece of col){
    const raw=auth.get(piece.id);assert.ok(raw,`projected piece ${piece.id} missing from authority`);assert.equal(piece.owner,raw.owner);
    if(terminal||piece.owner===viewer)assert.equal(piece.type,raw.type,'visible piece type mismatch');
    else assert.equal(piece.type,null,'non-terminal opponent board identity leaked');
  }
  if(payload.state.lastMove){
    const lm=authority.lastMove;assert.equal(payload.state.lastMove.owner,lm.owner);assert.equal(payload.state.lastMove.column,lm.column);
    if(terminal||lm.owner===viewer)assert.equal(payload.state.lastMove.type,lm.type);else assert.equal(payload.state.lastMove.type,null,'opponent last-move type leaked');
  }
}
function chooseMove(st,rand,game,ply){
  const owner=st.turn,legal=[...baseLegal(st,owner)],types=[...typesLeft(st,owner)];
  assert.ok(legal.length,'non-terminal authority has no legal columns');assert.ok(types.length,'non-terminal authority has no piece types left');
  // Random attempts first to diversify combat patterns, then exhaustive fallback so QA never
  // mistakes a random blocked attempt for a rules-engine dead end.
  for(let n=0;n<Math.max(12,legal.length*types.length);n++){
    const c=legal[Math.floor(rand()*legal.length)],type=types[Math.floor(rand()*types.length)],q=applyLocalDuelMove(st,owner,type,c);
    if(!q.error)return{owner,type,column:c,q}
  }
  for(let ci=0;ci<legal.length;ci++)for(let ti=0;ti<types.length;ti++){
    const c=legal[(ci+game+ply)%legal.length],type=types[(ti+game)%types.length],q=applyLocalDuelMove(st,owner,type,c);if(!q.error)return{owner,type,column:c,q}
  }
  assert.fail('authority could not find any legal Direct Duel move')
}

const GAMES=500;let moves=0,combats=0,decoyContacts=0,clashmates=0,connect4=0,draws=0,hWins=0,aWins=0,maxMoves=0;
for(let game=0;game<GAMES;game++){
  const rand=rng32(0xC4D00000+game*7919),starter=game%2?A:H;
  let st=makeLocalDuelState(starter),version=1,ply=0;
  let hostReplay=[],guestReplay=[];
  assertProjection(st,localDuelPayload(st,H,version,[],[]),H);assertProjection(st,localDuelPayload(st,A,version,[],[]),A);

  // Command validation sampled repeatedly across the soak run.
  if(game%10===0){
    assert.equal(applyLocalDuelMove(st,other(st.turn),'rock',0).error,'not-your-turn');
    assert.equal(applyLocalDuelMove(st,st.turn,'invalid',0).error,'invalid-piece');
    assert.equal(applyLocalDuelMove(st,st.turn,'rock',-1).error,'invalid-column');
  }

  while(!st.winner&&!st.draw&&ply++<80){
    const before=st,prevMoves=st.moveNumber,{owner,type,column,q}=chooseMove(st,rand,game,ply);
    st=q.state;version++;moves++;combats+=q.events.filter(e=>e.kind==='combat').length;decoyContacts+=q.events.filter(e=>e.kind==='combat'&&e.decoyContact).length;
    assert.equal(st.moveNumber,prevMoves+1,'successful Direct move must increment move number exactly once');
    if(!st.winner&&!st.draw)assert.equal(st.turn,other(owner),'turn must pass to the opponent after a completed non-terminal move');

    const interaction={before,after:st,events:q.events,owner,type,column,moveNumber:st.moveNumber};
    hostReplay.push(projectInteractionForViewer(interaction,H));guestReplay.push(projectInteractionForViewer(interaction,A));
    if(hostReplay.length>2)hostReplay.shift();if(guestReplay.length>2)guestReplay.shift();

    const terminal=!!(st.winner||st.draw),players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
    const host=localDuelPayload(st,H,version,q.events,players),guest=localDuelPayload(st,A,version,q.events,players);
    assertProjection(st,host,H,{terminal});assertProjection(st,guest,A,{terminal});
    assert.equal(host.version,version);assert.equal(guest.version,version);
    assert.deepEqual(host.players,players);assert.deepEqual(guest.players,players);

    // Both phones must describe the same physical pieces/occupancy even though their hidden
    // type visibility differs before terminal reveal.
    assert.deepEqual(flatten(host.state.board).map(({owner,id})=>({owner,id})),flatten(guest.state.board).map(({owner,id})=>({owner,id})));

    // Validate the local UI owner mapping used by Player 2: their own authoritative seat A
    // must become local "human" while Player 1 becomes local "ai/opponent".
    assert.equal(localOwner(host.state.turn,H),host.state.turn);
    assert.equal(localOwner(guest.state.turn,A),guest.state.turn===A?H:A);

    // Decoy contact may reveal that a decoy participated but must not reveal the other hidden
    // enemy R/P/S identity to a viewer who does not own that piece.
    for(const [viewer,payload] of [[H,host],[A,guest]])for(const e of payload.events||[]){
      if(e.kind!=='combat'||!e.decoyContact)continue;
      for(const p of [e.atk,e.def])if(p&&p.owner!==viewer&&p.type!=='decoy')assert.equal(p.type,null,'decoy contact leaked hidden enemy type')
    }
  }

  assert.ok(st.winner||st.draw,`Direct Duel soak game ${game} failed to terminate`);maxMoves=Math.max(maxMoves,st.moveNumber);
  if(st.draw)draws++;else if(st.winner===H)hWins++;else if(st.winner===A)aWins++;
  if(st.winReason==='clashmate')clashmates++;else if(st.winReason==='connect4')connect4++;
  assert.equal(applyLocalDuelMove(st,H,'rock',0).error,'match-complete','terminal authority accepted another move');

  // Terminal Direct payloads intentionally reveal the full final board to both players.
  const finalH=localDuelPayload(st,H,version,[],[]),finalA=localDuelPayload(st,A,version,[],[]);
  assertProjection(st,finalH,H,{terminal:true});assertProjection(st,finalA,A,{terminal:true});
  for(const p of finalH.state.board.flat())assert.ok(p.type);for(const p of finalA.state.board.flat())assert.ok(p.type);
  if(st.winner){
    const hostLocalWinner=localOwner(st.winner,H),guestLocalWinner=localOwner(st.winner,A);
    assert.notEqual(hostLocalWinner,guestLocalWinner,'both devices cannot locally report the same side as winner');
    assert.ok([H,A].includes(hostLocalWinner)&&[H,A].includes(guestLocalWinner));
  }

  // Replay source should retain exactly the final two projected interactions once available.
  assert.equal(hostReplay.length,Math.min(2,st.moveNumber));assert.equal(guestReplay.length,Math.min(2,st.moveNumber));
  assert.equal(hostReplay.at(-1).moveNumber,st.moveNumber);assert.equal(guestReplay.at(-1).moveNumber,st.moveNumber);
  if(st.moveNumber>=2){assert.equal(hostReplay[0].moveNumber,st.moveNumber-1);assert.equal(guestReplay[0].moveNumber,st.moveNumber-1)}

  // Model the 0.15.7 peer-preserving rematch reset: fresh authority, fresh version sequence,
  // empty board/inventories, no terminal state. This catches completed-state resurrection.
  const rematch=makeLocalDuelState(rand()<.5?H:A),rematchH=localDuelPayload(rematch,H,1,[],[]),rematchA=localDuelPayload(rematch,A,1,[],[]);
  assert.equal(rematch.moveNumber,0);assert.equal(occupied(rematch.board),0);assert.equal(rematch.winner,null);assert.equal(rematch.draw,false);
  for(const owner of [H,A])for(const type of T)assert.equal(rematch.inv[owner][type],7);
  assertProjection(rematch,rematchH,H);assertProjection(rematch,rematchA,A);
}

assert.equal(hWins+aWins+draws,GAMES);assert.ok(hWins>0&&aWins>0,'soak should exercise wins from both seats');
console.log(`PASS Direct Duel soak: ${GAMES} complete games, ${moves} moves, ${combats} combats, ${decoyContacts} decoy contacts, ${connect4} connect4, ${clashmates} clashmates, ${draws} draws, H wins ${hWins}, A wins ${aWins}, max ${maxMoves} moves`);
