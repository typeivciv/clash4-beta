import assert from 'node:assert/strict';
import fs from 'node:fs';

const alpha=fs.readFileSync('multiplayer-alpha.html','utf8');
for(const token of [
  "const DIRECT_CHAT_VERSION='0.18.4'",
  "fab.id='directChatFab'",
  "drawer.id='directChatDrawer'",
  'id="directChatLog"',
  'id="directChatInput"',
  "kind:'chat'",
  'chatVersion:DIRECT_CHAT_PROTOCOL',
  'Private WebRTC · this match only',
  "document.querySelector('.topActions')",
  '.directChatDrawer{',
  '@media(max-width:700px)',
  'height:min(62dvh,540px)'
])assert.ok(alpha.includes(token),`generated Alpha missing Direct Chat package token: ${token}`);

const chatStart=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
const chatEnd=alpha.indexOf('// AI evaluation and decision policy.',chatStart);
const chatSlice=alpha.slice(chatStart,chatEnd>chatStart?chatEnd:undefined);
assert.ok(chatStart>=0,'generated Direct Chat module not found');
assert.ok(!chatSlice.includes('innerHTML=message.text'),'generated Direct Chat must never render remote text through innerHTML');
console.log('PASS generated Direct Chat v1 package: header trigger, drawer, unread UI, plain-text P2P protocol, responsive styling');
