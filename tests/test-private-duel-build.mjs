import assert from 'node:assert/strict';
import fs from 'node:fs';

const publicIndex=fs.readFileSync('index.html','utf8');
const alpha=fs.readFileSync('private-duel-alpha.html','utf8');
const testerAlpha=fs.readFileSync('multiplayer-alpha.html','utf8');

assert.ok(publicIndex.includes('<title>Clash 4 — Mobile Beta 0.13.3</title>'),'public index must remain frozen on 0.13.3');
assert.ok(!publicIndex.includes('id="homeDuelButton"'),'public beta must not expose unfinished Multiplayer Alpha UI');
assert.equal(testerAlpha,alpha,'clean multiplayer-alpha.html tester entry must exactly match canonical Alpha build');

for(const required of [
  'Multiplayer Alpha 0.18.3',
  '<span>Solo Play</span><small>Vs AI · quick match</small>',
  '<span>Multiplayer</span><small>Online · invite a friend · Pass &amp; Play</small>',
  '<span>Customize</span><small>Difficulty · world theme · player colors · tips</small>',
  '<div class="eyebrow">SOLO SETUP</div><h2 class="setupTitle">Customize Match</h2>',
  "beginRandomMatch('Solo Play',{useDefaults:true})",
  'Multiplayer Alpha 0.18.3 · The game remembers actions. You remember identities.',
  '<button id="betaFeedbackButton" class="betaFeedbackButton" type="button">Report Problem</button>',
  'CLASH 4 MULTIPLAYER ALPHA FEEDBACK','Clash 4 Multiplayer Alpha 0.18.3 Feedback',
  'Play With Someone','Create Duel','Hosted Room',
  'RTCPeerConnection',"DIRECT_PEER_JOIN_PARAM='c4peer'",'DIRECT_HOST_INVITE_TTL_MS=5*60_000','function directRetryNearbyConnection()',"copyBtn.textContent='Copy Link'","shareBtn.textContent='Share Link'",'DIRECT_ALPHA_TURN_SERVERS',
  "endText.textContent='YOU WIN'","endText.textContent='TRY AGAIN'","'Invite New Player'","'KOs · P1–P2'",'function passBuildFinishReplay(viewer)','function passRestartMatch()',
  "parentElement?.parentElement?.querySelector?.(':scope > span')",
  "const ALPHA_TESTER_VERSION='0.18.3'","const EASY_LEARNING_STORAGE_KEY='clash4.easyLearning.v1'","const GAMEPLAY_FLOW_VERSION='0.16.8'","const LEARNER_UX_VERSION='0.16.6'",
  "const THEME_MUSIC_VERSION='0.18.0'","const THEME_STORAGE_KEY='clash4.theme.v1'","const MUSIC_STORAGE_KEY='clash4.music.v1'",
  "DEFAULT_THEME_ID='neon-forge'",'Neon Forge','Arcane Prism','Frost Command','Ember Siege','Verdant Cipher',
  "control.id='themeControl'",'id="musicToggle"','id="musicVolume"','function themeSet(','function themeMusicStart()','function themeMusicStinger(cue)',
  'Theme = world.','theme does not change player colors','Every preview uses the same blue/orange sample matchup',
  ':root[data-theme="neon-forge"]{',':root[data-theme="arcane-prism"]{',':root[data-theme="frost-command"]{',':root[data-theme="ember-siege"]{',':root[data-theme="verdant-cipher"]{',
  '.themePreview i:nth-child(2){background:#2f70e8}', '.themePreview i:nth-child(3){background:#db7522}',
  'Keep player ownership visually dominant and consistent in every world.',
  "const GAMEPLAY_V3_VERSION='0.18.1'",'function gameplayV3EnsureDropRail()',"rail.id='c4DropRail'",'function gameplayV3EnhanceInventory()','function gameplayV3DecorateBoard()',"toggle.id='c4HistoryToggle'",
  '.c4DropRail{','.gameplayV3 .panel.human .choice.c4PrimaryPiece{','.gameplayV3 .panel.human .choice.c4UtilityPiece{','grid-template-columns:minmax(0,1fr) 248px','.c4HistoryCollapsed #fogCombatLog{display:none}',
  "const UI_CONSISTENCY_VERSION='0.18.2'",'function uiConsistencyAbandonPendingCoin()','globalThis.returnHomeAndReset=init','.layout-compact.gameplayV3 .gameStage{padding-bottom:6px}',
  "const SCREEN_CONSISTENCY_VERSION='0.18.3'",'function screenConsistencyHelpContext()','screenConsistencyFocusIntro(introScreen)',"target.closest('#betaFeedbackButton')",'.betaFeedbackOverlay{display:none!important}', '.helpFooterActions #helpBack{grid-column:1/-1;width:100%}',
  "const M={rock:['Rock','🪨'],paper:['Paper','📄'],scissors:['Scissors','✂️'],decoy:['Decoy','○']};",
  'atk.innerHTML=`<span class="combatRole">ATTACKER</span><b>${am[1]}</b><small>${am[0]}</small>`',
  'def.innerHTML=`<span class="combatRole">DEFENDER</span><b>${dm[1]}</b><small>${dm[0]}</small>`',
  'const EASY_AI_POST_DROP_MS=850','const LEARNING_AI_POST_DROP_MS=1150','function gameplayFlowAiSettleMs()',"scheduleTimer('aiSettle'",
  'const EASY_CAPTURE_HOLD_MS=950','const LEARNING_CAPTURE_HOLD_MS=1350','function gameplayFlowCaptureHoldMs(e)','function gameplayFlowStageCapture(e)',"card.classList.add('capture-staging')","card.classList.add('capture-resolved')",
  "const LEARNER_PRE_REVEAL_MS=700","const LEARNER_EXPLANATION_MS=10000",'const LEARNER_PACING={combat:4600,combatChain:3800,special:4000,lock:3000}',
  '<span>Learn to Play</span><small>Easy · guided learning · start now</small>',"button.className='homeLearn homeCustomize'",'function learnerQuickStart()',"beginRandomMatch('Learn to Play',{useDefaults:false})",'>Skip</button>',
  '.homeActions .homeLearn.homeCustomize','.learning-awaiting-continue .overlay','.learnerContinueButton','#easyLearningCoach .easyCoachCopy::before','.easy-learning-active .mobileContextTray{display:none!important}',
  '.panel.ai .row>div:first-child{width:100%;justify-content:space-between!important','grid-template-columns:minmax(0,1fr) auto!important','border-top:1px solid rgba(83,102,138,.42)',
  '.panel.ai .aiRemaining .remainingNumber{min-width:auto!important;font-size:18px!important','.panel.ai #aiTurn{display:none!important',
  '.teachingCombatCard.capture-staging .fighter.loser','.teachingCombatCard.capture-resolved .fighter.loser',"content:'CAPTURED'",
  '#aiColorLabel{display:inline-flex!important','function gameplayFlowBoardCenter()','--c4-board-center-x','#board.easyLearningBoardCue',
  'consolidated home menu with Solo Play first.','#homePanel .homeActions>.homeLearn{display:none!important','#homePanel .homeActions>.homePlay{',
  '@media(hover:hover) and (pointer:fine)','button:hover','button:focus-visible','button:active',
  'function startPassPlay()','function duelRouteMove(owner,type,column)','peerjs@1.5.5/dist/peerjs.min.js','bindPrivateDuelUi();'
])assert.ok(alpha.includes(required),`generated Multiplayer Alpha missing: ${required}`);

