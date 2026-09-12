#!/usr/bin/env python3
from pathlib import Path
import runpy

ROOT=Path(__file__).resolve().parents[1]
BASE_BUILDER=ROOT/'tools/build_private_duel_alpha.py'
OUT=ROOT/'private-duel-alpha.html'
TESTER_OUT=ROOT/'multiplayer-alpha.html'
NEARBY_QR=ROOT/'src/js/19-duel-nearby-qr.js'
TURN_ALPHA=ROOT/'src/js/20-duel-turn-alpha.js'
DUEL_COLORS=ROOT/'src/js/21-duel-colors-share.js'
DUEL_POSTMATCH=ROOT/'src/js/22-duel-postmatch.js'
ALPHA_TESTER=ROOT/'src/js/23-duel-alpha-tester.js'
EASY_LEARNING=ROOT/'src/js/24-easy-learning.js'
GAMEPLAY_FLOW=ROOT/'src/js/25-gameplay-flow.js'
LEARNER_UX=ROOT/'src/js/26-learner-ux.js'
THEME_MUSIC=ROOT/'src/js/27-theme-music.js'
GAMEPLAY_V3=ROOT/'src/js/28-gameplay-v3.js'
UI_CONSISTENCY=ROOT/'src/js/29-ui-consistency.js'
SCREEN_CONSISTENCY=ROOT/'src/js/30-screen-consistency.js'
TURN_CSS=ROOT/'src/styles/51-duel-turn-alpha.css'
DUEL_COLORS_CSS=ROOT/'src/styles/52-duel-colors-share.css'
DUEL_POSTMATCH_CSS=ROOT/'src/styles/53-duel-postmatch.css'
ALPHA_TESTER_CSS=ROOT/'src/styles/54-duel-alpha-tester.css'
EASY_LEARNING_CSS=ROOT/'src/styles/55-easy-learning.css'
GAMEPLAY_FLOW_CSS=ROOT/'src/styles/56-gameplay-flow.css'
LEARNER_UX_CSS=ROOT/'src/styles/57-learner-ux.css'
HOME_MENU_CSS=ROOT/'src/styles/58-home-menu-interaction.css'
THEME_MUSIC_CSS=ROOT/'src/styles/59-theme-music.css'
THEME_EVENT_CSS=ROOT/'src/styles/60-theme-event-states.css'
GAMEPLAY_V3_CSS=ROOT/'src/styles/61-gameplay-v3.css'
UI_CONSISTENCY_CSS=ROOT/'src/styles/62-ui-consistency.css'
SCREEN_CONSISTENCY_CSS=ROOT/'src/styles/63-screen-consistency.css'
VERSION='0.18.3'

runpy.run_path(str(BASE_BUILDER),run_name='__main__')
html=OUT.read_text(encoding='utf-8')

def replace_once(old,new,label):
    global html
    count=html.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected one anchor, found {count}')
    html=html.replace(old,new,1)

# The base builder stays anchored to the frozen 0.15.0 shell; this wrapper owns the
# tester-facing Multiplayer Alpha identity. Public index.html remains unchanged.
html=html.replace('0.15.0',VERSION)
html=html.replace(f'Duel Modes Alpha {VERSION}',f'Multiplayer Alpha {VERSION}')
html=html.replace(f'Duel Modes {VERSION}',f'Multiplayer Alpha {VERSION}')

old_home='<button id="homeDuelButton" class="homeDuel" type="button"><span>Duel</span><small>Direct P2P · Pass &amp; Play · Online Room · Alpha</small></button>'
new_home='<button id="homeDuelButton" class="homeDuel" type="button"><span>Multiplayer</span><small>Online · invite a friend · Pass &amp; Play</small></button>'
replace_once(old_home,new_home,'Alpha home Multiplayer button')

old_play='<button id="homePlayButton" class="homePlay" type="button"><span>Play</span><small>Normal · Default colors · Random start</small></button>'
new_play='<button id="homePlayButton" class="homePlay" type="button"><span>Solo Play</span><small>Vs AI · quick match</small></button>'
replace_once(old_play,new_play,'Alpha home Solo Play button')

