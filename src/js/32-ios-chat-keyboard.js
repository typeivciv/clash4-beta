'use strict';
const IOS_CHAT_KEYBOARD_VERSION='0.18.7';
let directChatViewportBaseline=0;

function directChatIOSLike(){
  const ua=String(navigator.userAgent||'');
  return /iPad|iPhone|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&Number(navigator.maxTouchPoints)>1)
}
function directChatFocusComposer({scroll=false}={}){
  const input=directChatEl('directChatInput');
  if(!input||!directChatState?.open||input.disabled||input.readOnly)return false;
  try{input.focus({preventScroll:true})}catch{try{input.focus()}catch{return false}}
  if(scroll)requestAnimationFrame(()=>{try{input.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'})}catch{}});
  return document.activeElement===input
}
function directChatKeyboardViewport(){
  const root=document.documentElement,body=document.body,vv=window.visualViewport;
  if(!root||!body)return;
  const focused=body.classList.contains('direct-chat-input-focused');
  const visible=Math.max(220,Math.round(vv?.height||window.innerHeight||220));
  const top=Math.max(0,Math.round(vv?.offsetTop||0));
  if(!focused||!directChatViewportBaseline)directChatViewportBaseline=Math.max(directChatViewportBaseline,visible);
  if(visible>directChatViewportBaseline)directChatViewportBaseline=visible;
  const layoutGap=vv?Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop)):0;
  const baselineGap=focused?Math.max(0,Math.round(directChatViewportBaseline-visible)):0;
  const keyboard=Math.max(layoutGap,baselineGap);
  root.style.setProperty('--direct-chat-visual-height',`${visible}px`);
  root.style.setProperty('--direct-chat-visual-top',`${top}px`);
  root.style.setProperty('--direct-chat-keyboard-inset',`${keyboard}px`);
  body.classList.toggle('direct-chat-keyboard-shown',!!(directChatState?.open&&focused&&keyboard>72))
}
function directChatInstallKeyboardFix(){
  const input=directChatEl('directChatInput'),form=directChatEl('directChatForm');
  if(!input||!form||input.dataset.keyboardFix==='1')return;
  input.dataset.keyboardFix='1';
  input.setAttribute('inputmode','text');
  input.setAttribute('autocapitalize','sentences');
  input.setAttribute('spellcheck','true');
  input.setAttribute('enterkeyhint','send');

  // Keep mobile chat opening keyboard-neutral. The keyboard is requested only when the
  // composer itself receives a trusted tap, which behaves consistently on iOS and Android.
  input.addEventListener('pointerdown',()=>{
    if(directChatIOSLike()&&document.activeElement!==input)directChatFocusComposer({scroll:false})
  },{passive:true});
  input.addEventListener('focus',()=>{
    document.body.classList.add('direct-chat-input-focused');
    directChatKeyboardViewport();
    requestAnimationFrame(directChatKeyboardViewport);
    setTimeout(directChatKeyboardViewport,90);setTimeout(directChatKeyboardViewport,240)
  });
  input.addEventListener('blur',()=>{
    document.body.classList.remove('direct-chat-input-focused','direct-chat-keyboard-shown');
    setTimeout(directChatKeyboardViewport,60)
  });
  form.addEventListener('submit',()=>setTimeout(()=>{if(directChatState?.open)directChatFocusComposer({scroll:true})},0));

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',directChatKeyboardViewport,{passive:true});
    window.visualViewport.addEventListener('scroll',directChatKeyboardViewport,{passive:true})
  }
  window.addEventListener('resize',directChatKeyboardViewport,{passive:true});
  window.addEventListener('orientationchange',()=>{directChatViewportBaseline=0;setTimeout(directChatKeyboardViewport,180)},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(directChatKeyboardViewport,80)});
  directChatKeyboardViewport()
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',directChatInstallKeyboardFix,{once:true});
else directChatInstallKeyboardFix();

globalThis.directChatKeyboard={version:IOS_CHAT_KEYBOARD_VERSION,focus:directChatFocusComposer,syncViewport:directChatKeyboardViewport};
