// Multiplayer Alpha 0.16.2: independent Direct Duel colors + resilient one-link sharing.
// Each seat owns its own color choice. The exact same preset cannot be locked by both
// players because board ownership must remain visually distinguishable.
'use strict';
let duelSeatColors={human:'blue',ai:'orange'};
const DUEL_COLOR_IDS=new Set(COLOR_PRESETS.map(p=>p.id));

function duelResetSeatColors(){duelSeatColors={human:'blue',ai:'orange'}}
function duelColorPreset(id){return COLOR_PRESETS.find(p=>p.id===id)||COLOR_PRESETS[0]}
function duelLocalSeat(){return directDuel?.seat||duelSession?.seat||H}
function duelRemoteSeat(){return other(duelLocalSeat())}
function duelColorsConflict(){return duelSeatColors[H]===duelSeatColors[A]}
function duelApplySeatColors(){
  const mine=duelColorPreset(duelSeatColors[duelLocalSeat()]),theirs=duelColorPreset(duelSeatColors[duelRemoteSeat()]);
  humanColor=makeColor(mine.hex,mine.label,mine.id);aiColor=makeColor(theirs.hex,theirs.label,theirs.id);applyColors()
}
globalThis.duelApplySeatColors=duelApplySeatColors;

function duelEnsureColorUi(){
  let panel=document.getElementById('duelColorSetup');if(panel)return panel;
  panel=document.createElement('section');panel.id='duelColorSetup';panel.className='duelColorSetup';panel.hidden=true;
  panel.innerHTML=`<div class="duelColorHead"><div><span>YOUR COLOR</span><strong>Choose independently</strong></div><div id="duelOpponentColor" class="duelOpponentColor">Opponent · Orange</div></div><div id="duelColorSwatches" class="duelColorSwatches" role="group" aria-label="Choose your Duel color"></div><p id="duelColorStatus" class="duelColorStatus">Both players choose their own color before Ready.</p>`;
  duelReadyButton.before(panel);return panel
}
function duelRenderColorUi(){
  const panel=duelEnsureColorUi();const eligible=!!directDuel?.active&&!duelSession?.active;panel.hidden=!eligible;if(!eligible)return;
  const mine=duelSeatColors[duelLocalSeat()],theirs=duelSeatColors[duelRemoteSeat()],locked=!!directDuel.ready?.[duelLocalSeat()];
  const swatches=document.getElementById('duelColorSwatches');swatches.innerHTML='';
  for(const p of COLOR_PRESETS){
    const b=document.createElement('button');b.type='button';b.className='duelColorChoice'+(mine===p.id?' selected':'');b.disabled=locked;
    b.setAttribute('aria-pressed',String(mine===p.id));b.setAttribute('aria-label',`Use ${p.label}`);
    b.innerHTML=`<i style="background:${p.hex}"></i><span>${p.label}</span>`;b.addEventListener('click',()=>duelChooseOwnColor(p.id));swatches.appendChild(b)
  }
  const opp=duelColorPreset(theirs),oppEl=document.getElementById('duelOpponentColor');oppEl.innerHTML=`<i style="background:${opp.hex}"></i><span>Opponent · ${opp.label}</span>`;
  const status=document.getElementById('duelColorStatus'),conflict=duelColorsConflict();
  status.textContent=conflict?'Both players selected the same color. One player must choose another before Ready.':locked?'Your color is locked for this match.':'Choose any color; your opponent chooses independently on their device.';
  status.classList.toggle('error',conflict);
  duelReadyButton.disabled=locked||conflict;
  if(!locked)duelReadyButton.textContent="I'm Ready"
}
function duelChooseOwnColor(id){
  if(!directDuel?.active||duelSession?.active||!DUEL_COLOR_IDS.has(id)||directDuel.ready?.[duelLocalSeat()])return;
  duelSeatColors[duelLocalSeat()]=id;duelApplySeatColors();directSend({kind:'color',color:id});duelRenderColorUi()
}

const directOpenPanelBeforeDuelColors=directOpenPanel;
directOpenPanel=function(){duelResetSeatColors();const result=directOpenPanelBeforeDuelColors();const panel=duelEnsureColorUi();panel.hidden=true;return result};
globalThis.directOpenPanel=directOpenPanel;

const directEnterReadyRoomBeforeDuelColors=directEnterReadyRoom;
directEnterReadyRoom=function(){
  const result=directEnterReadyRoomBeforeDuelColors();duelApplySeatColors();duelRenderColorUi();directSend({kind:'color',color:duelSeatColors[duelLocalSeat()]});return result
};

const directHandleMessageBeforeDuelColors=directHandleMessage;
directHandleMessage=function(data){
  if(data?.kind==='color'&&DUEL_COLOR_IDS.has(data.color)&&directDuel?.active&&!duelSession?.active){duelSeatColors[duelRemoteSeat()]=data.color;duelApplySeatColors();duelRenderColorUi();return}
  return directHandleMessageBeforeDuelColors(data)
};

const directDuelReadyBeforeDuelColors=directDuelReady;
directDuelReady=function(){
  if(directDuel?.active){
    if(duelColorsConflict()){duelRenderColorUi();directSetStatus('Choose different player colors before both players press Ready.',{error:true});return}
    directSend({kind:'color',color:duelSeatColors[duelLocalSeat()]})
  }
  const result=directDuelReadyBeforeDuelColors();duelRenderColorUi();return result
};
globalThis.directDuelReady=directDuelReady;

const directTryStartBeforeDuelColors=directTryStart;
directTryStart=function(){
  if(directDuel?.active&&duelColorsConflict()){duelRenderColorUi();return}
  return directTryStartBeforeDuelColors()
};

const duelBeginActiveBeforeDuelColors=duelBeginActive;
duelBeginActive=function(payload){
  const result=duelBeginActiveBeforeDuelColors(payload);
  if(directDuel?.active){duelApplySeatColors();const panel=duelEnsureColorUi();panel.hidden=true;render();queueFit()}
  return result
};

// Nearby QR and remote sharing are the exact same HTTPS invite. Do not key visibility to
// presentation copy: Alpha headings can change without changing the pairing state. If the
// one-scan stage contains a real c4peer invite, Player 1 always gets Copy Link + Share Link.
function duelHasLiveNearbyInvite(){
  const value=String(directEl('duelDirectSignal')?.value||'');
  return directDuel?.pairing==='nearby'&&directPeerSession?.role==='host'&&value.startsWith('http')&&value.includes(`#${DIRECT_PEER_JOIN_PARAM}=`)
}
const directNearbyStageBeforeShareLinks=directNearbyStage;
directNearbyStage=function(options={}){
  const result=directNearbyStageBeforeShareLinks(options);
  const label=directEl('duelDirectSignal')?.closest('.duelSignalLabel'),actions=directEl('duelDirectShare')?.parentElement;
  if(duelHasLiveNearbyInvite()){
    if(label)label.hidden=true;if(actions)actions.hidden=false;
    const copyBtn=directEl('duelDirectCopy'),shareBtn=directEl('duelDirectShare'),copy=directEl('duelDirectStageCopy');
    if(copyBtn)copyBtn.textContent='Copy Link';if(shareBtn)shareBtn.textContent='Share Link';
    if(copy)copy.textContent='Player 2 can scan this QR with the normal Camera app or open the same Clash 4 invite link you send by text, Messages, Discord, email, or another app.'
  }else if(directDuel?.pairing==='nearby'){
    if(actions)actions.hidden=true
  }
  return result
};

duelEnsureColorUi();
