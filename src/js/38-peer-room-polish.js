'use strict';
const PEER_ROOM_POLISH_VERSION='0.20.2';
const PEER_ROOM_POLISH_COLOR_STORAGE='clash4.peerRoomColors.v1';

if(!peerRoom.matchColors)peerRoom.matchColors={1:'blue',2:'orange'};
const peerRoomPolishState={previewPending:null};
globalThis.peerRoomPolishState=peerRoomPolishState;

function peerRoomPolishColorIds(){return new Set((globalThis.COLOR_PRESETS||[]).map(p=>p.id))}
function peerRoomPolishColorPreset(id){
  if(typeof duelColorPreset==='function')return duelColorPreset(id);
  return(globalThis.COLOR_PRESETS||[]).find(p=>p.id===id)||(globalThis.COLOR_PRESETS||[])[0]||{id:'blue',label:'Blue',hex:'#2F70E8'}
}
function peerRoomPolishNormalizeColors(value=peerRoom.matchColors){
  const ids=peerRoomPolishColorIds(),source=value||{};
  let one=ids.has(source[1])?source[1]:'blue',two=ids.has(source[2])?source[2]:'orange';
  if(one===two)two=one==='orange'?'blue':'orange';
  peerRoom.matchColors={1:one,2:two};return peerRoom.matchColors
}
function peerRoomPolishColorsConflict(){const c=peerRoomPolishNormalizeColors();return c[1]===c[2]}
function peerRoomPolishSaveColors(){
  if(peerRoom.role!=='host'||!peerRoom.roomId)return;
  try{localStorage.setItem(PEER_ROOM_POLISH_COLOR_STORAGE,JSON.stringify({roomId:peerRoom.roomId,hostId:peerRoom.hostId,colors:{...peerRoomPolishNormalizeColors()}}))}catch{}
}
function peerRoomPolishLoadColors(){
  if(peerRoom.role!=='host'||!peerRoom.roomId)return;
  try{const data=JSON.parse(localStorage.getItem(PEER_ROOM_POLISH_COLOR_STORAGE)||'null');if(data?.roomId===peerRoom.roomId&&data?.hostId===peerRoom.hostId)peerRoomPolishNormalizeColors(data.colors)}catch{}
}
function peerRoomPolishResetColors(){peerRoom.matchColors={1:'blue',2:'orange'};peerRoomPolishSaveColors()}
function peerRoomPolishApplyGameColors(){
  if(peerRoomMatch?.phase!=='active')return;
  const colors=peerRoomPolishNormalizeColors(),seat=Number(peerRoom.seat||1),mineSeat=seat===2?2:1,oppSeat=mineSeat===1?2:1;
  const mine=peerRoomPolishColorPreset(colors[mineSeat]),opp=peerRoomPolishColorPreset(colors[oppSeat]);
  try{humanColor=makeColor(mine.hex,mine.label,mine.id);aiColor=makeColor(opp.hex,opp.label,opp.id);applyColors()}catch{}
}

globalThis.peerRoomPolishApplyGameColors=peerRoomPolishApplyGameColors;

// Add the two player colors to every host-authored room state. Guests therefore receive
// the same seat-color truth on welcome, reconnect, and ordinary room-state broadcasts.
const peerRoomPublicStateBeforePolish=peerRoomPublicState;
peerRoomPublicState=function(){return{...peerRoomPublicStateBeforePolish(),matchColors:{...peerRoomPolishNormalizeColors()}}};
globalThis.peerRoomPublicState=peerRoomPublicState;

const peerRoomApplyPublicStateBeforePolish=peerRoomApplyPublicState;
peerRoomApplyPublicState=function(state){
  if(state?.matchColors)peerRoomPolishNormalizeColors(state.matchColors);
  const out=peerRoomApplyPublicStateBeforePolish(state);peerRoomPolishRenderColors();peerRoomPolishApplyGameColors();return out
};
globalThis.peerRoomApplyPublicState=peerRoomApplyPublicState;

