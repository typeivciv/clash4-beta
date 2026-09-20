import assert from 'node:assert/strict';
import fs from 'node:fs';

const alpha=fs.readFileSync('multiplayer-alpha.html','utf8');
for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.7'",
  'function directChatFocusComposer(',
  "input.addEventListener('pointerdown'",
  "window.visualViewport.addEventListener('resize'",
  "document.body.classList.add('direct-chat-input-focused')",
  "body.classList.toggle('direct-chat-keyboard-shown'",
  '.directChatForm input{font-size:16px',
  'env(safe-area-inset-bottom)',
  'viewport-fit=cover,interactive-widget=resizes-content'
])assert.ok(alpha.includes(token),`generated Alpha missing mobile chat keyboard token: ${token}`);

assert.ok(!alpha.includes("fab.addEventListener('click',()=>{\n    if(!directChatState?.open)return;\n    directChatFocusComposer"),'generated mobile chat must not force keyboard from the Chat button');
const chatIndex=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
const keyboardIndex=alpha.indexOf("const IOS_CHAT_KEYBOARD_VERSION='0.18.7'");
const v2Index=alpha.indexOf("const DIRECT_CHAT_V2_VERSION='0.18.7'");
const aiIndex=alpha.indexOf('// AI evaluation and decision policy.',v2Index);
assert.ok(chatIndex>=0&&keyboardIndex>chatIndex,'mobile keyboard bridge must load after Direct Chat');
assert.ok(v2Index>keyboardIndex,'Universal Chat v2 must load after the keyboard bridge');
assert.ok(aiIndex>v2Index,'chat presentation modules must remain inside the Alpha extension boundary');
console.log('PASS generated mobile Direct Chat keyboard package: input-tap activation + viewport-safe ordering');
