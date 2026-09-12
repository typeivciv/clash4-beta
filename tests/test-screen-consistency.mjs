import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/30-screen-consistency.js','utf8');
const css=fs.readFileSync('src/styles/63-screen-consistency.css','utf8');
const lobby=fs.readFileSync('src/ui/private-duel-lobby.html','utf8');
const tester=fs.readFileSync('src/js/23-duel-alpha-tester.js','utf8');

for(const token of [
  "const SCREEN_CONSISTENCY_VERSION='0.18.3'",
  'function screenConsistencyIntroFocusTarget(screen)',
  "home:'homePlayButton'", "setup:'setupBackButton'", "coin:'coinBackButton'", "duel:'duelBackButton'",
  'const setIntroScreenBeforeScreenConsistency=setIntroScreen',
  'screenConsistencyFocusIntro(introScreen)',
  'function screenConsistencyOwnershipPatternCopy()',
  "matchMode!=='duel'",
  "localOwner===A?'dots':'stripes'",
  "Opponent piece types stay hidden.",
  "AI piece types stay hidden.",
  "CLASH marks active combat, turn markers show who is active",
  'function screenConsistencyHelpContext()',
  "return'Multiplayer'", "return'Coin Toss'", "return'Setup'", "return'Home'", "return'Results'", "return'Review'", "return'Match'",
  'const openHelpBeforeScreenConsistency=openHelp',
  'helpBack.textContent=`Back to ${context}`',
  'const renderPostMatchBeforeScreenConsistency=renderPostMatch',
  "end.focus({preventScroll:true})",
  'function screenConsistencyAlphaIsOpen()',
  'screenConsistencyAlphaReturnFocus',
  'trapModalTab(event,modal)',
  "target.closest('#betaFeedbackButton')",
  'event.stopImmediatePropagation()',
  'alphaReportProblem()',
  'globalThis.screenConsistencySyncSharedCopy'
])assert.ok(js.includes(token),`screen consistency JS missing ${token}`);

for(const token of [
  '.betaFeedbackOverlay{display:none!important}',
  '.introBack,.duelSectionBack{min-height:38px',
  '@media(pointer:coarse){.introBack,.duelSectionBack{min-height:44px',
  '.helpFooterActions #helpBack{grid-column:1/-1;width:100%}',
  '.alphaTesterModal{overscroll-behavior:contain}',
  '.alphaTesterModal :focus-visible{'
])assert.ok(css.includes(token),`screen consistency CSS missing ${token}`);

// The Alpha owns one tester/reporting modal. The old public-beta overlay is retained
// only in the frozen base source and is disabled in the generated Alpha CSS.
assert.ok(js.includes("feedbackButton.textContent='Report Problem'"),'Help feedback action must be relabeled for Alpha');
assert.ok(!js.includes('location.reload('),'screen consistency must not paper over state bugs with page reloads');
assert.ok(!js.includes('fetch(')&&!js.includes('RTCPeerConnection'),'screen consistency must not change networking');
assert.ok(!/ROWS\s*=|COLS\s*=/.test(js),'screen consistency must not redefine board geometry');

assert.ok(tester.includes("const ALPHA_TESTER_VERSION='0.18.3'"),'tester diagnostics must match the 0.18.3 Alpha');
for(const token of ['Multiplayer Alpha · 0.18.3'])assert.ok(lobby.includes(token),`lobby version drift: ${token}`);
assert.ok(!lobby.includes('Multiplayer Alpha · 0.17'),'lobby must not surface stale 0.17 copy');

try{new Function(js)}catch(error){throw new Error(`screen consistency syntax failed: ${error.message}`)}
console.log('PASS screen consistency 0.18.3: Home/Setup/Coin/Multiplayer focus, mode-aware Help, result focus, one tester modal, mobile Help geometry');
