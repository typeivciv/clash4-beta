import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/29-ui-consistency.js','utf8');
const css=fs.readFileSync('src/styles/62-ui-consistency.css','utf8');
const router=fs.readFileSync('src/js/18-duel-router.js','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const token of [
  "const UI_CONSISTENCY_VERSION='0.18.2'",
  'function uiConsistencyResetCoinPrompt()',
  "clearTimer('coin')",
  "coinText.textContent='Pick Heads or Tails'",
  "const leavingCoin=introScreen==='coin'&&next!=='coin'&&!ready",
  'function uiConsistencyAbandonPendingCoin()',
  'resetMatchRuntime(H,{isReady:false})',
  'function uiConsistencyTransportCleanup()',
  'directClosePeer({notify:true})',
  'passReset()',
  'duelClearActiveSession()',
  'globalThis.returnHomeAndReset=init',
  'function uiConsistencyComputeLayoutMetrics(width,height)',
  "const chrome=mode==='compact'?304:438",
  'computeLayoutMetrics=uiConsistencyComputeLayoutMetrics'
])assert.ok(js.includes(token),`UI consistency JS missing ${token}`);

for(const token of [
  ':root[data-theme] .coinTossScreen .coinChoices button{',
  ':root[data-theme] .coinTossScreen .coin{',
  '.gameplayV3 .panel.human .choices{grid-template-columns:repeat(4,minmax(0,1fr))}',
  '.gameplayV3 .panel.human .choice.c4UtilityPiece{',
  'border-style:solid',
  '.layout-compact.gameplayV3 .gameStage{padding-bottom:6px}',
  '.layout-compact.gameplayV3 .humanZone{padding-bottom:2px}'
])assert.ok(css.includes(token),`UI consistency CSS missing ${token}`);
assert.ok(!css.includes('.choice.c4UtilityPiece{border-style:dashed'),'Decoy must not look like a broken/mismatched control');

for(const token of [
  "UI_CONSISTENCY=ROOT/'src/js/29-ui-consistency.js'",
  "UI_CONSISTENCY_CSS=ROOT/'src/styles/62-ui-consistency.css'",
  "ui_consistency=UI_CONSISTENCY.read_text",
  "gameplay_v3+ui_consistency+anchor"
])assert.ok(builder.includes(token),`Alpha builder missing UI consistency package token ${token}`);

// Layout regression: Gameplay v3 added a drop rail, so 1366x768 must reserve more
// vertical chrome than the old 258px compact calculation did.
const metricSource=js.match(/function uiConsistencyComputeLayoutMetrics\(width,height\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(metricSource,'layout metric function missing');
const metrics=new Function(`${metricSource};return uiConsistencyComputeLayoutMetrics;`)();
const laptop=metrics(1366,768);
assert.equal(laptop.mode,'compact');
assert.ok(laptop.boardWidth<=620,`1366x768 board still too tall for command deck: ${laptop.boardWidth}px`);
const desktop=metrics(1440,1000);
assert.equal(desktop.mode,'desktop');
assert.ok(desktop.boardWidth>600&&desktop.boardWidth<800,'desktop board should remain dominant without clipping');
const phone=metrics(390,844);
assert.equal(phone.mode,'mobile');
assert.ok(phone.boardWidth<=380,'mobile board must remain inside viewport width');

// Multiplayer already has a canonical leave-to-home route. The consistency layer must
// match that behavior instead of merely hiding the current board.
for(const token of ['directClosePeer({notify:true})','passReset()','duelClearActiveSession()','duelStopPolling()'])assert.ok(router.includes(token),`duel home cleanup missing ${token}`);

try{new Function(js)}catch(error){throw new Error(`UI consistency syntax failed: ${error.message}`)}
console.log(`PASS UI consistency 0.18.2: coin back-flow reset, true Home reset, equal Decoy geometry, themed coin contrast, 1366x768 bottom-safe layout`);
