import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/js/38-peer-room-polish.js','utf8');
const css=fs.readFileSync('src/styles/69-peer-room-polish.css','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

for(const token of [
  "PEER_ROOM_POLISH_VERSION='0.20.2'",
  "peerRoom.matchColors={1:'blue',2:'orange'}",
  'peerRoomPolishPresets',
  'peerRoomPolishChooseColor',
  "kind:'room-color-select'",
  "kind:'room-color-reject'",
  'peerRoomPolishApplyGameColors',
  'humanColor=makeColor(mine.hex,mine.label,mine.id)',
  'aiColor=makeColor(opp.hex,opp.label,opp.id)',
  'peerOptimistic:true',
  'dropPresentation={before:pending.before',
  "kind:'room-match-move'",
  'duelSession.pendingLocal=null',
  "button.id='peerRoomMatchLobbyButton'",
  'peerRoomMatchRequestLobby()',
  'peerRoomRestoreHostBeforePolish',
  'peerRoomPolishLoadColors()'
])assert.ok(src.includes(token),`missing Peer Room polish contract: ${token}`);

assert.equal(src.includes('globalThis.COLOR_PRESETS'),false,'classic-script COLOR_PRESETS must use its lexical binding, not window/globalThis');
assert.ok(loader.includes("src/js/38-peer-room-polish.js"),'loader must mount 0.20.2 polish script');
assert.ok(loader.includes("src/styles/69-peer-room-polish.css"),'loader must mount 0.20.2 polish stylesheet');
assert.ok(loader.includes("addEventListener('load',peerRoomLoadPolish"),'polish must load only after runtime bridge');
assert.ok(css.includes('.peerRoomColorSwatches'),'color selector styling missing');
assert.ok(css.includes('.peerRoomMatchLobbyButton'),'persistent lobby button styling missing');

// The guest must receive visual acknowledgement before the WebRTC move leaves the phone.
const guestMoveStart=src.indexOf('const peerRoomMatchMoveBeforePolish');
const previewIndex=src.indexOf('dropPresentation={before:pending.before',guestMoveStart);
const sendIndex=src.indexOf("peerRoomSend(peerRoom.conn,{kind:'room-match-move'",guestMoveStart);
assert.ok(previewIndex>guestMoveStart&&sendIndex>previewIndex,'P2 drop preview must render before host round-trip begins');

// The authoritative response must clear the optimistic pending marker before the original
// network presentation runs, otherwise Player 2 would see the drop animation twice.
const reconcileStart=src.indexOf('const duelApplyActiveUpdateBeforePeerPolish');
const clearPending=src.indexOf('duelSession.pendingLocal=null',reconcileStart);
const delegateUpdate=src.indexOf('return duelApplyActiveUpdateBeforePeerPolish(payload)',reconcileStart);
assert.ok(clearPending>reconcileStart&&delegateUpdate>clearPending,'authoritative reconciliation must suppress duplicate local-drop replay');

// Seat colors are intentionally global to the room: P1 and P2 defaults differ and the
// opponent's active color is disabled in the local chooser.
assert.ok(src.includes("button.disabled=!playing||active||preset.id===other"),'opponent color must not be selectable');
assert.ok(src.includes("if(colors[other]===id)"),'duplicate color choice must be rejected');

console.log('PASS Peer Room 0.20.2 polish: seat-owned distinct colors, immediate P2 drop preview with authoritative reconciliation, persisted host color restore, and persistent Return-to-Lobby navigation');
