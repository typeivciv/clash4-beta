'use strict';
const DIRECT_CHAT_VERSION='0.18.4';
const DIRECT_CHAT_PROTOCOL=1;
const DIRECT_CHAT_MAX_MESSAGES=50;
const DIRECT_CHAT_MAX_CHARS=200;
const DIRECT_CHAT_MIN_SEND_MS=500;
const DIRECT_CHAT_BURST_WINDOW_MS=10_000;
const DIRECT_CHAT_BURST_MAX=8;
const DIRECT_CHAT_QUICK=['Nice move!','Good game!','Rematch?','🔥','😂','😮'];
let directChatState={messages:[],seenIds:new Set(),open:false,muted:false,unread:0,lastSendAt:0,sendTimes:[],incomingTimes:[],returnFocus:null,wasConnected:false};

function directChatEl(id){return document.getElementById(id)}
function directChatNormalizeText(value){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,DIRECT_CHAT_MAX_CHARS)}
function directChatConnected(){return !!(typeof directDuel!=='undefined'&&directDuel?.active&&directDuel?.channel?.readyState==='open')}
function directChatBlockingOverlay(){return !!document.querySelector('.overlay.show,.end.show,.coinOverlay.show,.helpOverlay.show,.alphaTesterModal:not([hidden])')}
function directChatTimestamp(ms){try{return new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit'}).format(new Date(ms))}catch{return''}}
function directChatMakeId(){try{return crypto.randomUUID()}catch{return`c4chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`}}
function directChatTrimSeen(){if(directChatState.seenIds.size<=120)return;directChatState.seenIds=new Set(directChatState.messages.map(message=>message.id))}
function directChatRemember(message){
  if(!message?.id||directChatState.seenIds.has(message.id))return false;
  directChatState.seenIds.add(message.id);directChatState.messages.push(message);
  if(directChatState.messages.length>DIRECT_CHAT_MAX_MESSAGES)directChatState.messages.splice(0,directChatState.messages.length-DIRECT_CHAT_MAX_MESSAGES);
  directChatTrimSeen();return true
}
function directChatRender(){
  const log=directChatEl('directChatLog'),empty=directChatEl('directChatEmpty'),badge=directChatEl('directChatBadge'),mute=directChatEl('directChatMute'),count=directChatEl('directChatCount');
  if(log){
    log.querySelectorAll('.directChatMessage').forEach(node=>node.remove());
    for(const message of directChatState.messages){
      const row=document.createElement('div');row.className=`directChatMessage ${message.mine?'mine':'theirs'}`;
      const meta=document.createElement('div');meta.className='directChatMeta';
      const who=document.createElement('strong');who.textContent=message.mine?'You':'Opponent';
      const time=document.createElement('time');time.textContent=directChatTimestamp(message.receivedAt);time.dateTime=new Date(message.receivedAt).toISOString();
      const text=document.createElement('p');text.textContent=message.text;
      meta.append(who,time);row.append(meta,text);log.append(row)
    }
    if(directChatState.open)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight})
  }
  if(empty)empty.hidden=directChatState.messages.length>0;
  if(badge){badge.textContent=directChatState.unread>99?'99+':String(directChatState.unread);badge.hidden=directChatState.unread===0||directChatState.muted}
  if(mute){mute.textContent=directChatState.muted?'Unmute':'Mute';mute.setAttribute('aria-pressed',String(directChatState.muted))}
  if(count){const input=directChatEl('directChatInput');count.textContent=`${input?.value?.length||0}/${DIRECT_CHAT_MAX_CHARS}`}
}
function directChatSetOpen(open,{restoreFocus=true}={}){
  const drawer=directChatEl('directChatDrawer'),fab=directChatEl('directChatFab');if(!drawer||!fab)return;
  directChatState.open=!!open;drawer.hidden=!open;fab.setAttribute('aria-expanded',String(!!open));
  document.body.classList.toggle('direct-chat-open',!!open);
  if(open){
    directChatState.returnFocus=document.activeElement;directChatState.unread=0;directChatRender();
    requestAnimationFrame(()=>directChatEl('directChatInput')?.focus({preventScroll:true}))
  }else{
    directChatRender();
    if(restoreFocus&&directChatState.returnFocus?.isConnected)try{directChatState.returnFocus.focus({preventScroll:true})}catch{}
    directChatState.returnFocus=null
  }
}
function directChatOpen(){if(!directChatConnected()||directChatBlockingOverlay())return;directChatSetOpen(true)}
function directChatClose(options){directChatSetOpen(false,options)}
function directChatReset(){
  directChatSetOpen(false,{restoreFocus:false});
  directChatState={messages:[],seenIds:new Set(),open:false,muted:false,unread:0,lastSendAt:0,sendTimes:[],incomingTimes:[],returnFocus:null,wasConnected:false};
  const input=directChatEl('directChatInput');if(input)input.value='';directChatRender();directChatSyncVisibility()
}
function directChatCanSendNow(){
  const now=Date.now();if(now-directChatState.lastSendAt<DIRECT_CHAT_MIN_SEND_MS)return false;
  directChatState.sendTimes=directChatState.sendTimes.filter(t=>now-t<DIRECT_CHAT_BURST_WINDOW_MS);
  return directChatState.sendTimes.length<DIRECT_CHAT_BURST_MAX
}
function directChatNoteSend(){const now=Date.now();directChatState.lastSendAt=now;directChatState.sendTimes.push(now)}
function directChatSendText(value){
  const text=directChatNormalizeText(value);if(!text||!directChatConnected())return false;
  if(!directChatCanSendNow()){if(typeof msg==='function')msg('Chat is moving too fast — wait a moment.');return false}
  const id=directChatMakeId(),message={id,text,mine:true,receivedAt:Date.now()};
  directChatNoteSend();directChatRemember(message);directSend({kind:'chat',chatVersion:DIRECT_CHAT_PROTOCOL,id,text});directChatRender();return true
}
function directChatIncomingAllowed(){
  const now=Date.now();directChatState.incomingTimes=directChatState.incomingTimes.filter(t=>now-t<DIRECT_CHAT_BURST_WINDOW_MS);
  if(directChatState.incomingTimes.length>=12)return false;directChatState.incomingTimes.push(now);return true
}
function directChatReceive(data){
  if(!directChatConnected()||data?.chatVersion!==DIRECT_CHAT_PROTOCOL||typeof data?.id!=='string'||data.id.length>80||!directChatIncomingAllowed())return;
  const text=directChatNormalizeText(data.text);if(!text)return;
  if(!directChatRemember({id:data.id,text,mine:false,receivedAt:Date.now()}))return;
  if(!directChatState.open&&!directChatState.muted)directChatState.unread++;
  directChatRender()
}
function directChatSubmit(event){event?.preventDefault?.();const input=directChatEl('directChatInput');if(!input)return;if(directChatSendText(input.value)){input.value='';directChatRender();input.focus()}}
function directChatToggleMute(){directChatState.muted=!directChatState.muted;if(directChatState.muted)directChatState.unread=0;directChatRender()}
function directChatSyncVisibility(){
  const fab=directChatEl('directChatFab'),drawer=directChatEl('directChatDrawer');if(!fab||!drawer)return;
  const connected=directChatConnected();fab.hidden=!connected;
  if(!connected&&directChatState.open)directChatClose({restoreFocus:false});
  if(connected&&directChatBlockingOverlay()&&directChatState.open)directChatClose({restoreFocus:false});
  if(directChatState.wasConnected&&!connected&&directChatState.messages.length)directChatReset();
  directChatState.wasConnected=connected
}
function directChatCreateUi(){
  if(directChatEl('directChatFab')||!document.body)return;
  const fab=document.createElement('button');fab.id='directChatFab';fab.className='directChatFab';fab.type='button';fab.hidden=true;fab.setAttribute('aria-controls','directChatDrawer');fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-expanded','false');fab.innerHTML='<span class="directChatFabIcon" aria-hidden="true">💬</span><span class="directChatFabLabel">Chat</span><span id="directChatBadge" class="directChatBadge" hidden>0</span>';
  const drawer=document.createElement('aside');drawer.id='directChatDrawer';drawer.className='directChatDrawer';drawer.hidden=true;drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','false');drawer.setAttribute('aria-labelledby','directChatTitle');
  const quick=DIRECT_CHAT_QUICK.map((text,index)=>`<button type="button" class="directChatQuick" data-chat-quick="${index}">${text}</button>`).join('');
  drawer.innerHTML=`<div class="directChatHead"><div><span>DIRECT DUEL</span><strong id="directChatTitle">Chat</strong><small>Private WebRTC · this match only</small></div><div class="directChatHeadActions"><button id="directChatMute" type="button" aria-pressed="false">Mute</button><button id="directChatClose" type="button" aria-label="Close chat">×</button></div></div><div id="directChatLog" class="directChatLog" role="log" aria-live="polite" aria-relevant="additions text"><div id="directChatEmpty" class="directChatEmpty"><strong>Say hi.</strong><span>Messages travel over the same encrypted Direct Duel connection and are not saved after the duel.</span></div></div><div class="directChatQuickRow" aria-label="Quick messages">${quick}</div><form id="directChatForm" class="directChatForm"><label><span class="srOnly">Message opponent</span><input id="directChatInput" type="text" maxlength="${DIRECT_CHAT_MAX_CHARS}" autocomplete="off" enterkeyhint="send" placeholder="Message opponent…"></label><span id="directChatCount" class="directChatCount">0/${DIRECT_CHAT_MAX_CHARS}</span><button id="directChatSend" type="submit">Send</button></form>`;
  document.body.append(fab,drawer);
  fab.addEventListener('click',directChatOpen);directChatEl('directChatClose').addEventListener('click',()=>directChatClose());directChatEl('directChatMute').addEventListener('click',directChatToggleMute);directChatEl('directChatForm').addEventListener('submit',directChatSubmit);
  directChatEl('directChatInput').addEventListener('input',directChatRender);
  drawer.addEventListener('click',event=>{const button=event.target?.closest?.('[data-chat-quick]');if(!button)return;const value=DIRECT_CHAT_QUICK[Number(button.dataset.chatQuick)];if(value)directChatSendText(value)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&directChatState.open){event.preventDefault();directChatClose()}});
  directChatRender();directChatSyncVisibility()
}

