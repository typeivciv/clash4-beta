import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicIndex=fs.readFileSync('index.html','utf8');
const alpha=fs.readFileSync('private-duel-alpha.html','utf8');

assert.ok(publicIndex.includes('<title>Clash 4 — Mobile Beta 0.13.3</title>'),'public index must remain frozen on 0.13.3');
assert.ok(!publicIndex.includes('id="homeDuelButton"'),'public beta must not expose unfinished Duel UI');

for(const required of [
  'Private Duel Alpha 0.14.1',
  'id="homeDuelButton"',
  'id="duelLobbyPanel"',
  'id="opponentEyebrow"',
  'function opponentUiLabel()',
  "if(matchMode==='duel')return duelMove(owner,type,c);",
  '?since=${duelSession.handledVersion}',
  'if(p.historyGap){duelResyncSnapshot(p);return}',
  'bindPrivateDuelUi();',
  "const replayDisabled=duelMode||!finishReplay?.steps?.length||replayPhase!=='idle';"
])assert.ok(alpha.includes(required),`generated Alpha missing: ${required}`);

const ids=[...alpha.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicates,[],`duplicate DOM ids: ${duplicates.join(', ')}`);

const scripts=[...alpha.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>=1,'expected generated script blocks');
for(let i=0;i<scripts.length;i++){
  try{new Function(scripts[i])}
  catch(error){throw new Error(`generated script ${i+1} failed syntax: ${error.message}`)}
}

console.log(`PASS generated Private Duel Alpha build (${ids.length} unique DOM ids, ${scripts.length} script blocks)`);
