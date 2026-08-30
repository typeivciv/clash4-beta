#!/usr/bin/env python3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'index.html'
OUT=ROOT/'private-duel-alpha.html'
CSS=ROOT/'src/styles/50-private-duel.css'
LOBBY=ROOT/'src/ui/private-duel-lobby.html'
CLIENT=ROOT/'src/js/13-duel-client.js'
LOCAL_CORE=ROOT/'src/js/15-duel-local-core.js'
DIRECT=ROOT/'src/js/16-duel-direct-webrtc.js'
PASS_PLAY=ROOT/'src/js/17-duel-pass-play.js'
ROUTER=ROOT/'src/js/18-duel-router.js'
BINDINGS=ROOT/'src/js/14-duel-bindings.js'
VERSION='0.15.0'

html=BASE.read_text(encoding='utf-8')

def replace_once(old,new,label):
    global html
    count=html.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected exactly one anchor, found {count}')
    html=html.replace(old,new,1)

def insert_before(anchor,payload,label):
    replace_once(anchor,payload+anchor,label)

# Build identity. The public index remains unchanged; only the generated Alpha gets these labels.
replace_once('<title>Clash 4 — Mobile Beta 0.13.3</title>',f'<title>Clash 4 — Fog of War · Duel Modes Alpha {VERSION}</title>','title')
replace_once('<div class="fogBuild">Mobile Beta 0.13.3 · AI Tuning</div>',f'<div class="fogBuild">Arcade RC1 · Duel Modes Alpha {VERSION}</div>','header build label')
replace_once('<div class="homeMeta"><span>Mobile Beta · 0.13.3</span>',f'<div class="homeMeta"><span>Duel Modes Alpha · {VERSION}</span>','home build label')
replace_once("const BUILD='Mobile Beta 0.13.3';",f"const BUILD='Duel Modes Alpha {VERSION}';",'feedback build label')
replace_once("return `[Beta 0.13.3][${type}] ${detail||'Tester report'}`;",f"return `[Duel Modes {VERSION}][${{type}}] ${{detail||'Tester report'}}`;",'feedback issue title')

# Duel-specific visual layer remains isolated from the Arcade stylesheet.
duel_css=CSS.read_text(encoding='utf-8').rstrip()+'\n\n'
insert_before('</style>\n</head>',duel_css,'Duel CSS')

# QR generation + QR camera decoding are static browser libraries only. They do not host,
# signal, relay, or observe the Direct Duel match. Copy/paste signaling remains the fallback.
qr_libs='''<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>\n'''
insert_before('</head>',qr_libs,'QR browser libraries')

# The opponent heading needs a stable DOM hook when AI is replaced by another player.
replace_once('<div><div class="eyebrow">ARCADE AI</div><strong id="aiColorLabel">Orange</strong></div>',
             '<div><div id="opponentEyebrow" class="eyebrow">ARCADE AI</div><strong id="aiColorLabel">Orange</strong></div>',
             'opponent heading hook')

# Duel entry stays beside Play but does not replace the default Arcade action.
play_to_customize='<button id="homePlayButton" class="homePlay" type="button"><span>Play</span><small>Normal · Default colors · Random start</small></button><button id="homeCustomizeButton"'
duel_button='<button id="homePlayButton" class="homePlay" type="button"><span>Play</span><small>Normal · Default colors · Random start</small></button><button id="homeDuelButton" class="homeDuel" type="button"><span>Duel</span><small>Direct P2P · Pass &amp; Play · Online Room · Alpha</small></button><button id="homeCustomizeButton"'
replace_once(play_to_customize,duel_button,'Home Duel button')

lobby=LOBBY.read_text(encoding='utf-8').rstrip()+'\n\n  '
insert_before('<section id="matchSetupPanel"',lobby,'Duel hub markup')

