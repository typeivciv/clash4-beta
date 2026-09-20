'use strict';
const IOS_CHAT_KEYBOARD_VERSION='0.18.6';

function directChatIOSLike(){
  const ua=String(navigator.userAgent||'');
  return /iPad|iPhone|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&Number(navigator.maxTouchPoints)>1)
}
function directChatFocusComposer({scroll=false}={}){
  const input=directChatEl('directChatInput');
  if(!input||!directChatState?.open||input.disabled||input.readOnly)return false;
  try{input.focus({preventScroll:true})}catch{try{input.focus()}catch{return false}}
  if(scroll){requestAnimationFrame(()=>{try{input.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'})}catch{}})}
  return document.activeElement===input
}
function directChatKeyboardViewport(){
  const root=document.documentElement,vv=window.visualViewport;
  if(!root||!vv)return;
  const visible=Math.max(240,Math.round(vv.height));
  root.style.setProperty('--direct-chat-visible-height',`${visible}px`);
  const keyboard=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
  root.style.setProperty('--direct-chat-keyboard-inset',`${keyboard}px`)
}
function directChatInstallKeyboardFix(){
  const fab=directChatEl('directChatFab'),input=directChatEl('directChatInput'),form=directChatEl('directChatForm');
  if(!fab||!input||!form||fab.dataset.keyboardFix==='1')return;
  fab.dataset.keyboardFix='1';
  input.setAttribute('inputmode','text');
  input.setAttribute('autocapitalize','sentences');
  input.setAttribute('spellcheck','true');
  fab.addEventListener('click',()=>{
    if(!directChatState?.open)return;
    directChatFocusComposer({scroll:false});
    directChatKeyboardViewport()
  });
  input.addEventListener('pointerup',()=>{if(directChatIOSLike())directChatFocusComposer({scroll:false})},{passive:true});
  input.addEventListener('touchend',()=>{if(directChatIOSLike())directChatFocusComposer({scroll:false})},{passive:true});
  input.addEventListener('focus',()=>{
    document.body.classList.add('direct-chat-keyboard-active');
    directChatKeyboardViewport();
    setTimeout(()=>directChatFocusComposer({scroll:true}),80)
  });
  input.addEventListener('blur',()=>{
    document.body.classList.remove('direct-chat-keyboard-active');
    directChatKeyboardViewport()
  });
  form.addEventListener('submit',()=>setTimeout(()=>directChatFocusComposer({scroll:true}),0));
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',directChatKeyboardViewport,{passive:true});
    window.visualViewport.addEventListener('scroll',directChatKeyboardViewport,{passive:true})
  }
  window.addEventListener('orientationchange',()=>setTimeout(directChatKeyboardViewport,120),{passive:true});
  directChatKeyboardViewport()
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',directChatInstallKeyboardFix,{once:true});
else directChatInstallKeyboardFix();

globalThis.directChatKeyboard={version:IOS_CHAT_KEYBOARD_VERSION,focus:directChatFocusComposer,syncViewport:directChatKeyboardViewport};
