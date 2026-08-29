// Private Duel DOM event bindings. The HTML build must provide the Duel IDs
// and load src/js/13-duel-client.js before this binder is invoked.
function bindPrivateDuelUi(){
  homeDuelButton.addEventListener('click',openDuelLobby);
  duelBackButton.addEventListener('click',()=>{duelStopPolling();setMatchControllerMode('arcade',{owner:H});setIntroScreen('home')});
  duelCreateButton.addEventListener('click',duelCreateLobby);
  duelJoinModeButton.addEventListener('click',()=>{setVisible(duelJoinForm,true);duelCodeInput.focus()});
  duelJoinCancel.addEventListener('click',()=>{setVisible(duelJoinForm,false);duelStatus('')});
  duelJoinButton.addEventListener('click',duelJoinLobby);
  duelCodeInput.addEventListener('input',()=>{duelCodeInput.value=duelCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)});
  duelCodeInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();duelJoinLobby()}});
  duelSaveServerButton.addEventListener('click',()=>saveDuelServer(duelServerInput.value));
  duelServerInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDuelServer(duelServerInput.value)}});
  duelReadyButton.addEventListener('click',duelReady);
  duelCopyCode.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(duelSession.code);duelCopyCode.textContent='Copied ✓';setTimeout(()=>duelCopyCode.textContent='Copy Code',1200)}
    catch{duelWaitingCopy.textContent=`Room code: ${duelSession.code}`}
  });
  duelLeaveButton.addEventListener('click',duelLeaveToHome)
}
globalThis.bindPrivateDuelUi=bindPrivateDuelUi;
