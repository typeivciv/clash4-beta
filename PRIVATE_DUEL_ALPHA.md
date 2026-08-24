# Clash 4 — Private Duel Alpha 0.14.0

The public GitHub Pages beta remains Mobile Beta 0.13.3 / game v0.13.1 AI Tuning while the first real two-player Private Duel client is validated separately.

Private Duel flow:

Home → Private Duel → Create / Join → six-character room code → Waiting Room → both Ready → random starter → authoritative two-player match.

The Node service in `server/duel-server.mjs` owns the full game state and sends viewer-specific Fog-of-War projections. Decoy contact does not reveal an opponent R/P/S identity.

`render.yaml` and `package.json` are included so the backend can be deployed as an HTTPS Render Web Service. The client should not be promoted to the public Pages build until the deployed backend has been tested from two real phones.

Alpha limitations: in-memory rooms, polling transport, no same-room rematch, no explicit disconnect/forfeit flow, and Duel Replay Finish remains disabled pending a privacy-safe synchronized replay record.