old_customize='<button id="homeCustomizeButton" class="homeCustomize" type="button"><span>Customize Match</span><small>Difficulty · first move · colors · tips</small></button>'
new_customize='<button id="homeCustomizeButton" class="homeCustomize" type="button"><span>Customize</span><small>Difficulty · world theme · player colors · tips</small></button>'
replace_once(old_customize,new_customize,'Alpha home Customize button')

# Screen-copy sweep: the generated Alpha should never fall back to public-beta naming
# or call the Solo setup a Duel now that Duel means Multiplayer.
replace_once('<div class="eyebrow">ARCADE DUEL</div><h2 class="setupTitle">Customize Match</h2>',
             '<div class="eyebrow">SOLO SETUP</div><h2 class="setupTitle">Customize Match</h2>',
             'Solo setup eyebrow')
replace_once("homePlayButton.addEventListener('click',()=>beginRandomMatch('Play',{useDefaults:true}));",
             "homePlayButton.addEventListener('click',()=>beginRandomMatch('Solo Play',{useDefaults:true}));",
             'Solo quick-match label')
replace_once('Mobile Beta 0.13.3 · The game remembers actions. You remember identities.',
             f'Multiplayer Alpha {VERSION} · The game remembers actions. You remember identities.',
             'Help footer Alpha identity')
replace_once('<button id="betaFeedbackButton" class="betaFeedbackButton" type="button">Send Feedback</button>',
             '<button id="betaFeedbackButton" class="betaFeedbackButton" type="button">Report Problem</button>',
             'Help feedback action')
replace_once('<div><div class="eyebrow">MOBILE BETA 0.13.3</div><h2 id="betaFeedbackTitle">Test Feedback</h2></div>',
             f'<div><div class="eyebrow">MULTIPLAYER ALPHA {VERSION}</div><h2 id="betaFeedbackTitle">Test Feedback</h2></div>',
             'legacy feedback Alpha identity')
replace_once('CLASH 4 MOBILE BETA FEEDBACK','CLASH 4 MULTIPLAYER ALPHA FEEDBACK','legacy feedback report title')
replace_once("title:'Clash 4 Mobile Beta Feedback'",f"title:'Clash 4 Multiplayer Alpha {VERSION} Feedback'",'legacy feedback share title')

# Terminal Duel payloads are expected to reveal every identity, but the renderer must
# never crash if an old/stale projected snapshot still contains a null type.
unsafe_icon="(p.owner===H||finalReveal)?M[p.type][1]:'?'"
safe_icon="(p.owner===H||finalReveal)?(M[p.type]?.[1]||'?'):'?'"
replace_once(unsafe_icon,safe_icon,'terminal piece fallback')

# Apply the saved world theme before paint. Legacy theme ids migrate without changing player colors.
early_theme="""<script>
(function(){try{var t=localStorage.getItem('clash4.theme.v1')||'neon-forge';var map={'classic-fog':'neon-forge','neon-mirage':'arcane-prism'};t=map[t]||t;var valid=['neon-forge','arcane-prism','frost-command','ember-siege','verdant-cipher'];document.documentElement.dataset.theme=valid.includes(t)?t:'neon-forge'}catch(e){document.documentElement.dataset.theme='neon-forge'}})();
</script>
"""
peerjs='<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"></script>\n'
extra_style='<style>\n'+TURN_CSS.read_text(encoding='utf-8').rstrip()+'\n'+DUEL_COLORS_CSS.read_text(encoding='utf-8').rstrip()+'\n'+DUEL_POSTMATCH_CSS.read_text(encoding='utf-8').rstrip()+'\n'+ALPHA_TESTER_CSS.read_text(encoding='utf-8').rstrip()+'\n'+EASY_LEARNING_CSS.read_text(encoding='utf-8').rstrip()+'\n'+GAMEPLAY_FLOW_CSS.read_text(encoding='utf-8').rstrip()+'\n'+LEARNER_UX_CSS.read_text(encoding='utf-8').rstrip()+'\n'+HOME_MENU_CSS.read_text(encoding='utf-8').rstrip()+'\n'+THEME_MUSIC_CSS.read_text(encoding='utf-8').rstrip()+'\n'+THEME_EVENT_CSS.read_text(encoding='utf-8').rstrip()+'\n'+GAMEPLAY_V3_CSS.read_text(encoding='utf-8').rstrip()+'\n'+UI_CONSISTENCY_CSS.read_text(encoding='utf-8').rstrip()+'\n'+SCREEN_CONSISTENCY_CSS.read_text(encoding='utf-8').rstrip()+'\n</style>\n'
if peerjs not in html:
    if html.count('</head>')!=1:raise SystemExit('PeerJS injection: expected one </head>')
    html=html.replace('</head>',early_theme+extra_style+peerjs+'</head>',1)

