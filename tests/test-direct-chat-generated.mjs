import assert from 'node:assert/strict';
import fs from 'node:fs';

const alpha=fs.readFileSync('multiplayer-alpha.html','utf8');
for(const token of [
  "const DIRECT_CHAT_VERSION='0.18.4'",
  'id="directChatFab"',
  'id="directChatDrawer"',
  'id="directChatLog"',
  'id="directChatInput"',
  "kind:'chat'",
  'chatVersion:DIRECT_CHAT_PROTOCOL',
  'Private WebRTC · this match only',
  '.directChatDrawer{',
  '@media(max-width:700px)',
  'height:min(62dvh,540px)'
])assert.ok(alpha.includes(token),`generated Alpha missing Direct Chat package token: ${token}`);

for(const forbidden of ['innerHTML=message.text','var(--blue-piece)','var(--orange-piece)']){
  const chatStart=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
  const chatEnd=alpha.indexOf('// AI evaluation and decision policy.',chatStart);
  const chatSlice=alpha.slice(chatStart,chatEnd>chatStart?chatEnd:undefined);
  if(forbidden==='var(--blue-piece)'||forbidden==='var(--orange-piece)')continue;
  assert.ok(!chatSlice.includes(forbidden),`generated Direct Chat contains unsafe token: ${forbidden}`)
}
console.log('PASS generated Direct Chat v1 package: drawer, unread UI, plain-text P2P protocol, responsive styling');