function peerRoomPolishEnsureColorUi(){
  const game=document.getElementById('peerRoomGame');if(!game)return null;
  let panel=document.getElementById('peerRoomMatchColors');if(panel)return panel;
  panel=document.createElement('div');panel.id='peerRoomMatchColors';panel.className='peerRoomMatchColors';
  panel.innerHTML='<div class="peerRoomMatchColorsHead"><div><span>PLAYER COLOR</span><strong id="peerRoomOwnColorLabel">Choose your color</strong></div><div id="peerRoomOpponentColor" class="peerRoomOpponentColor"></div></div><div id="peerRoomColorSwatches" class="peerRoomColorSwatches" role="group" aria-label="Choose your Peer Room player color"></div><small id="peerRoomColorHelp">Player 1 and Player 2 must use different colors.</small>';
  const actions=game.querySelector('.peerRoomGameActions');game.insertBefore(panel,actions||game.lastChild);return panel
}
function peerRoomPolishRenderColors(){
  const panel=peerRoomPolishEnsureColorUi();if(!panel)return;
  const colors=peerRoomPolishNormalizeColors(),seat=Number(peerRoom.seat||0),playing=seat===1||seat===2,active=peerRoomMatch?.phase==='active';
  const own=playing?colors[seat]:null,other=seat===1?colors[2]:colors[1],opp=peerRoomPolishColorPreset(other);
  const ownLabel=document.getElementById('peerRoomOwnColorLabel'),oppEl=document.getElementById('peerRoomOpponentColor'),help=document.getElementById('peerRoomColorHelp'),swatches=document.getElementById('peerRoomColorSwatches');
  if(ownLabel)ownLabel.textContent=playing?`Player ${seat} · ${peerRoomPolishColorPreset(own).label}`:'Match colors';
  if(oppEl)oppEl.innerHTML=playing?`<i style="background:${opp.hex}"></i><span>Opponent · ${opp.label}</span>`:`<span>P1 ${peerRoomPolishColorPreset(colors[1]).label} · P2 ${peerRoomPolishColorPreset(colors[2]).label}</span>`;
  if(swatches){swatches.innerHTML='';for(const preset of globalThis.COLOR_PRESETS||[]){
    const button=document.createElement('button');button.type='button';button.className='peerRoomColorChoice'+(own===preset.id?' selected':'');button.disabled=!playing||active||preset.id===other;button.setAttribute('aria-pressed',String(own===preset.id));button.setAttribute('aria-label',preset.id===other?`${preset.label} is used by your opponent`:`Use ${preset.label}`);button.innerHTML=`<i style="background:${preset.hex}"></i><span>${preset.label}</span>`;button.addEventListener('click',()=>peerRoomPolishChooseColor(preset.id));swatches.append(button)
  }}
  if(help)help.textContent=!playing?'Players 1 and 2 own the match colors.':active?'Colors are locked until the room returns to the lobby.':'Choose any color except the color currently used by your opponent.';
  panel.classList.toggle('spectator',!playing);panel.classList.toggle('locked',active)
}
function peerRoomPolishChooseColor(id){
  const seat=Number(peerRoom.seat||0),ids=peerRoomPolishColorIds();if(![1,2].includes(seat)||peerRoomMatch?.phase==='active'||!ids.has(id))return false;
  const other=seat===1?2:1,colors=peerRoomPolishNormalizeColors();
  if(colors[other]===id){peerRoomStatus(`${peerRoomPolishColorPreset(id).label} is already used by Player ${other}. Choose another color.`,'warn');return false}
  if(peerRoom.role==='host'&&seat===1){peerRoom.matchColors[1]=id;peerRoomPolishSaveColors();peerRoomBroadcastState();peerRoomPolishRenderColors();return true}
  if(peerRoom.role==='guest'&&seat===2&&peerRoom.conn?.open){peerRoom.matchColors[2]=id;peerRoomPolishRenderColors();peerRoomSend(peerRoom.conn,{kind:'room-color-select',protocol:PEER_ROOM_PROTOCOL,color:id});return true}
  return false
}
globalThis.peerRoomPolishChooseColor=peerRoomPolishChooseColor;

