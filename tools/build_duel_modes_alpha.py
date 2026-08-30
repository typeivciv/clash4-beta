#!/usr/bin/env python3
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
BASE_BUILDER=ROOT/'tools/build_private_duel_alpha.py'
OUT=ROOT/'private-duel-alpha.html'
NEARBY_QR=ROOT/'src/js/19-duel-nearby-qr.js'

runpy.run_path(str(BASE_BUILDER),run_name='__main__')
html=OUT.read_text(encoding='utf-8')
anchor='// AI evaluation and decision policy. Hidden-information rules remain bounded here.'
if html.count(anchor)!=1:
    raise SystemExit(f'Nearby QR injection: expected one AI boundary, found {html.count(anchor)}')
module=NEARBY_QR.read_text(encoding='utf-8').rstrip()+'\n\n'
if 'function directNearbyLink(signal)' in html:
    raise SystemExit('Nearby QR module already present; refusing duplicate injection')
html=html.replace(anchor,module+anchor,1)
OUT.write_text(html,encoding='utf-8')
print(f'Injected Nearby QR deep-link UX into {OUT.name}')
