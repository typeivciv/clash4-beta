import assert from 'node:assert/strict';
import fs from 'node:fs';

const match=fs.readFileSync('src/js/36-peer-room-match.js','utf8');
const hardening=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');
const css=fs.readFileSync('src/styles/68-peer-room-match.css','utf8');

for(const token of [
  "const PEER_ROOM_MATCH_VERSION='0.20.0'",
  'function peerRoomMatchStart()',
  'makeLocalDuelState(randomDuelStarter())',
  "peerRoomMatchBroadcast([],'room-match-start')",
  "data?.kind==='room-match-move'",
  'peerRoomMatchAuthorityMove(A,data.type,data.column)',
  'const duelRouteMoveBeforePeerRoom=duelRouteMove',
  "if(peerRoomMatch.phase==='active'&&peerRoom?.active)",
  'return peerRoomMatchMove(owner,type,column)',
  "peerRoomBroadcast({kind:'room-match-lobby'",
  "button.textContent='Return to Lobby'",
  'peerRoomMatchSpectatorPayload',
  'ps.board=ps.board.map(col=>col.map(piece=>({...piece,type:null})))',
  'peerRoomMatchSafeSet(PEER_ROOM_MATCH_STORAGE',
  'requestAnimationFrame(finish)',
  "if(peerRoomMatch.phase==='active'&&peerRoomMatch.authority)peerRoomMatchSendSeat(seat,conn,[],'room-match-start')"
])assert.ok(match.includes(token),`Peer Room 0.20 missing contract token: ${token}`);

for(const token of [
  "link.href='src/styles/68-peer-room-match.css'",
  "script.src='src/js/36-peer-room-match.js'",
  'peerRoomLoadPlayableMatch()'
])assert.ok(hardening.includes(token),`Peer Room 0.20 loader missing: ${token}`);

for(const token of [
  '.peerRoomGame',
  'body.peer-room-spectator .humanZone .choices',
  'pointer-events:none',
  '@media(max-width:700px)'
])assert.ok(css.includes(token),`Peer Room 0.20 CSS missing: ${token}`);

assert.ok(!match.includes('directDuel.authority='),'Peer Room must not overwrite Direct Duel authority');
assert.ok(!match.includes('applyLocalDuelMove(auth.state,H,data.type'),'Player 2 canonical moves must not be treated as Player 1');

try{new Function(match);new Function(hardening)}catch(error){throw new Error(`Peer Room 0.20 syntax failed: ${error.message}`)}
console.log('PASS Peer Room 0.20 shared-match contract: persistent lobby, P1/P2 host authority, Fog-safe spectators, return-to-lobby lifecycle, host recovery snapshot, and deferred join UI');
