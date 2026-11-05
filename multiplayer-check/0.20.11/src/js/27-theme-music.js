/* Multiplayer Alpha theme + procedural music layer. Presentation only: no rules or transport ownership. */
'use strict';
const THEME_MUSIC_VERSION='0.18.0';
const THEME_STORAGE_KEY='clash4.theme.v1';
const MUSIC_STORAGE_KEY='clash4.music.v1';
const DEFAULT_THEME_ID='neon-forge';
const LEGACY_THEME_IDS={'classic-fog':'neon-forge','neon-mirage':'arcane-prism'};
const CLASH4_THEMES={
  'neon-forge':{id:'neon-forge',name:'Neon Forge',tagline:'Clean · modern · competitive',musicProfile:'tactical'},
  'arcane-prism':{id:'arcane-prism',name:'Arcane Prism',tagline:'Mystery · balance · magic',musicProfile:'arcane'},
  'frost-command':{id:'frost-command',name:'Frost Command',tagline:'Calm · precise · focused',musicProfile:'frost'},
  'ember-siege':{id:'ember-siege',name:'Ember Siege',tagline:'Bold · relentless · dominant',musicProfile:'ember'},
  'verdant-cipher':{id:'verdant-cipher',name:'Verdant Cipher',tagline:'Natural · tactical · unique',musicProfile:'verdant'}
};
let activeThemeId=DEFAULT_THEME_ID;
let musicEnabled=false;
let musicVolume=.32;
let musicTimer=null;
let musicStep=0;
let musicBus=null;

function themeNormalizeId(id){
  const migrated=LEGACY_THEME_IDS[id]||id;
  return CLASH4_THEMES[migrated]?migrated:DEFAULT_THEME_ID
}
function themeStoredId(){
  try{return themeNormalizeId(localStorage.getItem(THEME_STORAGE_KEY)||DEFAULT_THEME_ID)}catch{return DEFAULT_THEME_ID}
}
function themeStoredMusic(){
  try{
    const saved=JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY)||'{}');
    return{enabled:saved.enabled===true,volume:Number.isFinite(Number(saved.volume))?Math.max(0,Math.min(1,Number(saved.volume))):.32}
  }catch{return{enabled:false,volume:.32}}
}
function themeSave(){try{localStorage.setItem(THEME_STORAGE_KEY,activeThemeId)}catch{}}
function themeSaveMusic(){try{localStorage.setItem(MUSIC_STORAGE_KEY,JSON.stringify({enabled:musicEnabled,volume:musicVolume}))}catch{}}
function themeCurrent(){return CLASH4_THEMES[activeThemeId]||CLASH4_THEMES[DEFAULT_THEME_ID]}
function themePlayerColorSummary(){
  const mine=humanColor?.label||'Blue',theirs=aiColor?.label||'Orange';
  return `${mine} vs ${theirs}`
}

const syncMatchSetupControlsBeforeThemeMusic=syncMatchSetupControls;
syncMatchSetupControls=function(){
  const result=syncMatchSetupControlsBeforeThemeMusic();
  if(colorMode==='default'&&matchColorHint)matchColorHint.textContent=`${themePlayerColorSummary()} · theme does not change player colors`;
  themeSyncUi();
  return result
};

/* Player ownership colors are intentionally independent from the world theme. */
const applyColorsBeforeThemeMusic=applyColors;
applyColors=function(){
  const result=applyColorsBeforeThemeMusic();
  themeSyncUi();
  return result
};

function themeSyncUi(){
  document.documentElement.dataset.theme=activeThemeId;
  document.body.dataset.theme=activeThemeId;
  document.querySelectorAll('.themeCard[data-theme]').forEach(button=>{
    const active=button.dataset.theme===activeThemeId;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active))
  });
  const theme=themeCurrent(),status=document.getElementById('themeChoiceStatus');
  if(status)status.textContent=`${theme.name} · ${theme.tagline}`;
  const homeMeta=document.getElementById('currentThemeMeta');if(homeMeta)homeMeta.textContent=theme.name;
  const playCopy=homePlayButton?.querySelector('small');if(playCopy)playCopy.textContent=`Vs AI · ${theme.name} · ${themePlayerColorSummary()}`;
  const defaultDots=defaultColorsButton?.querySelector('.colorModeDots');
  if(defaultDots){
    defaultDots.style.setProperty('--theme-human',humanColor?.hex||'#2F70E8');
    defaultDots.style.setProperty('--theme-ai',aiColor?.hex||'#DB7522')
  }
  if(colorMode==='default'&&matchColorHint)matchColorHint.textContent=`${themePlayerColorSummary()} · theme does not change player colors`
}
function themeSet(id,{announce=true}={}){
  id=themeNormalizeId(id);
  const changed=activeThemeId!==id;
  activeThemeId=id;
  themeSave();
  themeSyncUi();
  if(typeof s!=='undefined'&&s)render();
  if(changed&&musicEnabled){themeMusicRestart();themeMusicStinger('theme')}
  if(announce&&changed&&typeof msg==='function')msg(`${themeCurrent().name} selected. Your player colors stay unchanged.`)
}

