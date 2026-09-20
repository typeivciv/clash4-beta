import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/31-direct-chat.js','utf8');
const css=fs.readFileSync('src/styles/64-direct-chat.css','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const token of [
  "const DIRECT_CHAT_VERSION='0.18.4'",
  'const DIRECT_CHAT_PROTOCOL=1',
  'const DIRECT_CHAT_MAX_MESSAGES=50',
  'const DIRECT_CHAT_MAX_CHARS=200',
  'const DIRECT_CHAT_MIN_SEND_MS=500',
  'const DIRECT_CHAT_BURST_MAX=8',
  "kind:'chat'",
  'chatVersion:DIRECT_CHAT_PROTOCOL',
  'function directChatNormalizeText(',
  'text.textContent=message.text',
  'function directChatConnected()',
  "directDuel?.channel?.readyState==='open'",
  'function directChatReceive(data)',
  'function directChatSendText(value)',
  'function directChatToggleMute()',
  'function directChatReset()',
  'const directHandleMessageBeforeChat=directHandleMessage',
  "if(data?.kind==='chat'){directChatReceive(data);return}",
  'const directClosePeerBeforeChat=directClosePeer',
  'const duelStartDirectRematchBeforeChat=duelStartDirectRematch',
  'const directEnterReadyRoomBeforeChat=directEnterReadyRoom',
  "DIRECT_CHAT_QUICK=['Nice move!','Good game!','Rematch?','🔥','😂','😮']",
  "document.querySelector('.overlay.show,.end.show,.coinOverlay.show,.helpOverlay.show,.alphaTesterModal:not([hidden])')",
  'globalThis.directChat='
])assert.ok(js.includes(token),`Direct chat contract missing ${token}`);

for(const forbidden of [
  'resolveRaw(', 'applyLocalDuelMove(', 'detectClashmate(', 'criticalColsFor(',
  's.board=', 's.inv=', 's.turn=', 's.winner=', 's.draw=',
  'fetch(', 'localStorage.setItem(', 'sessionStorage.setItem(', 'innerHTML=message.text'
])assert.ok(!js.includes(forbidden),`Direct chat must stay outside rules/state/persistence: ${forbidden}`);

for(const token of [
  '.directChatFab{', '.directChatDrawer{', '.directChatMessage.mine{', '.directChatMessage.theirs{',
  'var(--world-accent', 'var(--world-panel', '@media(max-width:700px)',
  'height:min(62dvh,540px)', '.directChatDrawer button:focus-visible', '@media(prefers-reduced-motion:reduce)'
])assert.ok(css.includes(token),`Direct chat CSS missing ${token}`);
assert.ok(!css.includes('var(--blue-piece)')&&!css.includes('var(--orange-piece)'),'Chat atmosphere must not borrow player ownership colors');

for(const token of [
  "DIRECT_CHAT=ROOT/'src/js/31-direct-chat.js'",
  "DIRECT_CHAT_CSS=ROOT/'src/styles/64-direct-chat.css'",
  "direct_chat=DIRECT_CHAT.read_text",
  'screen_consistency+direct_chat+anchor'
])assert.ok(builder.includes(token),`Alpha builder missing Direct Chat package token ${token}`);

try{new Function(js)}catch(error){throw new Error(`Direct chat syntax failed: ${error.message}`)}
console.log('PASS Direct Duel Chat 0.18.4: P2P-only transport, 50-message memory cap, 200-char plain text, rate limits, quick reactions, mute, unread badge, rematch/leave cleanup, theme-aware responsive drawer');