const directHandleMessageBeforeChat=directHandleMessage;
directHandleMessage=function(data){
  if(data?.kind==='chat'){directChatReceive(data);return}
  const result=directHandleMessageBeforeChat(data);
  if(data?.kind==='leave')directChatReset();
  return result
};
globalThis.directHandleMessage=directHandleMessage;

const directClosePeerBeforeChat=directClosePeer;
directClosePeer=function(options={}){directChatReset();return directClosePeerBeforeChat(options)};
globalThis.directClosePeer=directClosePeer;

const duelStartDirectRematchBeforeChat=duelStartDirectRematch;
duelStartDirectRematch=function(payload){directChatReset();return duelStartDirectRematchBeforeChat(payload)};
globalThis.duelStartDirectRematch=duelStartDirectRematch;

const directEnterReadyRoomBeforeChat=directEnterReadyRoom;
directEnterReadyRoom=function(){const result=directEnterReadyRoomBeforeChat();directChatSyncVisibility();return result};
globalThis.directEnterReadyRoom=directEnterReadyRoom;

if(document.body)directChatCreateUi();else document.addEventListener('DOMContentLoaded',directChatCreateUi,{once:true});
setInterval(directChatSyncVisibility,400);
globalThis.directChat={version:DIRECT_CHAT_VERSION,open:directChatOpen,close:directChatClose,reset:directChatReset,send:directChatSendText};
