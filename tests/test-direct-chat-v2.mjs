import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/33-direct-chat-v2.js','utf8');
const css=fs.readFileSync('src/styles/66-direct-chat-v2.css','utf8');
const keyboard=fs.readFileSync('src/js/32-ios-chat-keyboard.js','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const token of [
  "const DIRECT_CHAT_V2_VERSION='0.18.7'",
  'function directChatV2IsMobile()',
  'function directChatV2NearBottom(log)',
  'function directChatV2CreateMessage(message)',
  'row.dataset.chatId=message.id',
  "row.classList.remove('is-new')",
  'const existing=new Map(',
  "drawer.classList.toggle('has-draft',length>0)",
  "mute.textContent=directChatState.muted?'Alerts off':'Alerts'",
  "send.textContent='↑'",
  "input.placeholder='Message…'",
  "backdrop.addEventListener('click',()=>directChatClose())",
  'const directChatSetOpenBeforeV2=directChatSetOpen',
  "if(directChatV2IsMobile()){try{drawer.focus",
  "else{try{directChatEl('directChatInput')?.focus",
  "directChatEl('directChatInput')?.blur()",
  'globalThis.directChatV2='
])assert.ok(js.includes(token),`Universal Chat v2 JS missing ${token}`);

for(const forbidden of [
  'directSend(', 'RTCPeerConnection', 'peer.connect(', 'applyLocalDuelMove(', 'resolveRaw(',
  's.board=', 's.inv=', 's.turn=', 's.winner=', 'localStorage.setItem(', 'sessionStorage.setItem(', 'fetch('
])assert.ok(!js.includes(forbidden),`Universal Chat v2 must remain presentation-only: ${forbidden}`);

for(const token of [
  '.directChatDrawer.directChatV2{',
  '.directChatBackdrop{',
  '.directChatV2 .directChatMessage.is-new{',
  '.directChatV2 .directChatForm input{',
  'font-size:16px',
  'env(safe-area-inset-bottom)',
  'body.direct-chat-input-focused .directChatDrawer.directChatV2',
  '--direct-chat-visual-top',
  '--direct-chat-visual-height',
  '.direct-chat-input-focused .directChatV2.has-draft .directChatQuickRow{display:none}',
  'touch-action:pan-y',
  'touch-action:pan-x',
  '@media(orientation:landscape)',
  '@media(prefers-reduced-motion:reduce)'
])assert.ok(css.includes(token),`Universal Chat v2 CSS missing ${token}`);
assert.ok(!css.includes('var(--blue-piece)')&&!css.includes('var(--orange-piece)'),'Universal chat world surface must not borrow player ownership colors');
assert.ok(!css.includes('body.direct-chat-open{overflow:hidden;touch-action:none}'),'mobile chat must not disable scrolling inside its own message log');

for(const token of [
  "const IOS_CHAT_KEYBOARD_VERSION='0.18.7'",
  "input.addEventListener('pointerdown'",
  "body.classList.toggle('direct-chat-keyboard-shown'",
  "DIRECT_CHAT_V2=ROOT/'src/js/33-direct-chat-v2.js'",
  "DIRECT_CHAT_V2_CSS=ROOT/'src/styles/66-direct-chat-v2.css'",
  "direct_chat_v2=DIRECT_CHAT_V2.read_text",
  "direct_chat+ios_chat_keyboard+direct_chat_v2+anchor",
  'viewport-fit=cover,interactive-widget=resizes-content'
])assert.ok((token.includes('DIRECT_CHAT_V2')||token.includes('direct_chat_v2')||token.includes('viewport-fit')||token.includes('+anchor'))?builder.includes(token):keyboard.includes(token),`Universal Chat packaging/keyboard token missing ${token}`);

try{new Function(js)}catch(error){throw new Error(`Universal Chat v2 syntax failed: ${error.message}`)}
console.log('PASS Universal Direct Chat v2 0.18.7: stable mobile sheet, keyboard-safe composer, keyed message rendering, theme-only atmosphere, transport isolation');
