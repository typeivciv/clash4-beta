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

for(const token of [
  "const DIRECT_MOBILE_RESUME_VERSION='0.18.5'",
  'const DIRECT_MOBILE_PONG_TIMEOUT_MS=2600',
  'const DIRECT_MOBILE_HEARTBEAT_MS=12_000',
  'function directMobileResumeEligible()',
  "directDuel?.pairing==='nearby'",
  'function directMobileEnsureSignaling()',
  "peer.reconnect()",
  'function directMobileGuestConnect()',
  "peer.connect(target,{reliable:true,serialization:'json'})",
  "kind:'resume-ping'",
  "kind:'resume-pong'",
  "kind:'resume-request'",
  "kind:'resume-state'",
  'function directMobileSendSnapshot()',
  'localDuelPayload(auth.state,A,auth.version,[],players)',
  'function directMobileApplySnapshot(payload)',
  'duelSession.pendingLocal=null;busy=false',
  'const directBindChannelBeforeMobileResume=directBindChannel',
  'const resuming=directMobileResumeEligible()&&(directMobileResumeState.recovering||!directDuel.active)',
  "directConnectionBadge('online','Direct connected')",
  "document.addEventListener('visibilitychange',directMobileResumeFromLifecycle)",
  "window.addEventListener('pageshow',directMobileResumeFromLifecycle)",
  "window.addEventListener('online',directMobileResumeFromLifecycle)",
  "window.addEventListener('focus',directMobileResumeFromLifecycle)",
  '!globalThis.directMobileRecovery?.recovering',
  'globalThis.directMobileRecovery={'
])assert.ok(js.includes(token),`Mobile Direct resume contract missing ${token}`);

for(const forbidden of [
  'resolveRaw(', 'applyLocalDuelMove(', 'detectClashmate(', 'criticalColsFor(',
  's.board=', 's.inv=', 's.turn=', 's.winner=', 's.draw=',
  'fetch(', 'localStorage.setItem(', 'sessionStorage.setItem(', 'innerHTML=message.text',
  'location.reload(', 'history.go(', 'window.location='
])assert.ok(!js.includes(forbidden),`Direct social/resume layer must stay outside rules/state/persistence/navigation: ${forbidden}`);

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

try{new Function(js)}catch(error){throw new Error(`Direct chat/mobile-resume syntax failed: ${error.message}`)}
console.log('PASS Direct Duel social/resume 0.18.5: P2P chat isolation + mobile background heartbeat, signaling reconnect, transport rebuild, host snapshot resync');
