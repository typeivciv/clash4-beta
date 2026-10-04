# Mobile-data invite connection failures

Both multiplayer modes use `DIRECT_RTC_CONFIG`. Same-machine browser joins can
select local candidates and do not verify mobile-carrier connectivity.

On October 4, 2026, a forced-relay probe of the deployed 0.20.9 settings produced
zero relay candidates in Chromium and WebKit. Chromium reported TURN allocation
error 400 for the public UDP endpoints and error 701 for the TCP endpoints.
The provider's documented public static-auth alternatives also produced zero
candidates. The reporting iPhone screenshot shows the same 0.20.9 build and
"Negotiation of connection ... failed." PeerJS 1.5.5 emits that message when
`iceConnectionState` becomes `failed`; this is a network-route failure after
signaling, rather than an invite-link parsing error.

## Released-build comparison

The exact released files at 0.20.6 (`5260e69`), 0.20.8 (`68d67e3`), and 0.20.9
(`b45e0ac`) were compared under identical browser conditions. All 12 joins
passed: both multiplayer modes, each version, with WebKit as host and as guest
opposite Chromium. Connections used local/STUN candidates. TURN errors occurred
in older and current builds alike.

The Direct Duel pairing code, invite code, TURN configuration, and direct-chat
code are byte-identical across those three releases. Shared-room foundation code
is byte-identical between 0.20.8 and 0.20.9. Version 0.20.7 changed shared-room
message dispatch and readiness handling; 0.20.8 changed drop timing and Rematch;
0.20.9 changed drop rendering and refreshed cache tokens.

These results do not reproduce two physical phones on mobile data. They do not
establish why previously successful matches now fail, when the public relay
became unavailable, or that purchasing/configuring another provider resolves
the reported failure. The earlier account-signup recommendation was premature.
Keep this work as a draft while the carrier-specific failure remains unexplained.

Comparison evidence:
https://github.com/typeivciv/clash4-beta/actions/runs/37197225545

## Draft configuration support

`multiplayer-network.json` can supply a managed TURN service to both Direct Duel
and shared rooms. Configure either:

- `iceServers`: browser TURN credentials supplied by a provider; or
- `credentialEndpoint`: an HTTPS endpoint returning an ICE-server array or an
  object with `iceServers`. Provider account/API secrets stay on that endpoint's
  server; never put them into this public repository.

The client waits for the configuration before creating a peer. Leaving the setup
cancels the pending startup. The empty default preserves the current configuration
and does **not** repair the failed public relay.

## Release gate

Do not mark the reported mobile-data issue fixed without reproducing the failure
and verifying the corrected path on the affected devices/networks. Independently,
before claiming the draft provides a working managed-relay fallback, configure a
provider and verify both multiplayer modes complete a forced-relay join and
exchange a game move in Chromium and WebKit. The connectivity probe currently
records diagnostics; its successful exit is not evidence that relay allocation
succeeded.

Provider documentation: https://www.metered.ca/tools/openrelay/
The provider currently documents account credentials for its TURN API.
PeerJS source: https://github.com/peers/peerjs/blob/v1.5.5/lib/negotiator.ts
