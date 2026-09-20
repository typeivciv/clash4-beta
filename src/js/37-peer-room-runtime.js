'use strict';
const PEER_ROOM_RUNTIME_VERSION='0.20.1';

const peerRoomRuntimeState={chatInitialized:false,knownChatIds:new Set(),inPeerChat:false};
globalThis.peerRoomRuntimeState=peerRoomRuntimeState;

function peerRoomRuntimeSeat(){return Number(globalThis.peerRoom?.seat||0)}
function peerRoomRuntimeOwnsGameplay(){
  const seat=peerRoomRuntimeSeat();
  return !!(globalThis.peerRoomMatch?.phase==='active'&&(seat===1||seat===2)&&['host','guest'].includes(globalThis.peerRoom?.role))
}
function peerRoomRuntimeChatActive(){
  if(globalThis.peerRoomMatch?.phase!=='active'||!['host','guest'].includes(globalThis.peerRoom?.role))return false;
  try{return document.body.classList.contains('peer-room-match-active')}catch{return false}
}
function peerRoomRuntimeTransportReady(){
  if(globalThis.peerRoom?.role==='host')return !!(globalThis.peerRoom?.active&&globalThis.peerRoom?.peer&&!globalThis.peerRoom.peer.destroyed);
  return !!globalThis.peerRoom?.conn?.open
}

// Runtime guard: a Peer Room match must never fall through to the legacy hosted-server
// Duel adapter. 0.20 already routed duelRouteMove; this patch also guards the base move()
// and duelMove() seams so late-bound/mobile event handlers cannot reach duelRequest().
const peerRoomRuntimeMoveBefore=move;
move=function(owner,type,column){
  if(peerRoomRuntimeOwnsGameplay())return peerRoomMatchMove(owner,type,column);
  return peerRoomRuntimeMoveBefore(owner,type,column)
};
globalThis.move=move;

const peerRoomRuntimeDuelRouteMoveBefore=duelRouteMove;
duelRouteMove=function(owner,type,column){
  if(peerRoomRuntimeOwnsGameplay())return peerRoomMatchMove(owner,type,column);
  return peerRoomRuntimeDuelRouteMoveBefore(owner,type,column)
};
globalThis.duelRouteMove=duelRouteMove;

const peerRoomRuntimeDuelMoveBefore=duelMove;
duelMove=async function(owner,type,column){
  if(peerRoomRuntimeOwnsGameplay())return peerRoomMatchMove(owner,type,column);
  return peerRoomRuntimeDuelMoveBefore(owner,type,column)
};
globalThis.duelMove=duelMove;

function peerRoomRuntimeRoomMessages(){
  return(Array.isArray(globalThis.peerRoom?.chat)?globalThis.peerRoom.chat:[]).slice(-DIRECT_CHAT_MAX_MESSAGES).map(message=>({
    id:`room:${String(message.id||'')}`,
    roomMessageId:String(message.id||''),
    text:directChatNormalizeText(message.text),
    mine:Number(message.seat)===peerRoomRuntimeSeat(),
    authorLabel:`Player ${Number(message.seat)||'?'}`,
    receivedAt:Number(message.at)||Date.now()
  })).filter(message=>message.text&&message.roomMessageId)
}
function peerRoomRuntimePrimeUnread(){
  const messages=Array.isArray(globalThis.peerRoom?.chat)?globalThis.peerRoom.chat:[];
  if(!peerRoomRuntimeState.chatInitialized){
    peerRoomRuntimeState.knownChatIds=new Set(messages.map(message=>String(message.id||'')).filter(Boolean));
    peerRoomRuntimeState.chatInitialized=true;return
  }
  for(const message of messages){
    const id=String(message.id||'');if(!id||peerRoomRuntimeState.knownChatIds.has(id))continue;
    peerRoomRuntimeState.knownChatIds.add(id);
    if(Number(message.seat)!==peerRoomRuntimeSeat()&&!directChatState.open&&!directChatState.muted)directChatState.unread++
  }
}
function peerRoomRuntimeSetChatHeader(peerMode){
  const drawer=directChatEl('directChatDrawer'),fab=directChatEl('directChatFab');if(!drawer||!fab)return;
  drawer.classList.toggle('peerRoomChatMode',peerMode);
  const head=drawer.querySelector('.directChatHead'),copy=head?.firstElementChild,eyebrow=copy?.querySelector('span'),title=copy?.querySelector('strong'),small=copy?.querySelector('small');
  if(peerMode){
    if(eyebrow)eyebrow.textContent='PEER ROOM';if(title)title.textContent='Room Chat';
    if(small){small.textContent='';const dot=document.createElement('i');dot.className='directChatStatusDot';dot.setAttribute('aria-hidden','true');small.append(dot,document.createTextNode('Players 1–4 · host relayed'))}
    const label=fab.querySelector('.directChatFabLabel');if(label)label.textContent='Chat';fab.setAttribute('aria-label',directChatState.unread?`Open Peer Room chat, ${directChatState.unread} unread`:'Open Peer Room chat')
  }else{
    if(eyebrow)eyebrow.textContent='DIRECT CHAT';if(title)title.textContent='Chat';
    if(small){small.textContent='';const dot=document.createElement('i');dot.className='directChatStatusDot';dot.setAttribute('aria-hidden','true');small.append(dot,document.createTextNode('Private · Direct Duel'))}
  }
}

