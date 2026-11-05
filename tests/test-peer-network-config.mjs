import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';
import {createTurnIssuer} from '../server/turn-credentials.mjs';

const secret='test-only-not-a-production-secret-000';
const issuer=createTurnIssuer({TURN_URLS:'turns:relay.example:443',TURN_SHARED_SECRET:secret});
const credential=issuer();
assert.equal(credential.iceServers[0].credential,createHmac('sha1',secret).update(credential.iceServers[0].username).digest('base64'));
assert.equal(Number(credential.iceServers[0].username.split(':')[0])*1000,credential.expiresAt);
assert.notEqual(credential.iceServers[0].username,issuer().iceServers[0].username);
assert.equal(createTurnIssuer({}),null);
assert.throws(()=>createTurnIssuer({TURN_URLS:'stun:relay.example:443',TURN_SHARED_SECRET:secret}),/Configure TURN_URLS/);

let now=1000000,calls=0,fail=false;
const legacy=[{urls:['stun:stun.example']},{urls:'turn:legacy.example',username:'legacy',credential:'legacy'}];
const c=vm.createContext({
  AbortController,setTimeout,clearTimeout,URL,Date:{now:()=>now},
  location:{hostname:'typeivciv.github.io'},
  DIRECT_RTC_CONFIG:{iceServers:legacy.slice()},
  fetch:async url=>{
    calls++;
    if(url==='multiplayer-network.json')return {ok:true,json:async()=>({hostedServer:'https://game.example/',relayCredentialEndpoint:'https://game.example/api/ice'})};
    assert.equal(url,'https://game.example/api/ice');
    return fail?{ok:false}:{ok:true,json:async()=>({...credential,expiresAt:now+600000})}
  }
});
vm.runInContext(fs.readFileSync('src/js/45-peer-network.js','utf8'),c);
await Promise.all([c.c4PreparePeerNetwork(),c.c4PreparePeerNetwork()]);
assert.equal(calls,2,'concurrent joins share one config and credential fetch');
assert.equal((await c.c4PeerNetwork.settings()).hostedServer,'https://game.example');
assert.equal(c.c4PeerNetwork.state.relay,'managed');
assert.equal(c.DIRECT_RTC_CONFIG.iceServers.length,2,'managed credentials replace the public TURN entries, not STUN discovery');
assert.equal(c.DIRECT_RTC_CONFIG.iceServers[1].urls[0],'turns:relay.example:443');
fail=true;now+=310000;await c.c4PreparePeerNetwork();
assert.equal(c.c4PeerNetwork.state.relay,'managed','temporary endpoint failure preserves unexpired credentials');
now+=310000;await c.c4PreparePeerNetwork();
assert.equal(c.c4PeerNetwork.state.relay,'legacy','expired credentials cannot replace the baseline routes');
assert.equal(c.DIRECT_RTC_CONFIG.iceServers[1].urls,'turn:legacy.example');
assert.throws(()=>c.c4NetworkUrl('http://game.example/api/ice'),/Invalid/);
assert.throws(()=>c.c4NetworkUrl('https://secret:secret@game.example/api/ice'),/Invalid/);
console.log('PASS managed relay credentials, refresh/fallback, shared fetch, and hosted URL validation');