function themeCardMarkup(theme){
  return `<button class="themeCard" data-theme="${theme.id}" type="button" aria-pressed="false"><span class="themePreview themePreview-${theme.id}" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>${theme.name}</strong><small>${theme.tagline}</small></span></button>`
}
function themeCreateUi(){
  if(document.getElementById('themeControl'))return;
  const control=document.createElement('section');
  control.id='themeControl';
  control.className='themeControl';
  control.innerHTML=`<div class="themeControlHead"><span>WORLD THEME</span><small id="themeChoiceStatus"></small></div><div class="themeCards" role="group" aria-label="Choose a visual theme">${Object.values(CLASH4_THEMES).map(themeCardMarkup).join('')}</div><p class="themeNote"><strong>Theme = world.</strong> Player 1 and Player 2 colors stay independent. Every preview uses the same blue/orange sample matchup so you can compare worlds fairly.</p>`;
  matchColorControl.parentNode.insertBefore(control,matchColorControl);
  control.querySelectorAll('.themeCard').forEach(button=>button.addEventListener('click',()=>themeSet(button.dataset.theme)));
  const meta=document.createElement('span');meta.id='currentThemeMeta';
  document.querySelector('#homePanel .homeMeta')?.appendChild(meta)
}

function themeMusicCreateUi(){
  if(document.getElementById('musicToggle'))return;
  const option=document.createElement('div');option.className='accessibilityOption musicOption';
  option.innerHTML='<div><strong>Music</strong><small>Optional adaptive instrumental loop generated on your device. No download or account needed.</small><label class="musicVolumeLabel" for="musicVolume">Volume <input id="musicVolume" type="range" min="0" max="100" step="1" aria-label="Music volume"></label></div><button id="musicToggle" type="button" aria-pressed="false">Off</button>';
  accessibilityHelp.querySelector('.accessibilityOptions')?.appendChild(option);
  const toggle=option.querySelector('#musicToggle'),volume=option.querySelector('#musicVolume');
  volume.value=String(Math.round(musicVolume*100));
  toggle.addEventListener('click',()=>{
    musicEnabled=!musicEnabled;themeSaveMusic();themeMusicSyncUi();
    if(musicEnabled){themeMusicStart();themeMusicStinger('ui')}else themeMusicStop()
  });
  volume.addEventListener('input',()=>{
    musicVolume=Math.max(0,Math.min(1,Number(volume.value)/100));themeSaveMusic();themeMusicSetGain()
  })
}
function themeMusicSyncUi(){
  const toggle=document.getElementById('musicToggle');if(!toggle)return;
  toggle.textContent=musicEnabled?'On':'Off';toggle.setAttribute('aria-pressed',String(musicEnabled));toggle.classList.toggle('active',musicEnabled)
}
function themeMusicSetGain(){
  if(!musicBus||!gameAudioContext)return;
  musicBus.gain.cancelScheduledValues(gameAudioContext.currentTime);
  musicBus.gain.setTargetAtTime(musicEnabled?musicVolume:0,gameAudioContext.currentTime,.08)
}
function themeMusicEnsureBus(context){
  if(musicBus)return musicBus;
  musicBus=context.createGain();musicBus.gain.setValueAtTime(0,context.currentTime);musicBus.connect(context.destination);return musicBus
}
function themeMusicPhase(){
  if(document.hidden)return'silent';
  if(!ready||coinOverlay.classList.contains('show'))return'menu';
  if(s?.winner||s?.draw)return'result';
  if(overlay.classList.contains('show'))return'combat';
  return s?.turn===H?'player':'opponent'
}
function themeMusicProfile(){
  const profiles={
    tactical:{bpm:78,wave:'triangle',notes:[146.83,174.61,220,261.63],bass:[73.42,87.31]},
    arcane:{bpm:92,wave:'sine',notes:[164.81,207.65,246.94,311.13,329.63],bass:[82.41,103.83]},
    frost:{bpm:68,wave:'sine',notes:[130.81,164.81,196,261.63],bass:[65.41,82.41]},
    ember:{bpm:104,wave:'sawtooth',notes:[146.83,196,220,293.66],bass:[73.42,98]},
    verdant:{bpm:84,wave:'triangle',notes:[138.59,174.61,207.65,277.18],bass:[69.3,87.31]}
  };
  return profiles[themeCurrent().musicProfile]||profiles.tactical
}
function themeMusicVoice(context,frequency,duration,gain,wave='sine',delay=0){
  const oscillator=context.createOscillator(),amp=context.createGain(),start=context.currentTime+delay;
  oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);
  amp.gain.setValueAtTime(.0001,start);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.035);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(amp);amp.connect(themeMusicEnsureBus(context));oscillator.start(start);oscillator.stop(start+duration+.03)
}
function themeMusicPulse(){
  if(!musicEnabled||document.hidden)return;
  const context=unlockGameAudio();if(!context||context.state!=='running')return;
  const profile=themeMusicProfile(),phase=themeMusicPhase(),beat=60/profile.bpm;
  if(phase==='silent')return;
  const note=profile.notes[musicStep%profile.notes.length],soft=phase==='menu'?.010:phase==='opponent'?.013:phase==='combat'?.018:.015;
  themeMusicVoice(context,note,Math.min(.55,beat*.75),soft,profile.wave);
  if(musicStep%4===0)themeMusicVoice(context,profile.bass[Math.floor(musicStep/4)%profile.bass.length],Math.min(.85,beat*1.4),soft*.72,'sine');
  musicStep++;
  const multiplier=phase==='result'?1.5:phase==='combat'?.72:1;
  musicTimer=setTimeout(themeMusicPulse,Math.round(beat*1000*multiplier))
}
function themeMusicStart(){
  if(!musicEnabled||document.hidden)return;
  const context=unlockGameAudio();if(!context)return;
  const begin=()=>{if(!musicEnabled||document.hidden)return;themeMusicEnsureBus(context);themeMusicSetGain();clearTimeout(musicTimer);musicTimer=setTimeout(themeMusicPulse,60)};
  if(context.state==='running')begin();else context.resume().then(begin).catch(()=>{})
}
function themeMusicStop(){clearTimeout(musicTimer);musicTimer=null;themeMusicSetGain()}
function themeMusicRestart(){musicStep=0;themeMusicStop();if(musicEnabled)setTimeout(themeMusicStart,120)}
function themeMusicStinger(cue){
  if(!musicEnabled)return;
  const context=unlockGameAudio();if(!context||context.state!=='running')return;
  const profile=themeMusicProfile();
  const root=profile.notes[0],middle=profile.notes[Math.min(2,profile.notes.length-1)],high=profile.notes[profile.notes.length-1];
  const notes=cue==='win'||cue==='clashmate'?[middle,high,high*1.25]:cue==='combat-win'?[middle,high]:cue==='lock'||cue==='fortified'?[root,middle]:cue==='theme'?[root,middle,high]:[middle];
  notes.forEach((note,index)=>themeMusicVoice(context,note,.18,.017,profile.wave,index*.075))
}

const emitFeedbackBeforeThemeMusic=emitFeedback;
emitFeedback=function(cue){emitFeedbackBeforeThemeMusic(cue);if(['combat-win','lock','fortified','critical','clashmate','win'].includes(cue))themeMusicStinger(cue)};

activeThemeId=themeStoredId();
({enabled:musicEnabled,volume:musicVolume}=themeStoredMusic());
themeCreateUi();themeMusicCreateUi();themeSyncUi();themeMusicSyncUi();
document.addEventListener('visibilitychange',()=>{if(document.hidden)themeMusicStop();else if(musicEnabled)themeMusicStart()});
for(const eventName of ['pointerdown','keydown'])document.addEventListener(eventName,()=>{if(musicEnabled)themeMusicStart()},{once:true,capture:true});
