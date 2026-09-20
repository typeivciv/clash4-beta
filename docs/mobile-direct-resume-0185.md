# Mobile Direct Duel resume — 0.18.5

## Problem
On mobile browsers, backgrounding Clash 4 can suspend WebRTC long enough for the Direct Duel DataChannel to close. The existing one-scan flow intentionally disconnected PeerJS signaling after the match opened, so the surviving in-memory match could not introduce the two browsers again.

## Recovery contract
- The host remains the authoritative match owner.
- WebRTC remains the gameplay/chat transport.
- PeerJS is used only as a rendezvous/signaling path when the P2P transport must be rebuilt.
- No gameplay state is moved to a backend.
- Returning from background, pageshow, network-online, or focus triggers a health ping.
- A missed pong starts transport recovery instead of abandoning the match.
- The guest reconnects to the same host peer id.
- The host sends a fresh viewer-projected snapshot after transport recovery so missed moves are caught up without revealing Fog-hidden state.
- An uncommitted guest move is cleared if the host snapshot proves it never became canonical.
- Chat history is preserved across a temporary mobile transport interruption and is still cleared on actual leave/rematch.

## Scope
This patch covers a suspended/backgrounded page whose JavaScript context remains alive. A full page reload, browser process kill, or OS eviction still destroys the in-memory host authority and requires a later persisted-session/handoff design.
