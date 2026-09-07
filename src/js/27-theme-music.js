/* Multiplayer Alpha theme + procedural music layer. Presentation only: no rules or transport ownership. */
const THEME_MUSIC_VERSION='0.17.0';
const THEME_STORAGE_KEY='clash4.theme.v1';
const MUSIC_STORAGE_KEY='clash4.music.v1';
const CLASH4_THEMES={
  'classic-fog':{
    id:'classic-fog',name:'Classic Fog',tagline:'Dark tactical',musicProfile:'tactical',
    human:{id:'blue',label:'Blue',hex:'#2F70E8'},ai:{id:'orange',label:'Orange',hex:'#DB7522'}
  },
  'neon-mirage':{
    id:'neon-mirage',name:'Neon Mirage',tagline:'Psychedelic',musicProfile:'psychedelic',
    human:{id:'neon-lime',label:'Electric Lime',hex:'#A7FF3F'},ai:{id:'ultraviolet',label:'Ultraviolet',hex:'#9A5CFF'}
  }
};
let activeThemeId='classic-fog';
let musicEnabled=false;
let musicVolume=.32;
let musicTimer=null;
let musicStep=0;
let musicBus=null;

function themeStoredId(){
  try{let id=localStorage.getItem(THEME_STORAGE_KEY);return CLASH4_THEMES[id]?id:'classic-fog'}catch{return'classic-fog'}
}
function themeStoredMusic(){
  try{
    let saved=JSON.parse(localStorage.getItem(MUSIC_STORAGE_KEY)||'{}');
    return{enabled:saved.enabled===true,volume:Number.isFinite(Number(saved.volume))?Math.max(0,Math.min(1,Number(saved.volume))):.32}
  }catch{return{enabled:false,volume:.32}}
}
function themeSave(){try{localStorage.setItem(THEME_STORAGE_KEY,activeThemeId)}catch{}}
function themeSaveMusic(){try{localStorage.setItem(MUSIC_STORAGE_KEY,JSON.stringify({enabled:musicEnabled,volume:musicVolume}))}catch{}}
function themeCurrent(){return CLASH4_THEMES[activeThemeId]||CLASH4_THEMES['classic-fog']}
function themeDefaultColors(){
  let theme=themeCurrent();
  return{human:makeColor(theme.human.hex,theme.human.label,theme.human.id),ai:makeColor(theme.ai.hex,theme.ai.label,theme.ai.id)}
}

const syncMatchSetupControlsBeforeThemeMusic=syncMatchSetupControls;
syncMatchSetupControls=function(){
  syncMatchSetupControlsBeforeThemeMusic();
  if(colorMode==='default'){
    let theme=themeCurrent();
    matchColorHint.textContent=startMethod==='random'?`${theme.human.label} vs ${theme.ai.label} · fastest start`:`${theme.human.label} vs ${theme.ai.label} · coin decides first move`
  }
};

const applyColorsBeforeThemeMusic=applyColors;
applyColors=function(){
  if(colorMode==='default'){
    let colors=themeDefaultColors();humanColor=colors.human;aiColor=colors.ai
  }
  applyColorsBeforeThemeMusic()
};

function themeSyncUi(){
  document.documentElement.dataset.theme=activeThemeId;
  document.body.dataset.theme=activeThemeId;
  document.querySelectorAll('.themeCard[data-theme]').forEach(button=>{
    let active=button.dataset.theme===activeThemeId;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))
  });
  let theme=themeCurrent(),status=document.getElementById('themeChoiceStatus');
  if(status)status.textContent=`${theme.name} · ${theme.tagline}`;
  let homeMeta=document.getElementById('currentThemeMeta');if(homeMeta)homeMeta.textContent=theme.name;
  let playCopy=homePlayButton?.querySelector('small');if(playCopy)playCopy.textContent=`Normal · ${theme.name} · Random start`;
  let defaultDots=defaultColorsButton?.querySelector('.colorModeDots');
  if(defaultDots){
    defaultDots.style.setProperty('--theme-human',theme.human.hex);
    defaultDots.style.setProperty('--theme-ai',theme.ai.hex)
  }
  if(colorMode==='default'){
    matchColorHint.textContent=startMethod==='random'?`${theme.human.label} vs ${theme.ai.label} · fastest start`:`${theme.human.label} vs ${theme.ai.label} · coin decides first move`
  }
}
function themeSet(id,{announce=true}={}){
  if(!CLASH4_THEMES[id])id='classic-fog';
  let changed=activeThemeId!==id;activeThemeId=id;themeSave();themeSyncUi();
  if(colorMode==='default'){let colors=themeDefaultColors();humanColor=colors.human;aiColor=colors.ai;applyColorsBeforeThemeMusic()}
  if(typeof s!=='undefined'&&s)render();
  if(changed&&musicEnabled){themeMusicRestart();themeMusicStinger('theme')}
  if(announce&&changed&&typeof msg==='function')msg(`${themeCurrent().name} theme selected. Rules and hidden information are unchanged.`)
}

