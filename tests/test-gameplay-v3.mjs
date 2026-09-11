import assert from 'node:assert/strict';
import fs from 'node:fs';

const js=fs.readFileSync('src/js/28-gameplay-v3.js','utf8');
const css=fs.readFileSync('src/styles/61-gameplay-v3.css','utf8');

for(const token of [
  "const GAMEPLAY_V3_VERSION='0.18.1'",
  'const GAMEPLAY_V3_ICONS={',
  "rock:'<svg", "paper:'<svg", "scissors:'<svg", "decoy:'<svg",
  'function gameplayV3EnsureDropRail()',
  "rail.id='c4DropRail'",
  "Array.from({length:8}",
  'function gameplayV3SyncDropRail()',
  'function gameplayV3EnhanceInventory()',
  "button.classList.toggle('c4PrimaryPiece',kind!=='decoy')",
  "button.classList.toggle('c4UtilityPiece',kind==='decoy')",
  'function gameplayV3DecorateBoard()',
  'function gameplayV3DecorateEvents()',
  "document.querySelectorAll('#overlay .specialIcon')",
  'function gameplayV3EnsureHistoryToggle()',
  "toggle.id='c4HistoryToggle'",
  "card.classList.add('c4HistoryCollapsed')",
  'const renderBeforeGameplayV3=render',
  'const showEventBeforeGameplayV3=showEvent'
])assert.ok(js.includes(token),`Gameplay v3 JS missing ${token}`);

for(const token of [
  '.c4DropRail{',
  'grid-template-columns:repeat(8,minmax(0,1fr))',
  '.gameplayV3 .board{',
  '.gameplayV3 .c4DiscIcon{',
  '.gameplayV3 .panel.human .choice.c4PrimaryPiece{',
  'var(--blue-piece)',
  '.gameplayV3 .panel.human .choice.c4UtilityPiece{',
  'grid-template-columns:minmax(0,1fr) 248px',
  '.gameplayV3 #fogRulesCard{display:none}',
  '.c4HistoryCollapsed #fogCombatLog{display:none}',
  '.gameplayV3 #overlay .specialIcon .c4UtilityIcon{',
  'body.reducedMotion .c4DropTarget'
])assert.ok(css.includes(token),`Gameplay v3 CSS missing ${token}`);

// Regression guard: Gameplay v3 must never hijack the proven clash-fighter symbols.
assert.ok(!js.includes("document.querySelectorAll('#overlay .fighter b')"),'Gameplay v3 must not replace clash fighter R/P/S symbols');
assert.ok(!css.includes('.gameplayV3 #overlay .fighter b{'),'Gameplay v3 must not restyle or zero clash fighter symbols');
assert.ok(!css.includes('.gameplayV3 #overlay .fighter b .c4PieceIcon{'),'Gameplay v3 must not inject SVG sizing into clash fighters');

assert.ok(!/--blue-piece\s*:/.test(css),'Gameplay v3 must not assign Player 1 ownership color');
assert.ok(!/--orange-piece\s*:/.test(css),'Gameplay v3 must not assign Player 2 ownership color');
assert.ok(!js.includes('fetch('),'Gameplay v3 presentation layer must not add network dependencies');
assert.ok(!js.includes('RTCPeerConnection'),'Gameplay v3 presentation layer must not alter multiplayer transport');
assert.ok(!js.includes('ROWS=')&&!js.includes('COLS='),'Gameplay v3 must not redefine board geometry');

try{new Function(js)}catch(error){throw new Error(`Gameplay v3 syntax failed: ${error.message}`)}
console.log('PASS Gameplay UI v3.0.18.1: board-first controls preserved; legacy clash fighter symbols protected');
