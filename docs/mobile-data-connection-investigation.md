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

Do not mark the mobile-data issue fixed, or release this as a connection fix,
until a working provider is configured and both multiplayer modes complete a
forced-relay join and exchange a game move in Chromium and WebKit. The browser
probe currently records diagnostics; its successful exit is not evidence that
relay allocation succeeded.

Provider documentation: https://www.metered.ca/tools/openrelay/
The provider currently documents account credentials for its TURN API.
PeerJS source: https://github.com/peers/peerjs/blob/v1.5.5/lib/negotiator.ts
