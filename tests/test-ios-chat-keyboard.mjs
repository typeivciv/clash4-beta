import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/32-ios-chat-keyboard.js','utf8');
const css=fs.readFileSync('src/styles/65-ios-chat-keyboard.css','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.6'",
  'function directChatIOSLike()',
  'function directChatFocusComposer(',
  'function directChatKeyboardViewport()',
  'function directChatInstallKeyboardFix()',
  "input.setAttribute('inputmode','text')",
  "input.setAttribute('autocapitalize','sentences')",
  "input.setAttribute('spellcheck','true')",
  "fab.addEventListener('click'",
  'directChatFocusComposer({scroll:false})',
  "input.addEventListener('touchend'",
  "window.visualViewport.addEventListener('resize'",
  "document.body.classList.add('direct-chat-keyboard-active')",
  'globalThis.directChatKeyboard='
])assert.ok(js.includes(token),`iPhone chat keyboard contract missing ${token}`);

assert.ok(!js.includes('preventDefault()'),'keyboard repair must not suppress the native text-input gesture');
assert.ok(!js.includes('directSend('),'keyboard repair must stay outside the chat/game transport');
assert.ok(!js.includes('applyLocalDuelMove('),'keyboard repair must not touch gameplay rules');

for(const token of [
  '.directChatForm input{font-size:16px',
  '-webkit-user-select:text',
  'touch-action:manipulation',
  'pointer-events:auto',
  'env(safe-area-inset-bottom)',
  '--direct-chat-visible-height',
  'body.direct-chat-keyboard-active .directChatDrawer'
])assert.ok(css.includes(token),`iPhone chat CSS contract missing ${token}`);

for(const token of [
  "IOS_CHAT_KEYBOARD=ROOT/'src/js/32-ios-chat-keyboard.js'",
  "IOS_CHAT_KEYBOARD_CSS=ROOT/'src/styles/65-ios-chat-keyboard.css'",
  "ios_chat_keyboard=IOS_CHAT_KEYBOARD.read_text",
  'direct_chat+ios_chat_keyboard+anchor'
])assert.ok(builder.includes(token),`Alpha builder missing iPhone chat keyboard package token ${token}`);

try{new Function(js)}catch(error){throw new Error(`iPhone chat keyboard syntax failed: ${error.message}`)}
console.log('PASS iPhone Direct Chat keyboard 0.18.6: synchronous user-gesture focus, 16px composer, native touch input, visualViewport and safe-area handling');