# Explicit DOM contract additions used by the server client and common match shell.
# Direct/Pass sub-panels intentionally query their own isolated DOM by id.
duel_string_ids="""  'homeDuelButton',
  'duelLobbyPanel',
  'duelBackButton',
  'duelCreateButton',
  'duelJoinModeButton',
  'duelJoinForm',
  'duelCodeInput',
  'duelJoinButton',
  'duelJoinCancel',
  'duelServerNotice',
  'duelServerInput',
  'duelSaveServerButton',
  'duelConnectionBadge',
  'duelEntryPanel',
  'duelEntryStatus',
  'duelWaitingPanel',
  'duelLobbyStatus',
  'duelLobbyCode',
  'duelCopyCode',
  'duelSeatLabel',
  'duelYouReady',
  'duelOpponentReady',
  'duelReadyButton',
  'duelLeaveButton',
  'duelWaitingCopy',
  'opponentEyebrow',
"""
replace_once("  'homePlayButton',\n  'homeCustomizeButton',", "  'homePlayButton',\n"+duel_string_ids+"  'homeCustomizeButton',", 'Duel collectDom IDs')

duel_names="""  homeDuelButton,
  duelLobbyPanel,
  duelBackButton,
  duelCreateButton,
  duelJoinModeButton,
  duelJoinForm,
  duelCodeInput,
  duelJoinButton,
  duelJoinCancel,
  duelServerNotice,
  duelServerInput,
  duelSaveServerButton,
  duelConnectionBadge,
  duelEntryPanel,
  duelEntryStatus,
  duelWaitingPanel,
  duelLobbyStatus,
  duelLobbyCode,
  duelCopyCode,
  duelSeatLabel,
  duelYouReady,
  duelOpponentReady,
  duelReadyButton,
  duelLeaveButton,
  duelWaitingCopy,
  opponentEyebrow,
"""
replace_once('  homePlayButton,\n  homeCustomizeButton,','  homePlayButton,\n'+duel_names+'  homeCustomizeButton,','Duel DOM destructuring')

# Mode seam and shared labels. Arcade remains the default.
old_mode="""let matchMode='arcade';
let localOwner=H;
function setMatchControllerMode(mode,{owner=H}={}){
  matchMode=mode==='duel'?'duel':'arcade';
  localOwner=owner===A?A:H
}
"""
new_mode="""let matchMode='arcade';
let localOwner=H;
function opponentUiLabel(){return matchMode==='duel'?'Opponent':'AI'}
function opponentPossessive(){return matchMode==='duel'?"opponent's":"AI's"}
function matchModeLabel(){return matchMode==='duel'?'Duel':'Arcade'}
function setMatchControllerMode(mode,{owner=H}={}){
  matchMode=mode==='duel'?'duel':'arcade';
  localOwner=owner===A?A:H;
  appRoot.classList.toggle('duel-mode',matchMode==='duel');
  opponentEyebrow.textContent=matchMode==='duel'?'OPPONENT':'ARCADE AI'
}
"""
replace_once(old_mode,new_mode,'match controller mode helpers')

replace_once('playerLegendLabel.textContent=`${humanColor.label} = Player column`;aiLegendLabel.textContent=`${aiColor.label} = AI column`',
             'playerLegendLabel.textContent=`${humanColor.label} = You`;aiLegendLabel.textContent=`${aiColor.label} = ${opponentUiLabel()}`',
             'ownership labels')

old_intro="""function setIntroScreen(next){
  introScreen=['home','setup','coin'].includes(next)?next:'home';
  homePanel.classList.toggle('active',introScreen==='home');
  matchSetupPanel.classList.toggle('active',introScreen==='setup');
  coinTossPanel.classList.toggle('active',introScreen==='coin');
  if(introScreen==='coin'){setVisible(coinMainPanel,true);setVisible(colorChoicePanel,false);setVisible(coinWaitingTopline,true);setVisible(introHelpBar,true)}
  if(introScreen==='setup')syncMatchSetupControls();
  queueFit()
}
"""
new_intro="""function setIntroScreen(next){
  introScreen=['home','setup','coin','duel'].includes(next)?next:'home';
  homePanel.classList.toggle('active',introScreen==='home');
  duelLobbyPanel.classList.toggle('active',introScreen==='duel');
  matchSetupPanel.classList.toggle('active',introScreen==='setup');
  coinTossPanel.classList.toggle('active',introScreen==='coin');
  if(introScreen==='coin'){setVisible(coinMainPanel,true);setVisible(colorChoicePanel,false);setVisible(coinWaitingTopline,true);setVisible(introHelpBar,true)}
  if(introScreen==='setup')syncMatchSetupControls();
  queueFit()
}
"""
replace_once(old_intro,new_intro,'intro Duel route')
replace_once('function init(){\n  setMatchControllerMode(\'arcade\',{owner:H});',"function init(){\n  globalThis.duelStopPolling?.();\n  setMatchControllerMode('arcade',{owner:H});",'init Duel cleanup')
replace_once("function rematch(){beginRandomMatch('Rematch',{useDefaults:false})}","function rematch(){if(matchMode==='duel'){globalThis.duelRouteNewDuel?.();return}beginRandomMatch('Rematch',{useDefaults:false})}",'Duel New Duel action')
replace_once("function move(owner,type,c){\n  if(!ready||busy", "function move(owner,type,c){\n  if(matchMode==='duel')return duelRouteMove(owner,type,c);\n  if(!ready||busy", 'Duel transport move dispatch')

