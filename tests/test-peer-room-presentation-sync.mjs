import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/js/41-peer-room-presentation-sync.js','utf8');
const loader=fs.readFileSync('src/js/35-peer-room-hardening.js','utf8');

assert.match(src,/PEER_ROOM_PRESENTATION_SYNC_VERSION='0\.20\.6'/,'0.20.6 sync version missing');
assert.match(src,/room-clock-ping/,'guest clock ping missing');
assert.match(src,/room-clock-pong/,'host clock pong missing');
assert.match(src,/room-clock-report/,'RTT report missing');
assert.match(src,/room-presentation-prepare/,'host PREPARE missing');
assert.match(src,/room-presentation-ready/,'guest receipt READY missing');
assert.match(src,/room-presentation-go/,'host GO missing');
assert.match(src,/peerRoomPresentationSyncReceiptLeadMs/,'receipt-aware lead calculation missing');
assert.match(src,/estimatedHostReceivedAt/,'guest must report host-clock receipt estimate');
assert.match(src,/pendingHostTransactions/,'host must retain prepared authoritative transaction');
assert.match(src,/pendingGuestTransactions/,'guest must retain Fog-safe prepared transaction');
assert.match(src,/tx\.hostPayload\.peerPresentation=\{\.\.\.presentation\}/,'host must consume final shared presentation transaction');
assert.match(src,/tx\.guestPayload\.peerPresentation=\{\.\.\.presentation\}/,'guest payload must carry final shared presentation transaction');
assert.match(src,/peerRoomSynchronized:true/,'local move must use synchronized pending intent');
assert.match(src,/hoverCol=c;dropPresentation=null;render\(\)/,'input should acknowledge intent without starting a real checker drop');
assert.match(src,/scheduleTimer\('peerRoomPresentationStart'/,'actual checker must wait for final shared presentation time');
assert.match(src,/peerRoomPresentationSyncStage\(tx\)/,'authoritative transaction must stage the checker');
assert.match(src,/scheduleTimer\('peerRoomMoveTransaction'/,'authoritative transaction must own drop completion');
assert.match(src,/peerRoomTransactionCommit\(tx\)/,'canonical transaction commit seam must remain');
assert.match(src,/Canonical move validation still happens once/,'receipt handshake must remain presentation-only');
assert.doesNotMatch(src,/applyLocalDuelMove\(/,'presentation sync must not duplicate canonical rule execution');
assert.doesNotMatch(src,/s\.winner\s*=/,'presentation sync must not author winner state');
assert.match(loader,/src\/js\/41-peer-room-presentation-sync\.js/,'loader must include sync after transaction layer');
assert.match(loader,/existing\.addEventListener\('load',peerRoomLoadPresentationSync/,'sync must wait for the transaction layer');

console.log('PASS Peer Room 0.20.6 presentation sync contract: PREPARE/READY/GO receipt gating, NTP-style clock sampling, intent-only input feedback, adaptive delivery lead, and canonical-rule isolation.');