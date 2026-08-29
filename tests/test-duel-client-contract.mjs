import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/js/13-duel-client.js','utf8');
new Function(src);

for(const required of [
  '?since=${duelSession.handledVersion}',
  'if(p.historyGap){duelResyncSnapshot(p);return}',
  'if(Array.isArray(p.updates)&&p.updates.length)',
  'duelSession.deferredPayloads.sort((a,b)=>a.version-b.version)',
  'if(p.version<=duelSession.handledVersion)return',
  'duelSession.handledVersion>pending.baseVersion',
  "if(e.status===404||e.status===401)",
  'Private Duel resynchronized after a longer connection gap.'
])assert.ok(src.includes(required),`missing client ordering contract: ${required}`);

assert.ok(!src.includes('p.version===duelSession.handledVersion'), 'equal-only version guard must not return');
assert.ok(!src.includes('deferredPayload:null'), 'single-slot deferred payload must not return');

console.log('PASS duel client monotonic/order/recovery contract');