function themeCreateUi(){
  if(document.getElementById('themeControl'))return;
  let control=document.createElement('section');control.id='themeControl';control.className='themeControl';
  control.innerHTML='<div class="themeControlHead"><span>Visual Theme</span><small id="themeChoiceStatus">Classic Fog · Dark tactical</small></div><div class="themeCards" role="group" aria-label="Choose a visual theme"><button class="themeCard" data-theme="classic-fog" type="button" aria-pressed="true"><span class="themePreview themePreviewClassic" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>Classic Fog</strong><small>Dark tactical · blue + orange</small></span></button><button class="themeCard" data-theme="neon-mirage" type="button" aria-pressed="false"><span class="themePreview themePreviewMirage" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>Neon Mirage</strong><small>Psychedelic · lime + ultraviolet</small></span></button></div><p class="themeNote">Appearance and music profile only. Every rule, piece, and hidden identity works exactly the same.</p>';
  matchColorControl.parentNode.insertBefore(control,matchColorControl);
  control.querySelectorAll('.themeCard').forEach(button=>button.addEventListener('click',()=>themeSet(button.dataset.theme)));
  let meta=document.createElement('span');meta.id='currentThemeMeta';
  document.querySelector('#homePanel .homeMeta')?.appendChild(meta);
}

function themeMusicCreateUi(){
  if(document.getElementById('musicToggle'))return;
  let option=document.createElement('div');option.className='accessibilityOption musicOption';
  option.innerHTML='<div><strong>Music</strong><small>Optional adaptive instrumental loop generated on your device. No download or account needed.</small><label class="musicVolumeLabel" for="musicVolume">Volume <input id="musicVolume" type="range" min="0" max="100" step="1" aria-label="Music volume"></label></div><button id="musicToggle" type="button" aria-pressed="false">Off</button>';
  accessibilityHelp.querySelector('.accessibilityOptions')?.appendChild(option);
  let toggle=option.querySelector('#musicToggle'),volume=option.querySelector('#musicVolume');
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
  let toggle=document.getElementById('musicToggle');if(!toggle)return;
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
  return themeCurrent().musicProfile==='psychedelic'
    ?{bpm:92,wave:'sine',notes:[164.81,207.65,246.94,311.13,329.63],bass:[82.41,103.83]}
    :{bpm:76,wave:'triangle',notes:[146.83,174.61,220,261.63],bass:[73.42,87.31]}
}
function themeMusicVoice(context,frequency,duration,gain,wave='sine',delay=0){
  let oscillator=context.createOscillator(),amp=context.createGain(),start=context.currentTime+delay;
  oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,start);
  amp.gain.setValueAtTime(.0001,start);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.035);amp.gain.exponentialRampToValueAtTime(.0001,start+duration);
  oscillator.connect(amp);amp.connect(themeMusicEnsureBus(context));oscillator.start(start);oscillator.stop(start+duration+.03)
}
function themeMusicPulse(){
  if(!musicEnabled||document.hidden)return;
  let context=unlockGameAudio();if(!context||context.state!=='running')return;
  let profile=themeMusicProfile(),phase=themeMusicPhase(),beat=60/profile.bpm;
  if(phase==='silent')return;
  let note=profile.notes[musicStep%profile.notes.length],soft=phase==='menu'?.011:phase==='opponent'?.014:phase==='combat'?.019:.016;
  themeMusicVoice(context,note,Math.min(.55,beat*.75),soft,profile.wave);
  if(musicStep%4===0)themeMusicVoice(context,profile.bass[Math.floor(musicStep/4)%profile.bass.length],Math.min(.85,beat*1.4),soft*.72,'sine');
  musicStep++;
  let multiplier=phase==='result'?1.5:phase==='combat'?.72:1;
  musicTimer=setTimeout(themeMusicPulse,Math.round(beat*1000*multiplier))
}
function themeMusicStart(){
  if(!musicEnabled||document.hidden)return;
  let context=unlockGameAudio();if(!context)return;
  let begin=()=>{if(!musicEnabled||document.hidden)return;themeMusicEnsureBus(context);themeMusicSetGain();clearTimeout(musicTimer);musicTimer=setTimeout(themeMusicPulse,60)};
  if(context.state==='running')begin();else context.resume().then(begin).catch(()=>{})
}
function themeMusicStop(){clearTimeout(musicTimer);musicTimer=null;themeMusicSetGain()}
function themeMusicRestart(){musicStep=0;themeMusicStop();if(musicEnabled)setTimeout(themeMusicStart,120)}
function themeMusicStinger(cue){
  if(!musicEnabled)return;
  let context=unlockGameAudio();if(!context||context.state!=='running')return;
  let psychedelic=themeCurrent().musicProfile==='psychedelic';
  let notes=cue==='win'||cue==='clashmate'?(psychedelic?[329.63,415.3,493.88]:[293.66,349.23,440])
    :cue==='combat-win'?(psychedelic?[246.94,329.63]:[220,293.66])
    :cue==='lock'||cue==='fortified'?(psychedelic?[207.65,311.13]:[174.61,261.63])
    :cue==='theme'?(psychedelic?[164.81,246.94,329.63]:[146.83,220,293.66]):[220];
  notes.forEach((note,index)=>themeMusicVoice(context,note,.18,.018,psychedelic?'sine':'triangle',index*.075))
}

const emitFeedbackBeforeThemeMusic=emitFeedback;
emitFeedback=function(cue){emitFeedbackBeforeThemeMusic(cue);if(['combat-win','lock','fortified','critical','clashmate','win'].includes(cue))themeMusicStinger(cue)};

activeThemeId=themeStoredId();
({enabled:musicEnabled,volume:musicVolume}=themeStoredMusic());
themeCreateUi();themeMusicCreateUi();themeSyncUi();themeMusicSyncUi();
document.addEventListener('visibilitychange',()=>{if(document.hidden)themeMusicStop();else if(musicEnabled)themeMusicStart()});
for(const eventName of ['pointerdown','keydown'])document.addEventListener(eventName,()=>{if(musicEnabled)themeMusicStart()},{once:true,capture:true});
