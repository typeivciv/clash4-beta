# Clash 4 — Private Duel Alpha 0.14.1

The public GitHub Pages beta remains Mobile Beta 0.13.3 / game v0.13.1 AI Tuning. Private Duel is now built and published separately so multiplayer testing cannot destabilize the public Arcade entry point.

## Staging client

Private Duel Alpha 0.14.1:

`https://typeivciv.github.io/clash4-beta/private-duel-alpha.html`

The staging client is generated reproducibly from the frozen public `index.html` plus canonical Duel source modules. GitHub Actions validates syntax, DOM uniqueness, client ordering contracts, server update-history recovery, and Fog projection before publishing the staging artifact.

Private Duel flow:

Home → Private Duel → Create / Join → six-character room code → Waiting Room → both Ready → random starter → authoritative two-player match.

The Node service in `server/duel-server.mjs` owns the full game state and sends viewer-specific Fog-of-War projections. Decoy contact does not reveal an opponent R/P/S identity.

0.14.1 also adds ordered missed-update recovery: the server keeps a bounded recent version history and clients request updates since their last handled version. This prevents a lost move response followed by a fast opponent move from silently skipping the first move's presentation/events. A client that falls farther behind than the retained history performs an explicit state resync instead of replaying incomplete history.

## Deploy the Alpha backend

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftypeivciv%2Fclash4-beta)

The repository already includes `render.yaml` and `package.json`, so the backend can be deployed as an HTTPS Render Web Service without adding runtime npm dependencies.

After deployment:

1. Wait for the Render service to report healthy.
2. Open `<your-render-service-url>/api/health` and confirm it returns an `ok: true` response.
3. Copy the HTTPS service URL only, without `/api/health`.
4. Open the 0.14.1 staging client on both phones.
5. Paste the service URL into **Multiplayer server** and press **Save** on each phone.
6. Phone A: **Create Lobby** and share the six-character code.
7. Phone B: **Join Lobby** with that code.
8. Mark both players **Ready** and confirm the same match starts with opposite local `You` / remote `Opponent` views.
9. Test at least one normal R/P/S clash, one chained combat sequence, and one Decoy contact from both seats.
10. Deliberately background/refresh one phone once to verify session restore and missed-update recovery.

### Render free-tier note

A free Render Web Service can spin down after 15 minutes without inbound traffic. The first request after a spin-down can take roughly a minute while the service wakes. Once the Alpha clients are polling during an active test, those HTTP requests count as inbound traffic and should keep the service awake.

## Promotion gate

Do **not** replace the public Pages `index.html` with Private Duel until all of the following pass on two real phones:

- server health endpoint is reachable over HTTPS
- Create → Join → both Ready works reliably
- random starter agrees on both devices
- local and remote moves stay synchronized
- a lost/delayed response does not roll the board backward or skip recoverable move events
- session restore survives temporary network failure without destroying a valid room token
- opponent hidden R/P/S identities stay hidden outside legitimate combat reveals
- Decoy contact does not leak the opposing R/P/S identity
- final board review reveals both sides correctly after the match
- no horizontal overflow or unusable controls on either phone
- leaving a Duel returns cleanly to Home / Duel entry without contaminating Arcade state

## Alpha limitations

- rooms are in memory and disappear on server restart
- polling transport rather than WebSockets
- no same-room rematch
- no explicit disconnect/forfeit flow
- Duel Replay Finish remains disabled pending a privacy-safe synchronized replay record

These remain deliberate Alpha limitations. Same-room Rematch and reconnect/disconnect UX are the next feature candidates only after the real two-phone network gate passes.
