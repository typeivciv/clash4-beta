import assert from 'node:assert/strict';
import fs from 'node:fs';

const alpha=fs.readFileSync('multiplayer-alpha.html','utf8');
for(const token of [
  "const DIRECT_CHAT_V2_VERSION='0.18.7'",
  'function directChatV2CreateMessage(message)',
  "row.dataset.chatId=message.id",
  "send.textContent='↑'",
  "input.placeholder='Message…'",
  '.directChatDrawer.directChatV2{',
  '.directChatBackdrop{',
  'body.direct-chat-input-focused .directChatDrawer.directChatV2',
  '.direct-chat-input-focused .directChatV2.has-draft .directChatQuickRow{display:none}',
  'function directChatV2LoadPeerRoomFoundation()',
  "link.href='src/styles/67-peer-room-foundation.css'",
  "script.src='src/js/34-peer-room-foundation.js'",
  'viewport-fit=cover,interactive-widget=resizes-content'
])assert.ok(alpha.includes(token),`generated Alpha missing Universal Chat/Peer Room loader token: ${token}`);

const chatIndex=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
const keyboardIndex=alpha.indexOf("const IOS_CHAT_KEYBOARD_VERSION='0.18.7'");
const v2Index=alpha.indexOf("const DIRECT_CHAT_V2_VERSION='0.18.7'");
const aiIndex=alpha.indexOf('// AI evaluation and decision policy.',v2Index);
assert.ok(chatIndex>=0&&keyboardIndex>chatIndex&&v2Index>keyboardIndex,'Universal Chat ordering must remain base chat → mobile keyboard bridge → v2 presentation');
assert.ok(aiIndex>v2Index,'Universal Chat v2 must remain inside the Alpha presentation extension boundary');
const v2Slice=alpha.slice(v2Index,aiIndex);
for(const forbidden of ['directSend(','RTCPeerConnection','applyLocalDuelMove(','s.board=','s.inv=','fetch('])assert.ok(!v2Slice.includes(forbidden),`generated Universal Chat v2 leaked into transport/rules: ${forbidden}`);
console.log('PASS generated Universal Chat + Peer Room loader: cross-platform chat remains isolated while Multiplayer Foundation 0.19 loads as an experimental source module');
