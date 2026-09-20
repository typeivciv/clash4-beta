import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/32-ios-chat-keyboard.js','utf8');
const css=fs.readFileSync('src/styles/65-ios-chat-keyboard.css','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.7'",
  'function directChatIOSLike()',
  'function directChatFocusComposer(',
  'function directChatKeyboardViewport()',
  'function directChatInstallKeyboardFix()',
  "input.setAttribute('inputmode','text')",
  "input.setAttribute('autocapitalize','sentences')",
  "input.setAttribute('spellcheck','true')",
  "input.setAttribute('enterkeyhint','send')",
  "input.addEventListener('pointerdown'",
  "window.visualViewport.addEventListener('resize'",
  "document.body.classList.add('direct-chat-input-focused')",
  "body.classList.toggle('direct-chat-keyboard-shown'",
  "--direct-chat-visual-height",
  "--direct-chat-visual-top",
  'globalThis.directChatKeyboard='
])assert.ok(js.includes(token),`mobile chat keyboard contract missing ${token}`);

assert.ok(!js.includes("fab.addEventListener('click'"),'opening Chat on mobile must not force the software keyboard');
assert.ok(!js.includes('preventDefault()'),'keyboard bridge must not suppress native text-input gestures');
assert.ok(!js.includes('directSend('),'keyboard bridge must stay outside chat/game transport');
assert.ok(!js.includes('applyLocalDuelMove('),'keyboard bridge must not touch gameplay rules');

for(const token of [
  '.directChatForm input{font-size:16px',
  '-webkit-user-select:text',
  'touch-action:manipulation',
  'pointer-events:auto',
  'env(safe-area-inset-bottom)',
  '@media(max-width:900px),(pointer:coarse)'
])assert.ok(css.includes(token),`mobile chat keyboard CSS contract missing ${token}`);

for(const token of [
  "IOS_CHAT_KEYBOARD=ROOT/'src/js/32-ios-chat-keyboard.js'",
  "IOS_CHAT_KEYBOARD_CSS=ROOT/'src/styles/65-ios-chat-keyboard.css'",
  "ios_chat_keyboard=IOS_CHAT_KEYBOARD.read_text",
  'direct_chat+ios_chat_keyboard+direct_chat_v2+anchor'
])assert.ok(builder.includes(token),`Alpha builder missing mobile chat keyboard package token ${token}`);

try{new Function(js)}catch(error){throw new Error(`mobile chat keyboard syntax failed: ${error.message}`)}
console.log('PASS mobile Direct Chat keyboard 0.18.7: input-tap keyboard activation, visualViewport tracking, safe-area support, no forced keyboard on open');