const peerRoomHostMessageBeforePolish=peerRoomHostMessage;
peerRoomHostMessage=function(conn,data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-color-select'){
    const seat=Number(conn?.__peerRoomSeat),id=String(data.color||''),ids=peerRoomPolishColorIds(),colors=peerRoomPolishNormalizeColors();
    if(seat!==2||peerRoomMatch?.phase==='active'||!ids.has(id)||colors[1]===id){peerRoomSend(conn,{kind:'room-color-reject',protocol:PEER_ROOM_PROTOCOL,state:peerRoomPublicState()});return}
    peerRoom.matchColors[2]=id;peerRoomPolishSaveColors();peerRoomBroadcastState();peerRoomStatus(`Player 2 selected ${peerRoomPolishColorPreset(id).label}.`,'ok');return
  }
  return peerRoomHostMessageBeforePolish(conn,data)
};
globalThis.peerRoomHostMessage=peerRoomHostMessage;

const peerRoomGuestMessageBeforePolish=peerRoomGuestMessage;
peerRoomGuestMessage=function(data){
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-color-reject'){
    if(data.state?.matchColors)peerRoomPolishNormalizeColors(data.state.matchColors);peerRoomPolishRenderColors();peerRoomStatus('That color is already in use. Choose another.','warn');return
  }
  if(data?.protocol===PEER_ROOM_PROTOCOL&&data?.kind==='room-match-error'){
    try{clearTimer('peerRoomOptimisticDrop')}catch{};dropPresentation=null;peerRoomPolishState.previewPending=null
  }
  return peerRoomGuestMessageBeforePolish(data)
};
globalThis.peerRoomGuestMessage=peerRoomGuestMessage;

const peerRoomMatchStartBeforePolish=peerRoomMatchStart;
peerRoomMatchStart=function(){if(peerRoomPolishColorsConflict()){peerRoomStatus('Player colors must be different before starting.','warn');return}return peerRoomMatchStartBeforePolish()};
globalThis.peerRoomMatchStart=peerRoomMatchStart;

