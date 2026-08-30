#!/usr/bin/env python3
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
BASE_BUILDER=ROOT/'tools/build_private_duel_alpha.py'
OUT=ROOT/'private-duel-alpha.html'
NEARBY_QR=ROOT/'src/js/19-duel-nearby-qr.js'
TURN_ALPHA=ROOT/'src/js/20-duel-turn-alpha.js'
DUEL_COLORS=ROOT/'src/js/21-duel-colors-share.js'
DUEL_POSTMATCH=ROOT/'src/js/22-duel-postmatch.js'
TURN_CSS=ROOT/'src/styles/51-duel-turn-alpha.css'
DUEL_COLORS_CSS=ROOT/'src/styles/52-duel-colors-share.css'
DUEL_POSTMATCH_CSS=ROOT/'src/styles/53-duel-postmatch.css'
VERSION='0.15.12'

runpy.run_path(str(BASE_BUILDER),run_name='__main__')
html=OUT.read_text(encoding='utf-8')
# The base builder stays anchored to the frozen 0.15.0 shell; this wrapper owns the
# current Duel staging identity and normalizes every Alpha-facing version label.
html=html.replace('0.15.0',VERSION)

# Terminal Duel payloads are expected to reveal every identity, but the renderer must
# never crash if an old/stale projected snapshot still contains a null type. Preserve
# ownership/color and render a '?' fallback instead of aborting the entire result screen.
unsafe_icon="(p.owner===H||finalReveal)?M[p.type][1]:'?'"
safe_icon="(p.owner===H||finalReveal)?(M[p.type]?.[1]||'?'):'?'"
if html.count(unsafe_icon)!=1:
    raise SystemExit(f'terminal piece fallback: expected one renderer anchor, found {html.count(unsafe_icon)}')
html=html.replace(unsafe_icon,safe_icon,1)

# PeerJS Cloud brokers only the initial Direct WebRTC connection. The established
# DataConnection carries gameplay. TURN remains a staging fallback for restrictive
# networks; 0.15.12 keeps Player 1's host invite alive across failed guest attempts so
# Player 2 can change networks and retry the same QR/link while its invite window is live.
peerjs='<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"></script>\n'
extra_style='<style>\n'+TURN_CSS.read_text(encoding='utf-8').rstrip()+'\n'+DUEL_COLORS_CSS.read_text(encoding='utf-8').rstrip()+'\n'+DUEL_POSTMATCH_CSS.read_text(encoding='utf-8').rstrip()+'\n</style>\n'
if peerjs not in html:
    if html.count('</head>')!=1:raise SystemExit('PeerJS injection: expected one </head>')
    html=html.replace('</head>',extra_style+peerjs+'</head>',1)

anchor='// AI evaluation and decision policy. Hidden-information rules remain bounded here.'
if html.count(anchor)!=1:
    raise SystemExit(f'Duel extension injection: expected one AI boundary, found {html.count(anchor)}')
nearby=NEARBY_QR.read_text(encoding='utf-8').rstrip()+'\n\n'
turn=TURN_ALPHA.read_text(encoding='utf-8').rstrip()+'\n\n'
colors=DUEL_COLORS.read_text(encoding='utf-8').rstrip()+'\n\n'
postmatch=DUEL_POSTMATCH.read_text(encoding='utf-8').rstrip()+'\n\n'
if 'function directCreateNearby()' in html:
    raise SystemExit('Nearby PeerJS module already present; refusing duplicate injection')
if 'DIRECT_ALPHA_TURN_SERVERS' in html:
    raise SystemExit('Alpha TURN module already present; refusing duplicate injection')
if 'let duelSeatColors=' in html:
    raise SystemExit('Duel color/share module already present; refusing duplicate injection')
if 'duelResultAnimationKey' in html:
    raise SystemExit('Duel post-match module already present; refusing duplicate injection')
html=html.replace(anchor,nearby+turn+colors+postmatch+anchor,1)
OUT.write_text(html,encoding='utf-8')
print(f'Built Duel Modes Alpha {VERSION} with persistent one-scan host invite + guest retry recovery + TURN + colors/share + unified Arcade/Direct post-match into {OUT.name}')