# All Duel transports share one rules/projection contract and one match UI.
duel_js='\n'.join([
  CLIENT.read_text(encoding='utf-8').rstrip(),
  LOCAL_CORE.read_text(encoding='utf-8').rstrip(),
  DIRECT.read_text(encoding='utf-8').rstrip(),
  PASS_PLAY.read_text(encoding='utf-8').rstrip(),
  ROUTER.read_text(encoding='utf-8').rstrip(),
  BINDINGS.read_text(encoding='utf-8').rstrip(),
])+'\n\n'
insert_before('// AI evaluation and decision policy. Hidden-information rules remain bounded here.',duel_js,'Duel transport modules')

# Duel-aware presentation text and controls.
replace_once('if(s.turn===A)return"TIP — Watch the opponent\'s color marker. The AI must play the move it previews.";',
             'if(s.turn===A)return matchMode===\'duel\'?"TIP — Your opponent\'s piece types stay hidden unless a legitimate clash reveals them.":"TIP — Watch the opponent\'s color marker. The AI must play the move it previews.";',
             'guided opponent tip')
replace_once("${e.player===H?'You':'AI'}", "${e.player===H?'You':opponentUiLabel()}", 'combat history opponent label')
replace_once("s.winner===H?'You connected four':'AI connected four'", "s.winner===H?'You connected four':`${opponentUiLabel()} connected four`", 'mobile terminal opponent label')
replace_once("else if(s.turn===A){icon='?';kicker='AI TURN';title=aiIntentCol!==null?`Committed to Column ${aiIntentCol+1}`:'Choosing a move';copy=aiIntentCol!==null?'The highlighted column is locked in.':'The AI is evaluating only public information.'}",
             "else if(s.turn===A){icon='?';kicker=matchMode==='duel'?'OPPONENT TURN':'AI TURN';title=aiIntentCol!==null?`Committed to Column ${aiIntentCol+1}`:'Choosing a move';copy=matchMode==='duel'?\"Waiting for the opponent's move.\":aiIntentCol!==null?'The highlighted column is locked in.':'The AI is evaluating only public information.'}",
             'mobile remote-turn copy')
replace_once('function renderMatchHud({reviewMode,legal}){\n  renderHumanInv();renderCombatHistory();',
             "function renderMatchHud({reviewMode,legal}){\n  renderHumanInv();renderCombatHistory();\n  opponentEyebrow.textContent=matchMode==='duel'?'OPPONENT':'ARCADE AI';\n  setVisible(matchDifficultyBadge,matchMode!=='duel');",
             'Duel HUD heading')
replace_once("s.turn===H?'Your turn':'AI turn';", "s.turn===H?'Your turn':matchMode==='duel'?'Opponent turn':'AI turn';", 'HUD remote turn')
replace_once('fogAiName.textContent=`${aiColor.label} · AI`;', 'fogAiName.textContent=`${aiColor.label} · ${opponentUiLabel()}`;', 'HUD opponent identity')
replace_once("fogDifficulty.textContent=aiDifficulty==='easy'?'Easy':aiDifficulty==='normal'?'Normal':aiDifficulty==='hard'?'Hard':'Strategist';",
             "fogDifficulty.textContent=matchMode==='duel'?'Duel':aiDifficulty==='easy'?'Easy':aiDifficulty==='normal'?'Normal':aiDifficulty==='hard'?'Hard':'Strategist';",
             'HUD mode label')
