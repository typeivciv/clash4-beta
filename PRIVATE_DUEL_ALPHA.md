# Clash 4 — Duel Modes Alpha 0.15.1

The public GitHub Pages beta remains Mobile Beta 0.13.3 / game v0.13.1 AI Tuning. Duel development is built and published separately so multiplayer work cannot destabilize the public Arcade entry point.

## Staging client

Duel Modes Alpha 0.15.1:

`https://typeivciv.github.io/clash4-beta/private-duel-alpha.html`

The staging client is generated reproducibly from the frozen public `index.html` plus canonical Duel modules. GitHub Actions validates syntax, Online Room update-history recovery, one-scan signaling isolation, local authority/Fog parity, Direct/Pass transport contracts, DOM uniqueness, and the generated client before publishing.

## Duel modes

### Direct Duel — WebRTC peer-to-peer gameplay

After pairing, moves travel through an ordered/reliable WebRTC DataChannel directly between the two browsers. The Direct match itself does not use the HTTP server for moves or game state.

#### Nearby — one-scan QR pairing

0.15.1 replaces the old offer-QR → return-QR flow with a short-lived signaling handshake:

1. Player 1 taps **Nearby · One Scan**.
2. Player 1 creates the WebRTC offer and uploads only that offer to a temporary signaling slot.
3. Clash 4 displays a QR containing an HTTPS Clash 4 join link plus a short-lived join credential.
4. Player 2 scans the QR with the phone's normal Camera app and taps the Clash 4 link.
5. Player 2's Clash 4 page downloads the offer, creates the WebRTC answer, and posts only that answer back to the same temporary slot.
6. Player 1 polls the slot for the answer and applies it automatically.
7. The WebRTC DataChannel opens and both players enter the normal Direct Duel Ready screen.
8. Match traffic is peer-to-peer from that point forward.

There is **no second QR scan, no raw SDP shown to the player, and no manual copy/paste step for Nearby Duel**.

The signaling slot expires after three minutes by default. It stores only an SDP offer, an SDP answer, random host/join tokens, and timestamps. It has no board, pieces, inventory, turns, Fog state, combat events, or move endpoint. `server/direct-signal-store.mjs` is intentionally isolated from the rules/projection modules.

Player 1 must have the Duel backend URL configured once because that service supplies the temporary pairing slot. The QR carries the service location to Player 2, so Player 2 does not configure a server URL.

#### Long Distance

Long Distance Direct Duel retains manual share/copy signaling in 0.15.1: Player 1 sends an invite, Player 2 returns the response, and Player 1 accepts it. It uses the same WebRTC DataChannel after connection.

Public STUN is used for peer discovery/NAT traversal. There is currently no TURN relay, so some restrictive carrier, corporate, VPN, or firewall configurations can block Direct Duel. **Online Room** remains the reliability fallback.

#### Direct Duel trust model

Player 1's browser is authoritative for Direct Duel. The normal UI receives viewer-specific Fog projections, including Decoy-contact privacy, but the host browser necessarily contains canonical match state in memory. Direct Duel is therefore intended for trusted/casual opponents during Alpha.

**Online Room** provides stronger hidden-state enforcement because neither player's browser owns the authoritative full state.

### Pass & Play — one device

Pass & Play is completely offline and uses the same canonical rules engine locally. An opaque privacy wall covers the board between turns. Viewer-relative move/combat history is cleared at handoff so one player's `You` / `Opponent` presentation cannot leak into the next player's view.

### Online Room — server-authoritative fallback

The existing hardened server mode remains available inside the Duel hub:

Create / Join → six-character room code → Waiting Room → both Ready → random starter → authoritative two-player match.

`server/duel-server.mjs` owns Online Room game state and sends viewer-specific Fog projections. Ordered missed-update recovery remains active through bounded version history and `?since=<version>` polling.

## Shared architecture

- `src/js/10-rules.js` — canonical move/combat/Connect Four rules
- `src/js/12-duel-projection.js` — viewer-specific hidden-information projection
- `src/js/13-duel-client.js` — Online Room HTTP/session/order transport
- `src/js/15-duel-local-core.js` — local authoritative adapter for non-server match modes
- `src/js/16-duel-direct-webrtc.js` — WebRTC DataChannel/manual long-distance transport
- `src/js/17-duel-pass-play.js` — one-device privacy handoff transport
- `src/js/18-duel-router.js` — common match-controller transport seam
- `src/js/19-duel-nearby-qr.js` — one-scan Nearby signaling/deep-link UX
- `server/direct-signal-store.mjs` — short-lived, state-blind WebRTC offer/answer store
- `server/duel-server.mjs` — HTTP host for Online Room plus isolated signaling endpoints

## Backend deployment

The repository includes `render.yaml` and `package.json` for an HTTPS Render Web Service. The same process exposes two logically separate capabilities:

- Online Room game endpoints under `/api/lobbies/...`
- state-blind Direct pairing endpoints under `/api/direct/signals/...`

The signaling endpoints do not call the Clash 4 rules engine and never process moves.

## 0.15.1 real-device promotion gate

Do **not** replace the public Pages `index.html` until these pass on real devices.

### Nearby Direct

- Player 1 creates one QR.
- a normal iPhone/Android Camera app recognizes it as an HTTPS link rather than raw signaling text.
- Player 2 taps the link and enters Clash 4 pairing automatically.
- Player 2 never sees a return QR requirement.
- Player 1 automatically receives the answer without scanning/pasting anything.
- WebRTC DataChannel reports connected on both phones.
- both Ready states synchronize and both devices agree on the random starter.
- normal moves, R/P/S combat, chained combat, cooldown/Fortified behavior, Clashmate where reachable, and Decoy contact stay synchronized.
- hidden opponent R/P/S types remain absent from the opposing rendered view.
- final board reveal is correct.
- disconnecting a phone produces a clear Direct interruption state.

### Regression

- Long Distance Direct still pairs through share/copy response.
- Pass & Play privacy handoff still works offline.
- Online Room ordering/recovery behavior still passes.
- leaving any Duel mode returns cleanly to Duel/Home.
- public Arcade behavior is unchanged.
- no horizontal overflow or unusable controls at phone widths.

## Current limitations

- Nearby one-scan pairing needs the lightweight HTTP signaling service to be deployed/reachable during the initial handshake.
- Direct Duel has no TURN relay, so some networks cannot establish P2P.
- Direct Duel is host-authoritative and intended for trusted opponents during Alpha.
- Long Distance Direct still uses manual offer/answer sharing.
- Online Room rooms are in memory and disappear on backend restart.
- Online Room still polls rather than using WebSockets.
- no same-session rematch yet.
- no formal reconnect/forfeit state machine yet.
- Duel Replay Finish remains disabled pending a privacy-safe synchronized replay design.
