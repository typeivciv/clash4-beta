# Mobile Direct Duel manual QA checklist

1. Start Direct Duel on two mobile devices.
2. Play at least three moves so the match is active.
3. Background Player 2 for 5 seconds; return. Match should remain in place and reconnect without returning to the lobby.
4. Repeat for 20 seconds and 60 seconds.
5. Lock/unlock one device and return.
6. Switch Wi-Fi to cellular while backgrounded, then return.
7. Background the host, then the guest, then restore in opposite order.
8. Send chat messages before interruption; verify temporary recovery does not erase chat history.
9. Trigger a move immediately before backgrounding; after recovery, verify the host snapshot resolves whether the move became canonical without duplicate moves.
10. Finish a match; verify normal result/rematch behavior still works and terminal close is not treated as a recoverable interruption.

Out of scope for 0.18.5: full page refresh, browser process kill, or OS tab eviction that destroys the JavaScript context.