// Reuse the polished Universal Chat v2 drawer instead of introducing a second in-game
// chat design. Only its transport/data source changes while a Peer Room match is visible.
const peerRoomRuntimeChatConnectedBefore=directChatConnected;
directChatConnected=function(){
  if(peerRoomRuntimeChatActive())return peerRoomRuntimeTransportReady();
  return peerRoomRuntimeChatConnectedBefore()
};
globalThis.directChatConnected=directChatConnected;

const peerRoomRuntimeChatRenderBefore=directChatRender;
directChatRender=function(){
  const peerMode=peerRoomRuntimeChatActive();
  if(peerMode){
    peerRoomRuntimePrimeUnread();
    const mapped=peerRoomRuntimeRoomMessages();directChatState.messages=mapped;directChatState.seenIds=new Set(mapped.map(message=>message.id));peerRoomRuntimeState.inPeerChat=true
  }else if(peerRoomRuntimeState.inPeerChat){
    directChatState.messages=[];directChatState.seenIds=new Set();directChatState.unread=0;peerRoomRuntimeState.inPeerChat=false
  }
  const out=peerRoomRuntimeChatRenderBefore();peerRoomRuntimeSetChatHeader(peerMode);
  if(peerMode){
    const byId=new Map(directChatState.messages.map(message=>[message.id,message]));
    for(const row of directChatEl('directChatLog')?.querySelectorAll?.('.directChatMessage[data-chat-id]')||[]){const message=byId.get(row.dataset.chatId),who=row.querySelector('.directChatMeta strong');if(message&&who)who.textContent=message.mine?'You':message.authorLabel}
  }
  return out
};
globalThis.directChatRender=directChatRender;

const peerRoomRuntimeChatSendBefore=directChatSendText;
directChatSendText=function(value){
  if(!peerRoomRuntimeChatActive())return peerRoomRuntimeChatSendBefore(value);
  const text=directChatNormalizeText(value);if(!text||!peerRoomRuntimeTransportReady())return false;
  if(!directChatCanSendNow()){try{msg('Chat is moving too fast — wait a moment.')}catch{};return false}
  const id=directChatMakeId();directChatNoteSend();
  if(peerRoom.role==='host')peerRoomHostAppendChat(1,text,id);
  else peerRoomSend(peerRoom.conn,{kind:'room-chat-submit',protocol:PEER_ROOM_PROTOCOL,id,text});
  return true
};
globalThis.directChatSendText=directChatSendText;

const peerRoomRuntimeRenderRoomChatBefore=peerRoomRenderChat;
peerRoomRenderChat=function(){
  const out=peerRoomRuntimeRenderRoomChatBefore();
  if(peerRoomRuntimeChatActive()){peerRoomRuntimePrimeUnread();directChatRender()}
  return out
};
globalThis.peerRoomRenderChat=peerRoomRenderChat;

function peerRoomRuntimeEnterChat(){
  peerRoomRuntimeState.chatInitialized=false;peerRoomRuntimePrimeUnread();directChatSyncVisibility();directChatRender()
}
function peerRoomRuntimeLeaveChat(){
  if(directChatState.open)directChatClose({restoreFocus:false});
  peerRoomRuntimeState.chatInitialized=false;peerRoomRuntimeState.knownChatIds.clear();peerRoomRuntimeState.inPeerChat=false;directChatState.messages=[];directChatState.seenIds=new Set();directChatState.unread=0;directChatSyncVisibility();directChatRender()
}

const peerRoomRuntimeEnterPayloadBefore=peerRoomMatchEnterPayload;
peerRoomMatchEnterPayload=function(payload,matchId,seat=peerRoom?.seat){
  const out=peerRoomRuntimeEnterPayloadBefore(payload,matchId,seat);peerRoomRuntimeEnterChat();return out
};
globalThis.peerRoomMatchEnterPayload=peerRoomMatchEnterPayload;

const peerRoomRuntimeReturnLobbyBefore=peerRoomMatchReturnLocalLobby;
peerRoomMatchReturnLocalLobby=function(options={}){peerRoomRuntimeLeaveChat();return peerRoomRuntimeReturnLobbyBefore(options)};
globalThis.peerRoomMatchReturnLocalLobby=peerRoomMatchReturnLocalLobby;

// If 0.20 loaded an active match before this runtime layer arrived, repair visibility now.
if(peerRoomRuntimeChatActive())peerRoomRuntimeEnterChat();else directChatSyncVisibility();

globalThis.peerRoomRuntime={version:PEER_ROOM_RUNTIME_VERSION,ownsGameplay:peerRoomRuntimeOwnsGameplay,chatActive:peerRoomRuntimeChatActive,transportReady:peerRoomRuntimeTransportReady};
