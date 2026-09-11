import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const rules=fs.readFileSync('src/js/10-rules.js','utf8');
const v3=fs.readFileSync('src/js/28-gameplay-v3.js','utf8');
const v3css=fs.readFileSync('src/styles/61-gameplay-v3.css','utf8');
const flowCss=fs.readFileSync('src/styles/56-gameplay-flow.css','utf8');
const eventCss=fs.readFileSync('src/styles/60-theme-event-states.css','utf8');

// Run the real rules outcome function through the complete R/P/S matrix.
const outcomeSource=rules.match(/function outcome\(a,d\)\{[^\n]+\}/)?.[0];
assert.ok(outcomeSource,'rules outcome() source missing');
const outcome=new Function(`${outcomeSource}; return outcome;`)();
const matrix=[
  ['rock','rock','tie'],['rock','paper','lose'],['rock','scissors','win'],
  ['paper','rock','win'],['paper','paper','tie'],['paper','scissors','lose'],
  ['scissors','rock','lose'],['scissors','paper','win'],['scissors','scissors','tie'],
  ['decoy','rock','tie'],['rock','decoy','tie'],['decoy','decoy','tie']
];
for(const [atk,def,expected] of matrix)assert.equal(outcome(atk,def),expected,`${atk} vs ${def} should be ${expected}`);

// The pre-v3 clash renderer is the visual source of truth for fighter symbols.
assert.ok(index.includes("const M={rock:['Rock','🪨'],paper:['Paper','📄'],scissors:['Scissors','✂️'],decoy:['Decoy','○']};"),'canonical R/P/S/Decoy symbol map changed');
assert.ok(index.includes("const teaching=combatTeaching(e),am=e.atk.type?M[e.atk.type]:['Hidden','?'],dm=e.def.type?M[e.def.type]:['Hidden','?'];"),'clash symbol lookup must preserve visible and Fog-hidden identities');
assert.ok(index.includes('atk.innerHTML=`<span class="combatRole">ATTACKER</span><b>${am[1]}</b><small>${am[0]}</small>`'),'attacker clash symbol renderer changed');
assert.ok(index.includes('def.innerHTML=`<span class="combatRole">DEFENDER</span><b>${dm[1]}</b><small>${dm[0]}</small>`'),'defender clash symbol renderer changed');
assert.ok(index.includes("hint:'🪨 Rock > ✂️ Scissors > 📄 Paper > 🪨 Rock'"),'clash teaching rule compass missing');

// Gameplay v3 may restyle the board and command deck, but may not take over clash fighters.
assert.ok(!v3.includes("document.querySelectorAll('#overlay .fighter b')"),'Gameplay v3 must not replace clash fighter symbols');
assert.ok(!v3css.includes('.gameplayV3 #overlay .fighter b{'),'Gameplay v3 must not override established fighter typography');
assert.ok(!v3css.includes('.gameplayV3 #overlay .fighter b .c4PieceIcon{'),'Gameplay v3 must not inject SVG fighter icons');

// Preserve the visual language the previous patch established: large readable symbols,
// player-color ownership, world-theme framing, and capture staging.
for(const token of [
  '.teachingCombatCard .fighter b{font-size:40px;line-height:46px}',
  '.overlay[data-layout="desktop"] .teachingCombatCard .fighter b',
  '.overlay[data-layout="mobile"] .teachingCombatCard .fighter b'
])assert.ok(flowCss.includes(token)||index.includes(token),`responsive clash symbol sizing missing: ${token}`);
for(const token of [
  '.overlay .teachingCombatCard .fighter.human',
  '.overlay .teachingCombatCard .fighter.ai',
  '.overlay .teachingCombatCard .fighter.human b{color:var(--blue-piece-text,#fff)}',
  '.overlay .teachingCombatCard .fighter.ai b{color:var(--orange-piece-text,#fff)}'
])assert.ok(eventCss.includes(token),`theme clash ownership styling missing: ${token}`);
assert.ok(flowCss.includes('.teachingCombatCard.capture-staging .fighter.winner'),'capture staging regression');
assert.ok(flowCss.includes('.teachingCombatCard.capture-resolved .fighter.loser'),'capture resolution regression');

console.log(`PASS clash presentation regression: ${matrix.length} outcome cases + canonical symbols + responsive/theme/capture contracts`);
