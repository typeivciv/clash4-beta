import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/js/41-peer-room-presentation-sync.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

assert.match(src,/PEER_ROOM_PRESENTATION_SYNC_VERSION='0\.20\.5'/,'0.20.5 version missing');
assert.match(src,/room-clock-ping/,'guest clock ping missing');
assert.match(src,/room-clock-pong/,'host clock pong missing');
assert.match(src,/room-clock-report/,'RTT report missing');
assert.match(src,/presentAtHost/,'host presentation timestamp missing');
assert.match(src,/payload\.peerPresentation=\{\.\.\.presentation\}/,'seat payload must carry the same host presentation transaction');
assert.match(src,/hostPayload\.peerPresentation=\{\.\.\.presentation\}/,'host must consume the same presentation transaction as guests');
assert.match(src,/peerRoomSynchronized:true/,'local move must use synchronized pending intent');
assert.match(src,/hoverCol=c;dropPresentation=null;render\(\)/,'input should acknowledge intent without starting a real checker drop');
assert.match(src,/scheduleTimer\('peerRoomPresentationStart'/,'actual checker must wait for authoritative presentation time');
assert.match(src,/peerRoomPresentationSyncStage\(tx\)/,'authoritative transaction must stage the checker');
assert.match(src,/scheduleTimer\('peerRoomMoveTransaction'/,'authoritative transaction must own the drop completion');
assert.match(src,/peerRoomTransactionCommit\(tx\)/,'existing canonical commit/event pipeline must remain the commit seam');
assert.match(src,/presentation-only and is\n\/\/ never used to validate turns, moves, Fog, inventory, or winners/,'clock sync must remain presentation-only');
assert.doesNotMatch(src,/applyLocalDuelMove\(/,'presentation sync must not duplicate canonical rule execution');
assert.doesNotMatch(src,/s\.winner\s*=/,'presentation sync must not author winner state');
assert.match(loader,/src\/js\/41-peer-room-presentation-sync\.js/,'loader must include 0.20.5 after transaction layer');
assert.match(loader,/existing\.addEventListener\('load',peerRoomLoadPresentationSync/,'0.20.5 must wait for the 0.20.4 transaction layer');

console.log('PASS Peer Room 0.20.5 source contract: one host-timed presentation transaction, NTP-style guest clock sampling, intent-only local feedback, and canonical-rule isolation.');
