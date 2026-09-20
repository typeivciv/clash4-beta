'use strict';
const DIRECT_CHAT_V2_VERSION='0.18.7';
let directChatV2Installed=false;

function directChatV2IsMobile(){
  try{return window.matchMedia('(pointer:coarse)').matches||window.matchMedia('(max-width:900px)').matches}catch{return innerWidth<=900}
}
function directChatV2NearBottom(log){
  if(!log)return true;
  return log.scrollHeight-log.scrollTop-log.clientHeight<88
}
function directChatV2SetBackdrop(open){
  const backdrop=directChatEl('directChatBackdrop');if(!backdrop)return;
  backdrop.hidden=!open;backdrop.setAttribute('aria-hidden','true')
}
function directChatV2CreateMessage(message){
  const row=document.createElement('div');row.className=`directChatMessage ${message.mine?'mine':'theirs'} is-new`;row.dataset.chatId=message.id;
  const meta=document.createElement('div');meta.className='directChatMeta';
  const who=document.createElement('strong');who.textContent=message.mine?'You':'Opponent';
  const time=document.createElement('time');time.textContent=directChatTimestamp(message.receivedAt);time.dateTime=new Date(message.receivedAt).toISOString();
  const text=document.createElement('p');text.textContent=message.text;
  meta.append(who,time);row.append(meta,text);
  setTimeout(()=>row.classList.remove('is-new'),180);
  return row
}
function directChatV2DecorateUi(){
  const drawer=directChatEl('directChatDrawer'),head=drawer?.querySelector('.directChatHead'),input=directChatEl('directChatInput'),send=directChatEl('directChatSend');
  if(!drawer||!head||!input||!send||drawer.dataset.chatV2==='1')return false;
  drawer.dataset.chatV2='1';drawer.classList.add('directChatV2');drawer.tabIndex=-1;
  const grab=document.createElement('div');grab.className='directChatGrab';grab.setAttribute('aria-hidden','true');head.before(grab);
  const headCopy=head.firstElementChild;
  if(headCopy){
    const eyebrow=headCopy.querySelector('span'),title=headCopy.querySelector('strong'),small=headCopy.querySelector('small');
    if(eyebrow)eyebrow.textContent='DIRECT CHAT';
    if(title)title.textContent='Chat';
    if(small){small.textContent='';const dot=document.createElement('i');dot.className='directChatStatusDot';dot.setAttribute('aria-hidden','true');small.append(dot,document.createTextNode('Private · Direct Duel'))}
  }
  input.placeholder='Message…';input.setAttribute('aria-label','Message opponent');
  send.textContent='↑';send.setAttribute('aria-label','Send message');send.title='Send message';
  let backdrop=directChatEl('directChatBackdrop');
  if(!backdrop){backdrop=document.createElement('div');backdrop.id='directChatBackdrop';backdrop.className='directChatBackdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');drawer.before(backdrop);backdrop.addEventListener('click',()=>directChatClose())}
  return true
}

const directChatRenderBeforeV2=directChatRender;
directChatRender=function(){
  const drawer=directChatEl('directChatDrawer'),log=directChatEl('directChatLog'),empty=directChatEl('directChatEmpty'),badge=directChatEl('directChatBadge'),mute=directChatEl('directChatMute'),count=directChatEl('directChatCount'),fab=directChatEl('directChatFab'),input=directChatEl('directChatInput'),send=directChatEl('directChatSend');
  if(!log||!drawer)return directChatRenderBeforeV2();
  const stick=directChatV2NearBottom(log)||log.querySelectorAll('.directChatMessage').length===0;
  const existing=new Map([...log.querySelectorAll('.directChatMessage[data-chat-id]')].map(node=>[node.dataset.chatId,node]));
  const liveIds=new Set();
  for(const message of directChatState.messages){
    liveIds.add(message.id);
    const row=existing.get(message.id)||directChatV2CreateMessage(message);
    log.append(row)
  }
  for(const [id,node] of existing)if(!liveIds.has(id))node.remove();
  if(directChatState.open&&stick)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight});
  if(empty)empty.hidden=directChatState.messages.length>0;
  if(badge){badge.textContent=directChatState.unread>99?'99+':String(directChatState.unread);badge.hidden=directChatState.unread===0||directChatState.muted}
  if(fab)fab.setAttribute('aria-label',directChatState.unread&&!directChatState.muted?`Open Direct Duel chat, ${directChatState.unread} unread ${directChatState.unread===1?'message':'messages'}`:'Open Direct Duel chat');
  if(mute){mute.textContent=directChatState.muted?'Alerts off':'Alerts';mute.setAttribute('aria-pressed',String(directChatState.muted));mute.setAttribute('aria-label',directChatState.muted?'Turn chat alerts on':'Mute chat alerts')}
  const length=input?.value?.length||0;
  drawer.classList.toggle('has-draft',length>0);
  if(count){count.textContent=`${length}/${DIRECT_CHAT_MAX_CHARS}`;count.classList.toggle('near-limit',length>=160)}
  if(send)send.disabled=!directChatNormalizeText(input?.value||'')||!directChatConnected()
};
globalThis.directChatRender=directChatRender;

const directChatSetOpenBeforeV2=directChatSetOpen;
directChatSetOpen=function(open,{restoreFocus=true}={}){
  const drawer=directChatEl('directChatDrawer'),fab=directChatEl('directChatFab');if(!drawer||!fab)return directChatSetOpenBeforeV2(open,{restoreFocus});
  const next=!!open;directChatState.open=next;fab.setAttribute('aria-expanded',String(next));
  document.body.classList.toggle('direct-chat-open',next);
  if(next){
    directChatState.returnFocus=document.activeElement;directChatState.unread=0;drawer.hidden=false;directChatV2SetBackdrop(directChatV2IsMobile());directChatRender();
    requestAnimationFrame(()=>{drawer.classList.add('is-open');globalThis.directChatKeyboard?.syncViewport?.();if(directChatV2IsMobile()){try{drawer.focus({preventScroll:true})}catch{drawer.focus()}}else{try{directChatEl('directChatInput')?.focus({preventScroll:true})}catch{directChatEl('directChatInput')?.focus()}}});
  }else{
    try{directChatEl('directChatInput')?.blur()}catch{}
    drawer.classList.remove('is-open');directChatV2SetBackdrop(false);document.body.classList.remove('direct-chat-input-focused','direct-chat-keyboard-shown');directChatRender();
    setTimeout(()=>{if(!directChatState.open)drawer.hidden=true},170);
    if(restoreFocus&&directChatState.returnFocus?.isConnected)try{directChatState.returnFocus.focus({preventScroll:true})}catch{}
    directChatState.returnFocus=null
  }
};
globalThis.directChatSetOpen=directChatSetOpen;

function directChatV2Install(){
  if(directChatV2Installed)return;
  if(!directChatV2DecorateUi()){setTimeout(directChatV2Install,0);return}
  directChatV2Installed=true;
  const input=directChatEl('directChatInput');
  input?.addEventListener('input',directChatRender);
  window.addEventListener('resize',()=>{if(directChatState?.open)globalThis.directChatKeyboard?.syncViewport?.()},{passive:true});
  directChatRender()
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',directChatV2Install,{once:true});else directChatV2Install();
globalThis.directChatV2={version:DIRECT_CHAT_V2_VERSION,install:directChatV2Install,isMobile:directChatV2IsMobile};