anchor='// AI evaluation and decision policy. Hidden-information rules remain bounded here.'
if html.count(anchor)!=1:
    raise SystemExit(f'Duel extension injection: expected one AI boundary, found {html.count(anchor)}')
nearby=NEARBY_QR.read_text(encoding='utf-8').rstrip()+'\n\n'
turn=TURN_ALPHA.read_text(encoding='utf-8').rstrip()+'\n\n'
colors=DUEL_COLORS.read_text(encoding='utf-8').rstrip()+'\n\n'
postmatch=DUEL_POSTMATCH.read_text(encoding='utf-8').rstrip()+'\n\n'
tester=ALPHA_TESTER.read_text(encoding='utf-8').rstrip()+'\n\n'
easy=EASY_LEARNING.read_text(encoding='utf-8').rstrip()+'\n\n'
flow=GAMEPLAY_FLOW.read_text(encoding='utf-8').rstrip()+'\n\n'
learner=LEARNER_UX.read_text(encoding='utf-8').rstrip()+'\n\n'
theme_music=THEME_MUSIC.read_text(encoding='utf-8').rstrip()+'\n\n'
gameplay_v3=GAMEPLAY_V3.read_text(encoding='utf-8').rstrip()+'\n\n'
ui_consistency=UI_CONSISTENCY.read_text(encoding='utf-8').rstrip()+'\n\n'
screen_consistency=SCREEN_CONSISTENCY.read_text(encoding='utf-8').rstrip()+'\n\n'
if 'function directCreateNearby()' in html:raise SystemExit('Nearby PeerJS module already present; refusing duplicate injection')
if 'DIRECT_ALPHA_TURN_SERVERS' in html:raise SystemExit('Alpha TURN module already present; refusing duplicate injection')
if 'let duelSeatColors=' in html:raise SystemExit('Duel color/share module already present; refusing duplicate injection')
if 'duelResultAnimationKey' in html:raise SystemExit('Duel post-match module already present; refusing duplicate injection')
if 'ALPHA_TESTER_VERSION' in html:raise SystemExit('Alpha tester module already present; refusing duplicate injection')
if 'EASY_LEARNING_STORAGE_KEY' in html:raise SystemExit('Easy learning module already present; refusing duplicate injection')
if 'GAMEPLAY_FLOW_VERSION' in html:raise SystemExit('Gameplay flow module already present; refusing duplicate injection')
if 'LEARNER_UX_VERSION' in html:raise SystemExit('Learner UX module already present; refusing duplicate injection')
if 'THEME_MUSIC_VERSION' in html:raise SystemExit('Theme/music module already present; refusing duplicate injection')
if 'GAMEPLAY_V3_VERSION' in html:raise SystemExit('Gameplay v3 module already present; refusing duplicate injection')
if 'UI_CONSISTENCY_VERSION' in html:raise SystemExit('UI consistency module already present; refusing duplicate injection')
if 'SCREEN_CONSISTENCY_VERSION' in html:raise SystemExit('screen consistency module already present; refusing duplicate injection')
html=html.replace(anchor,nearby+turn+colors+postmatch+tester+easy+flow+learner+theme_music+gameplay_v3+ui_consistency+screen_consistency+anchor,1)
OUT.write_text(html,encoding='utf-8')
TESTER_OUT.write_text(html,encoding='utf-8')
print(f'Built Multiplayer Alpha {VERSION} with five world themes, world-reactive events, Gameplay UI v3, UI consistency repairs, screen consistency sweep, and procedural music into {OUT.name} and {TESTER_OUT.name}')