// Player 2 keeps host-authoritative validation, but gets immediate visual acknowledgement.
// The authoritative payload then commits the board without replaying the same drop animation.
const peerRoomMatchMoveBeforePolish=peerRoomMatchMove;
peerRoomMatchMove=function(owner,type,column){
  if(Number(peerRoom.seat)!==2)return peerRoomMatchMoveBeforePolish(owner,type,column);
  if(peerRoomMatch.phase!=='active'||peerRoomMatch.spectator||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  const pending={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion,peerOptimistic:true,previewStartedAt:Date.now()};duelSession.pendingLocal=pending;peerRoomPolishState.previewPending=pending;busy=true;
  dropPresentation={before:pending.before,owner:H,type,column:c,targetRow:dropTargetRow(pending.before,c),moveNumber:(s.moveNumber||0)+1,duration:Math.min(Number(TIMING?.drop)||220,220)};render();try{emitFeedback('drop')}catch{};
  try{clearTimer('peerRoomOptimisticDrop');scheduleTimer('peerRoomOptimisticDrop',()=>{if(duelSession.pendingLocal===pending){dropPresentation=null;render();try{msg('Move sent · waiting for host…')}catch{}}},420)}catch{}
  if(peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-match-move',protocol:PEER_ROOM_PROTOCOL,type,column:c,baseVersion:duelSession.handledVersion});
};
globalThis.peerRoomMatchMove=peerRoomMatchMove;

const duelApplyActiveUpdateBeforePeerPolish=duelApplyActiveUpdate;
duelApplyActiveUpdate=function(payload){
  const pending=duelSession.pendingLocal;
  if(peerRoomMatch?.phase==='active'&&Number(peerRoom.seat)===2&&pending?.peerOptimistic&&payload?.state){
    let last=null;try{last=duelProjectedStateToUi(payload.state)?.lastMove}catch{}
    if(last?.owner===H&&Number(last.column)===Number(pending.column)){
      try{clearTimer('peerRoomOptimisticDrop')}catch{};dropPresentation=null;peerRoomPolishState.previewPending=null;duelSession.pendingLocal=null
    }
  }
  return duelApplyActiveUpdateBeforePeerPolish(payload)
};
globalThis.duelApplyActiveUpdate=duelApplyActiveUpdate;

function peerRoomPolishEnsureLobbyButton(){
  let button=document.getElementById('peerRoomMatchLobbyButton');if(button)return button;
  button=document.createElement('button');button.id='peerRoomMatchLobbyButton';button.className='peerRoomMatchLobbyButton';button.type='button';button.hidden=true;button.textContent='← Lobby';button.setAttribute('aria-label','Return to Peer Room lobby');button.addEventListener('click',()=>peerRoomMatchRequestLobby());
  const actions=document.querySelector('.topActions');(actions||document.body).prepend(button);return button
}
function peerRoomPolishSyncMatchChrome(){
  const button=peerRoomPolishEnsureLobbyButton(),active=peerRoomMatch?.phase==='active'&&document.body.classList.contains('peer-room-match-active');button.hidden=!active;
  if(active){button.textContent=Number(peerRoom.seat)>2?'← Room':'← Lobby';button.title=Number(peerRoom.seat)>2?'Return to room while match keeps playing':'Return this shared match to the connected lobby'}
  peerRoomPolishRenderColors();peerRoomPolishApplyGameColors()
}

const peerRoomMatchEnterPayloadBeforePolish=peerRoomMatchEnterPayload;
peerRoomMatchEnterPayload=function(payload,matchId,seat=peerRoom?.seat){const out=peerRoomMatchEnterPayloadBeforePolish(payload,matchId,seat);peerRoomPolishApplyGameColors();peerRoomPolishSyncMatchChrome();try{render()}catch{};return out};
globalThis.peerRoomMatchEnterPayload=peerRoomMatchEnterPayload;

const peerRoomMatchReturnLocalLobbyBeforePolish=peerRoomMatchReturnLocalLobby;
peerRoomMatchReturnLocalLobby=function(options={}){try{clearTimer('peerRoomOptimisticDrop')}catch{};dropPresentation=null;peerRoomPolishState.previewPending=null;const out=peerRoomMatchReturnLocalLobbyBeforePolish(options);peerRoomPolishSyncMatchChrome();return out};
globalThis.peerRoomMatchReturnLocalLobby=peerRoomMatchReturnLocalLobby;

const peerRoomMatchRenderLobbyBeforePolish=peerRoomMatchRenderLobby;
peerRoomMatchRenderLobby=function(){const out=peerRoomMatchRenderLobbyBeforePolish();peerRoomPolishRenderColors();peerRoomPolishSyncMatchChrome();return out};
globalThis.peerRoomMatchRenderLobby=peerRoomMatchRenderLobby;

const peerRoomCreateHostBeforePolish=peerRoomCreateHost;
peerRoomCreateHost=function(){peerRoom.matchColors={1:'blue',2:'orange'};const out=peerRoomCreateHostBeforePolish();peerRoomPolishRenderColors();return out};
globalThis.peerRoomCreateHost=peerRoomCreateHost;

// Keep the navigation control correct after resize/orientation and delayed dynamic module work.
window.addEventListener('resize',()=>requestAnimationFrame(peerRoomPolishSyncMatchChrome),{passive:true});
peerRoomPolishNormalizeColors();peerRoomPolishLoadColors();peerRoomPolishEnsureLobbyButton();peerRoomPolishRenderColors();peerRoomPolishSyncMatchChrome();

globalThis.peerRoomPolish={version:PEER_ROOM_POLISH_VERSION,applyColors:peerRoomPolishApplyGameColors,renderColors:peerRoomPolishRenderColors,syncChrome:peerRoomPolishSyncMatchChrome};
