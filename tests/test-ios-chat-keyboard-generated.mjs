import assert from 'node:assert/strict';
import fs from 'node:fs';

const alpha=fs.readFileSync('multiplayer-alpha.html','utf8');
for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.6'",
  'function directChatFocusComposer(',
  "fab.addEventListener('click'",
  "input.addEventListener('touchend'",
  "window.visualViewport.addEventListener('resize'",
  '.directChatForm input{font-size:16px',
  'env(safe-area-inset-bottom)',
  'body.direct-chat-keyboard-active .directChatDrawer'
])assert.ok(alpha.includes(token),`generated Alpha missing iPhone chat keyboard token: ${token}`);

const chatIndex=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
const keyboardIndex=alpha.indexOf("const IOS_CHAT_KEYBOARD_VERSION='0.18.6'");
const aiIndex=alpha.indexOf('// AI evaluation and decision policy.',keyboardIndex);
assert.ok(chatIndex>=0&&keyboardIndex>chatIndex,'iPhone keyboard repair must load after Direct Chat');
assert.ok(aiIndex>keyboardIndex,'iPhone keyboard repair must remain inside the Alpha presentation extension boundary');
console.log('PASS generated iPhone Direct Chat keyboard package: repair loads after chat and preserves presentation-layer ordering');
