# Clash 4 multiplayer transport roadmap

## Current Alpha paths

- **Direct Duel** — primary path. Two browsers connect over WebRTC. Player 1 acts as match authority. Signaling can use the existing invite/QR flow; gameplay itself stays peer-to-peer.
- **Pass & Play** — two players share one device. No network transport.
- **Hosted Room** — experimental server-authoritative path retained for hidden-state and networking experiments. It is not the preferred long-term default while a dedicated game server is undesirable.

## Preferred future direction: host-as-server WebRTC

For small private multiplayer/co-op rooms, one player's browser can become the authoritative host and every other peer connects to that host over WebRTC.

Responsibilities of the host browser would include:

1. canonical game state and turn validation;
2. Fog/hidden-information projection per connected seat;
3. reconnect/session metadata while the host remains online;
4. fan-out of moves, chat, reactions, lobby state, and spectator-safe projections;
5. migration/host-loss handling only if the product later needs it.

The host should expose **transport adapters**, not rules. The rules engine remains transport-agnostic.

## Signaling options to keep available

1. **Manual QR/share signaling** — no persistent backend, best privacy/cost profile, but cumbersome for rooms larger than two players.
2. **Tiny serverless rendezvous/signaling service** — exchanges short-lived WebRTC offers/answers only. It does not hold canonical match state.
3. **Managed realtime signaling** — Firebase/Supabase/other provider for discovery and presence while gameplay remains WebRTC.
4. **Dedicated authoritative server** — future option if public matchmaking, rankings, stronger anti-cheat, durable reconnection, moderation, or large spectator counts justify it.

## Social layer

Chat/reactions should remain separate from the game rules and state machine:

`Chat UI -> Social API -> active transport`

Initial adapter:

`Social API -> Direct Duel WebRTC DataChannel`

Future adapter:

`Social API -> host-as-server WebRTC room`

This allows chat to fail, mute, or disconnect without mutating board state, Fog state, combat resolution, or turn authority.

## Direct Chat v1 boundary

Direct Chat v1 is deliberately ephemeral:

- text and quick reactions only;
- max 200 characters per message;
- last 50 messages kept in memory;
- no database or browser persistence;
- basic send-rate limits;
- plain-text rendering only;
- clears when the Direct Duel closes or a rematch starts;
- never changes rules, move messages, or Fog projections.
