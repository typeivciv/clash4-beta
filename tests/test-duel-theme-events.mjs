import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('src/styles/60-theme-event-states.css','utf8');
const builder=fs.readFileSync('tools/build_duel_modes_alpha.py','utf8');

for(const theme of ['neon-forge','arcane-prism','frost-command','ember-siege','verdant-cipher']){
  assert.ok(css.includes(`:root[data-theme="${theme}"]`),`missing event palette for ${theme}`);
}

for(const token of [
  '.overlay .card.teachingCombatCard',
  '.overlay .card.teachingSpecialCard',
  '.overlay .teachingCombatCard .fighter.human',
  '.overlay .teachingCombatCard .fighter.ai',
  '.end.duel-result-win',
  '.end.duel-result-loss',
  '.end.duel-result-draw',
  '.end.duel-result-win .duelResultCore',
  '.end.duel-result-loss .duelResultCore',
  '.end .duelResultSparks i',
  'body.reducedMotion'
])assert.ok(css.includes(token),`event presentation contract missing ${token}`);

assert.ok(css.includes('var(--blue-piece)'), 'human clash/result ownership must still use Player 1 color');
assert.ok(css.includes('var(--orange-piece)'), 'opponent clash/result ownership must still use Player 2 color');
assert.ok(css.includes('var(--event-accent)'), 'world theme accent must drive event atmosphere');
assert.ok(css.includes('var(--event-glow)'), 'world theme glow must drive event atmosphere');

// World themes must never redefine ownership variables. Those belong to the player-color system.
assert.ok(!/--blue-piece\s*:/.test(css),'event theme layer must not assign --blue-piece');
assert.ok(!/--orange-piece\s*:/.test(css),'event theme layer must not assign --orange-piece');
assert.ok(!/--blue\s*:/.test(css),'event theme layer must not assign --blue');
assert.ok(!/--orange\s*:/.test(css),'event theme layer must not assign --orange');

assert.ok(builder.includes("THEME_EVENT_CSS=ROOT/'src/styles/60-theme-event-states.css'"),'builder must include the event-theme stylesheet');
const musicIndex=builder.indexOf("THEME_MUSIC_CSS.read_text");
const eventIndex=builder.indexOf("THEME_EVENT_CSS.read_text");
assert.ok(musicIndex>=0&&eventIndex>musicIndex,'event-theme CSS must load after the base five-theme layer so it can safely override old result styling');

console.log('PASS theme event states: five world-reactive clash/result palettes with independent player ownership colors');
