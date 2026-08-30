# Clash 4 — Duel Modes Alpha 0.15.0

The public GitHub Pages beta remains Mobile Beta 0.13.3 / game v0.13.1 AI Tuning. Duel development is built and published separately so multiplayer work cannot destabilize the public Arcade entry point.

## Staging client

Duel Modes Alpha 0.15.0:

`https://typeivciv.github.io/clash4-beta/private-duel-alpha.html`

The staging client is generated reproducibly from the frozen public `index.html` plus canonical Duel source modules. GitHub Actions validates syntax, DOM uniqueness, server update-history recovery, local authority/Fog parity, Direct/Pass transport contracts, and the generated client before publishing.

## Duel modes

### Direct Duel — WebRTC peer-to-peer

Direct Duel does not use the Clash 4 game server. After pairing, moves travel through an ordered/reliable WebRTC DataChannel directly between the two browsers.

Two pairing experiences use the same transport:

- **Nearby:** Player 1 creates an offer QR. Player 2 scans it and shows a return QR. Player 1 scans the return QR to complete the manual WebRTC handshake.
- **Long Distance:** Player 1 shares/copies the offer through Messages, Discord, email, or another app. Player 2 opens it, creates a response, and sends that response back. Player 1 pastes the response to connect.

Public STUN is used for peer discovery/NAT traversal. There is currently no TURN relay. Some restrictive carrier, corporate, VPN, or firewall configurations can therefore block Direct Duel; **Online Room** remains the reliability fallback.

Direct Duel deliberately has no Clash 4 signaling server. The two-way QR/share exchange is the signaling channel.

#### Direct Duel trust model

0.15.0 uses Player 1's browser as the authoritative Direct Duel host. The normal UI receives viewer-specific Fog projections, including Decoy-contact privacy, but the host browser necessarily contains the canonical match state in memory. Direct Duel is therefore intended for trusted/casual opponents during Alpha. A technically sophisticated host could inspect local browser memory/devtools.

**Online Room** provides stronger hidden-state enforcement because neither player's browser owns the authoritative full state. A future cheat-resistant P2P protocol would require a cryptographic hidden-state/commitment design and is outside the 0.15.0 scope.

### Pass & Play — one device

Pass & Play is completely offline and uses the same canonical rules engine locally. The device shows an opaque privacy wall between every turn:

Player turn → move/combat presentation → hide board → pass device → next player confirms identity → render that player's Fog projection.

Viewer-relative combat/move presentation history is cleared at handoff so one player's `You` / `Opponent` presentation cannot be inherited by the next viewer. The completed match reveals the final board normally.

### Online Room — server-authoritative fallback

The existing 0.14.1 server mode remains available inside the Duel hub:

Create / Join → six-character room code → Waiting Room → both Ready → random starter → authoritative two-player match.

`server/duel-server.mjs` owns full game state and sends viewer-specific Fog projections. Ordered missed-update recovery remains active through bounded server version history and `?since=<version>` polling. A client that falls behind retained history performs an explicit state resync rather than replaying incomplete events.

## Shared architecture

All three modes reuse the same rules and Fog contracts instead of maintaining separate game implementations:

- `src/js/10-rules.js` — canonical move/combat/Connect Four rules
- `src/js/12-duel-projection.js` — viewer-specific hidden-information projection
- `src/js/13-duel-client.js` — Online Room HTTP/session/order transport
- `src/js/15-duel-local-core.js` — local authoritative adapter for non-server modes
- `src/js/16-duel-direct-webrtc.js` — WebRTC/manual-signaling transport
- `src/js/17-duel-pass-play.js` — one-device privacy handoff transport
- `src/js/18-duel-router.js` — common match-controller transport seam
- `src/js/14-duel-bindings.js` — Duel UI bindings

## Online Room backend

The repository still includes `render.yaml` and `package.json` for deploying the optional Online Room backend as an HTTPS Render Web Service. Direct Duel and Pass & Play do not depend on that backend.

## 0.15.0 real-device promotion gate

Do **not** replace the public Pages `index.html` until the following pass on real devices:

### Direct Duel — nearby

- Phone A creates a Nearby Direct Duel and displays an offer QR.
- Phone B scans the offer QR and displays a return QR.
- Phone A scans the return QR without destroying its original peer connection.
- WebRTC DataChannel reports connected on both phones.
- Both Ready states synchronize and both devices agree on the random starter.
- normal move, normal R/P/S combat, chained combat, cooldown/Fortified behavior, Clashmate where reachable, and Decoy contact stay synchronized.
- hidden opponent R/P/S types remain absent from the rendered opposing view.
- final board reveal is correct.
- disconnecting a phone produces a clear Direct Duel interruption state.

### Direct Duel — long distance

- share/copy offer → remote paste → share/copy response → host paste establishes the same Direct Duel connection.
- remote pairing copy correctly says **send response back**, not nearby QR instructions.
- failed P2P connection leaves Online Room available as fallback.

### Pass & Play

- random starter receives the device first.
- opaque handoff completely covers the prior board/inventory.
- each player sees their own inventory and only their own Fog projection.
- viewer-relative move/combat history does not cross the handoff boundary.
- full match and final reveal work without network access.

### Regression

- Online Room's existing ordering/recovery behavior still passes.
- leaving any Duel mode returns cleanly to the Duel hub/Home.
- Arcade public behavior is unchanged.
- no horizontal overflow or unusable controls at phone widths.

## Current limitations

- Direct Duel has no TURN relay, so some networks cannot establish P2P.
- Direct Duel is host-authoritative and intended for trusted opponents during Alpha.
- Manual serverless signaling requires a two-way offer/answer exchange.
- QR rendering/scanning uses browser-side helper libraries; Copy/Share/Paste is the fallback.
- Online Room rooms are in memory and disappear on backend restart.
- Online Room still polls rather than using WebSockets.
- no same-session rematch yet.
- no formal reconnect/forfeit state machine yet.
- Duel Replay Finish remains disabled pending a privacy-safe synchronized replay design.
