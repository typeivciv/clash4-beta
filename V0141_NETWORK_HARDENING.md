# Clash 4 — Private Duel Alpha 0.14.1 Network Hardening

## Scope

0.14.1 is a targeted multiplayer ordering/reliability pass. It does not change Arcade rules, AI behavior, combat timing, Fog rules, or game balance.

The public GitHub Pages `index.html` remains the Mobile Beta 0.13.3 Arcade build until the Private Duel deployment gate is passed on two real phones.

## Problems found in 0.14.0

### 1. Stale network responses could roll the client backward

The 0.14.0 client ignored a payload only when its server version was exactly equal to the last handled version. A slower polling response with an older version could therefore arrive after a newer move response and be processed as if it were new.

Potential symptoms:
- board briefly rolls back
- previous Last Move/event is counted twice
- pending local presentation is disturbed
- stale lobby state can arrive after the match becomes active

### 2. Remote moves could arrive during an unfinished local combat presentation

The authoritative server advances the turn immediately after resolving a move. A fast opponent can therefore make the next move while the first phone is still showing a 2-second combat reveal or a longer chained-combat sequence.

0.14.0 had no inbound presentation queue, so the newer state could replace the current presentation before it completed.

### 3. A move could be reported as failed after polling had already confirmed it

A POST `/move` request and the regular lobby poll can overlap. If polling receives the authoritative new version first but the POST later rejects because of a transient connection failure, 0.14.0 could display a false failure even though the server had accepted the move.

## 0.14.1 corrections

Canonical client ownership is now committed as `src/js/13-duel-client.js`.

The adapter now:
- treats authoritative versions as strictly monotonic
- ignores older and duplicate active-state payloads
- never lowers the latest observed server version
- defers a newer remote payload while another network move is still being presented
- drains the deferred payload immediately after the current presentation completes
- clears deferred state when a Duel session is reset or a new active match begins
- tracks the base version of a pending local move
- suppresses a false POST failure when a newer authoritative version has already acknowledged that move through polling

## Validation performed

PASS:
- combined Alpha JavaScript syntax check
- stale version cannot roll `handledVersion` backward
- duplicate version is not re-applied
- remote update received while `busy` is queued rather than presented concurrently
- queued remote update is applied after the active presentation finishes
- polling acknowledgement suppresses a later false POST failure
- a genuine POST failure with no authoritative acknowledgement is still surfaced and releases the busy state

## Production state after 0.14.1

### Canonical in repository
- `src/js/10-rules.js` — authoritative game rules
- `src/js/12-duel-projection.js` — viewer-specific Fog projection
- `src/js/13-duel-client.js` — Private Duel transport/session/order handling
- `server/duel-server.mjs` — authoritative room/move service
- `render.yaml` / `package.json` — backend deployment

### Still to canonicalize from the Alpha standalone
- Private Duel lobby markup
- Duel-specific CSS
- Home → Private Duel integration bindings
- Alpha standalone build/generation path

## Next gate

1. Canonicalize the remaining Duel UI/integration pieces.
2. Produce a reproducible Private Duel Alpha client build rather than hand-editing a standalone.
3. Deploy the HTTPS server.
4. Test Create → Join → Ready → full match on two real phones under normal and deliberately uneven latency.
5. Only then consider same-room Rematch, reconnect/disconnect UX, or promotion into the public beta.
