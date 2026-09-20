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
  'height:min(62dvh,540px)',
  "const DIRECT_MOBILE_RESUME_VERSION='0.18.5'",
  "kind:'resume-ping'",
  "kind:'resume-pong'",
  "kind:'resume-request'",
  "kind:'resume-state'",
  'function directMobileEnsureSignaling()',
  'function directMobileGuestConnect()',
  'function directMobileSendSnapshot()',
  'function directMobileApplySnapshot(payload)',
  "document.addEventListener('visibilitychange',directMobileResumeFromLifecycle)",
  "window.addEventListener('pageshow',directMobileResumeFromLifecycle)",
  'globalThis.directMobileRecovery={'
])assert.ok(alpha.includes(token),`generated Alpha missing Direct social/resume package token: ${token}`);

const chatStart=alpha.indexOf("const DIRECT_CHAT_VERSION='0.18.4'");
const chatEnd=alpha.indexOf('// AI evaluation and decision policy.',chatStart);
const chatSlice=alpha.slice(chatStart,chatEnd>chatStart?chatEnd:undefined);
assert.ok(chatStart>=0,'generated Direct Chat/mobile-resume module not found');
assert.ok(!chatSlice.includes('innerHTML=message.text'),'generated Direct Chat must never render remote text through innerHTML');
for(const forbidden of ['location.reload(','sessionStorage.setItem(','localStorage.setItem(','s.board=','s.inv=','s.turn=','s.winner='])assert.ok(!chatSlice.includes(forbidden),`generated resume layer contains forbidden state/navigation token: ${forbidden}`);
console.log('PASS generated Direct social/resume package: chat UI + mobile lifecycle transport recovery + host snapshot resync');