replace_once("(aiIntentCol!==null?`Current: AI → C${aiIntentCol+1}`:'Current: AI thinking')",
             "(matchMode==='duel'?'Current: Opponent turn':aiIntentCol!==null?`Current: AI → C${aiIntentCol+1}`:'Current: AI thinking')",
             'current move remote label')

replace_once("endText.textContent=s.draw?'Draw':s.winReason==='clashmate'?(s.winner===H?'CLASHMATE — you forced the win!':'CLASHMATE — the AI forced the win.'):s.winner===H?'You connected four!':'Arcade AI connected four.';",
             "endText.textContent=s.draw?'Draw':s.winReason==='clashmate'?(s.winner===H?'CLASHMATE — you forced the win!':`CLASHMATE — ${opponentUiLabel()} forced the win.`):s.winner===H?'You connected four!':matchMode==='duel'?'Opponent connected four.':'Arcade AI connected four.';",
             'postmatch opponent result')
replace_once("endReason.textContent=s.draw?'No Connect Four before the board filled.':s.winReason==='clashmate'?'Finished by Clashmate — the next Connect Four was unavoidable.':s.winner===H?'Winning four secured.':'AI secured the winning four.';",
             "endReason.textContent=s.draw?'No Connect Four before the board filled.':s.winReason==='clashmate'?'Finished by Clashmate — the next Connect Four was unavoidable.':s.winner===H?'Winning four secured.':`${opponentUiLabel()} secured the winning four.`;",
             'postmatch opponent reason')
replace_once("  const replayDisabled=!finishReplay?.steps?.length||replayPhase!=='idle';",
             "  const duelMode=matchMode==='duel';\n  for(const b of [restartBottom,reviewRestart,sidebarRematch])b.textContent=duelMode?'New Duel':'Rematch';\n  const replayDisabled=duelMode||!finishReplay?.steps?.length||replayPhase!=='idle';",
             'Duel postmatch replay/rematch policy')
replace_once("  }else msg(aiIntentCol!==null?`AI targeting Column ${aiIntentCol+1}…`:'Arcade AI is choosing…')",
             "  }else msg(matchMode==='duel'?\"Waiting for opponent…\":aiIntentCol!==null?`AI targeting Column ${aiIntentCol+1}…`:'Arcade AI is choosing…')",
             'remote turn guidance')
replace_once("    x==='Arcade AI is choosing…'||\n    x.startsWith('AI targeting Column ')",
             "    x==='Arcade AI is choosing…'||\n    x==='Waiting for opponent…'||\n    x.startsWith('AI targeting Column ')",
             'remote routine message')

# Wire the Duel hub after existing app controls are available.
replace_once("homePlayButton.addEventListener('click',()=>beginRandomMatch('Play',{useDefaults:true}));",
             "homePlayButton.addEventListener('click',()=>beginRandomMatch('Play',{useDefaults:true}));\nduelSession.server=initialDuelServer();\nbindPrivateDuelUi();",
             'Duel UI bootstrap')
replace_once("restartTop.addEventListener('click',init);", "restartTop.addEventListener('click',()=>{if(matchMode==='duel')duelLeaveAllToHome();else init()});", 'top Home Duel exit')
replace_once("homeBottom.addEventListener('click',init);", "homeBottom.addEventListener('click',()=>{if(matchMode==='duel')duelLeaveAllToHome();else init()});", 'summary Home Duel exit')
replace_once("reviewHome.addEventListener('click',init);", "reviewHome.addEventListener('click',()=>{if(matchMode==='duel')duelLeaveAllToHome();else init()});", 'review Home Duel exit')
replace_once("sidebarHome.addEventListener('click',init);", "sidebarHome.addEventListener('click',()=>{if(matchMode==='duel')duelLeaveAllToHome();else init()});", 'sidebar Home Duel exit')

OUT.write_text(html,encoding='utf-8')
print(f'Built {OUT.name} ({len(html)} chars) from frozen public index + canonical Duel modules')
