// Duel DOM event bindings. The Alpha build loads transport modules before this binder.
function bindPrivateDuelUi(){
  homeDuelButton.addEventListener('click',openDuelHub);
  duelBackButton.addEventListener('click',duelLeaveAllToHome);
  duelCreateButton.addEventListener('click',duelCreateLobby);
  duelJoinModeButton.addEventListener('click',()=>{setVisible(duelJoinForm,true);duelCodeInput.focus()});
  duelJoinCancel.addEventListener('click',()=>{setVisible(duelJoinForm,false);duelStatus('')});
  duelJoinButton.addEventListener('click',duelJoinLobby);
  duelCodeInput.addEventListener('input',()=>{duelCodeInput.value=duelCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)});
  duelCodeInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();duelJoinLobby()}});
  duelSaveServerButton.addEventListener('click',()=>saveDuelServer(duelServerInput.value));
  duelServerInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveDuelServer(duelServerInput.value)}});
  duelReadyButton.addEventListener('click',duelRouteReady);
  duelCopyCode.addEventListener('click',async()=>{
    if(directDuel.active)return;
    try{await navigator.clipboard.writeText(duelSession.code);duelCopyCode.textContent='Copied ✓';setTimeout(()=>duelCopyCode.textContent='Copy Code',1200)}
    catch{duelWaitingCopy.textContent=`Room code: ${duelSession.code}`}
  });
  duelLeaveButton.addEventListener('click',duelLeaveAllToHome);
  document.getElementById('duelOnlineBack')?.addEventListener('click',directShowHub);
  bindDirectDuelUi();bindPassPlayUi()
}
globalThis.bindPrivateDuelUi=bindPrivateDuelUi;