/* Theme audit: environment styling must never overwrite either player's selected ownership color. */
for(const forbidden of [
  'theme.human.hex','theme.ai.hex','theme.human.label','theme.ai.label','Electric Lime','Ultraviolet',
  'Multiplayer Alpha 0.16.4','Multiplayer Alpha 0.16.6</title>','Multiplayer Alpha 0.16.7</title>','Multiplayer Alpha 0.16.8</title>','Multiplayer Alpha 0.16.9</title>','Multiplayer Alpha 0.17.0',
  'Multiplayer Alpha · 0.17','MOBILE BETA 0.13.3</div><h2 id="betaFeedbackTitle"','CLASH 4 MOBILE BETA FEEDBACK','Clash 4 Mobile Beta Feedback','>Send Feedback</button>',
  '<div class="eyebrow">ARCADE DUEL</div><h2 class="setupTitle">Customize Match</h2>',"beginRandomMatch('Play',{useDefaults:true})",
  'DIRECT_PEER_TIMEOUT_MS=90_000','DIRECT_RETURN_KEY','directShowReturnLinkLanding','/api/direct/signals','id="duelDirectServerInput"',
  "endText.textContent='YOU LOSE'","b.textContent='New Duel'","b.textContent='Play Someone Else'","title.includes('Scan once to join')",'directNearbyRetryPeerId=hostPeerId;directOpenPanel()',
  "easyLearningPulse('#board .cell[data-column][tabindex=\"0\"]",'>Got it</button>','matchmaking',
  "document.querySelectorAll('#overlay .fighter b')",'.gameplayV3 #overlay .fighter b{','.gameplayV3 #overlay .fighter b .c4PieceIcon{'
])assert.ok(!alpha.includes(forbidden),`generated Alpha still contains obsolete/broken path: ${forbidden}`);

/* Gameplay v3 must reference ownership variables but never redefine them. */
const gameplayV3Css=fs.readFileSync('src/styles/61-gameplay-v3.css','utf8');
assert.ok(gameplayV3Css.includes('var(--blue-piece)'),'Gameplay v3 must inherit Player 1 color');
assert.ok(!/--blue-piece\s*:/.test(gameplayV3Css),'Gameplay v3 must not assign Player 1 color');
assert.ok(!/--orange-piece\s*:/.test(gameplayV3Css),'Gameplay v3 must not assign Player 2 color');

/* The generated client still has one DOM owner per id and every inline script parses. */
const ids=[...alpha.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicates=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
assert.deepEqual(duplicates,[],`duplicate DOM ids: ${duplicates.join(', ')}`);
const scripts=[...alpha.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.ok(scripts.length>=4,'expected dependencies plus generated application script');
for(let i=0;i<scripts.length;i++){if(!scripts[i].trim())continue;try{new Function(scripts[i])}catch(error){throw new Error(`generated script ${i+1} failed syntax: ${error.message}`)}}
console.log(`PASS generated Multiplayer Alpha 0.18.3 screen-consistency package (${ids.length} unique DOM ids, ${scripts.length} script blocks; clash symbols preserved)`);