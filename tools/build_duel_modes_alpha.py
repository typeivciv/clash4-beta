#!/usr/bin/env python3
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
BASE_BUILDER=ROOT/'tools/build_private_duel_alpha.py'
OUT=ROOT/'private-duel-alpha.html'
NEARBY_QR=ROOT/'src/js/19-duel-nearby-qr.js'
VERSION='0.15.1'

runpy.run_path(str(BASE_BUILDER),run_name='__main__')
html=OUT.read_text(encoding='utf-8')
# The base builder stays anchored to the frozen 0.15.0 shell; the Duel Modes wrapper owns
# the current staging identity so one-scan pairing can advance without touching public Arcade.
html=html.replace('Duel Modes Alpha 0.15.0',f'Duel Modes Alpha {VERSION}')
anchor='// AI evaluation and decision policy. Hidden-information rules remain bounded here.'
if html.count(anchor)!=1:
    raise SystemExit(f'Nearby signaling injection: expected one AI boundary, found {html.count(anchor)}')
module=NEARBY_QR.read_text(encoding='utf-8').rstrip()+'\n\n'
if 'function directCreateNearby()' in html:
    raise SystemExit('Nearby signaling module already present; refusing duplicate injection')
html=html.replace(anchor,module+anchor,1)
OUT.write_text(html,encoding='utf-8')
print(f'Built Duel Modes Alpha {VERSION} with one-scan Nearby signaling into {OUT.name}')
