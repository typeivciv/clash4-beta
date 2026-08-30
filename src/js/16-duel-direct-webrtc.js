// Direct Duel: serverless match transport over an ordered/reliable WebRTC DataChannel.
// Signaling is exchanged manually (QR nearby, share/copy long-distance), so no Clash 4
// signaling or game server is required. Public STUN is used only for peer discovery.
'use strict';
const DIRECT_PROTOCOL=1;
const DIRECT_SIGNAL_PREFIX='C4D1';
const DIRECT_RTC_CONFIG={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],iceCandidatePoolSize:2};
let directDuel={active:false,role:null,pairing:null,pc:null,channel:null,seat:null,ready:{human:false,ai:false},authority:null,signalKind:null,scanner:null};

function directEl(id){return document.getElementById(id)}
function directSetStatus(text,{error=false}={}){const el=directEl('duelDirectStatus');if(el){el.textContent=text||'';el.classList.toggle('error',error)}}
function bytesToB64Url(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
function b64UrlToBytes(value){let s=String(value||'').replaceAll('-','+').replaceAll('_','/');while(s.length%4)s+='=';const raw=atob(s),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function streamBytes(readable){const buf=await new Response(readable).arrayBuffer();return new Uint8Array(buf)}
async function packDirectSignal(obj){
  const raw=new TextEncoder().encode(JSON.stringify(obj));
  if('CompressionStream'in globalThis){try{const packed=await streamBytes(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate')));return`${DIRECT_SIGNAL_PREFIX}.D.${bytesToB64Url(packed)}`}catch{}}
  return`${DIRECT_SIGNAL_PREFIX}.J.${bytesToB64Url(raw)}`
}
async function unpackDirectSignal(value){
  let text=String(value||'').trim();const match=text.match(/C4D1\.[DJ]\.[A-Za-z0-9_-]+/);if(match)text=match[0];
  const parts=text.split('.');if(parts.length!==3||parts[0]!==DIRECT_SIGNAL_PREFIX)throw new Error('Not a Clash 4 Direct Duel signal.');
  let bytes=b64UrlToBytes(parts[2]);
  if(parts[1]==='D'){if(!('DecompressionStream'in globalThis))throw new Error('This browser cannot open the compressed invite.');bytes=await streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')))}
  const obj=JSON.parse(new TextDecoder().decode(bytes));if(obj?.protocol!==DIRECT_PROTOCOL||!['offer','answer'].includes(obj?.kind)||!obj?.description?.sdp)throw new Error('Invalid Direct Duel signal.');return obj
}
function directWaitForIce(pc,timeout=8000){
  if(pc.iceGatheringState==='complete')return Promise.resolve();
  return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;pc.removeEventListener('icegatheringstatechange',onChange);clearTimeout(timer);resolve()};const onChange=()=>{if(pc.iceGatheringState==='complete')finish()};const timer=setTimeout(finish,timeout);pc.addEventListener('icegatheringstatechange',onChange)})
}
function directClosePeer({notify=false}={}){
  if(notify&&directDuel.channel?.readyState==='open'){try{directDuel.channel.send(JSON.stringify({kind:'leave'}))}catch{}}
  try{directDuel.channel?.close()}catch{};try{directDuel.pc?.close()}catch{};
  directDuel.active=false;directDuel.role=null;directDuel.pairing=null;directDuel.pc=null;directDuel.channel=null;directDuel.seat=null;directDuel.ready={human:false,ai:false};directDuel.authority=null;directDuel.signalKind=null;
  directStopScanner()
}
globalThis.directClosePeer=directClosePeer;
function directConnectionBadge(state,text){if(!duelConnectionBadge)return;duelConnectionBadge.className='duelConnectionBadge '+(state==='online'?'online':state==='error'?'error':'offline');duelConnectionBadge.textContent=text}
function directShowHub(){
  directClosePeer();duelStopPolling();resetDuelLobbyUi();setVisible(duelEntryPanel,true);setVisible(duelWaitingPanel,false);
  const hub=directEl('duelModeHub'),online=directEl('duelOnlinePanel'),direct=directEl('duelDirectPanel');if(hub)hub.hidden=false;if(online)online.hidden=true;if(direct)direct.hidden=true;
  directConnectionBadge('offline','Choose a Duel mode');duelStatus('')
}
function openDuelHub(){setMatchControllerMode('duel',{owner:H});setIntroScreen('duel');directShowHub();queueFit()}
globalThis.openDuelHub=openDuelHub;
function openDuelOnlineMode(){
  directClosePeer();const hub=directEl('duelModeHub'),online=directEl('duelOnlinePanel'),direct=directEl('duelDirectPanel');if(hub)hub.hidden=true;if(online)online.hidden=false;if(direct)direct.hidden=true;
  openDuelLobby();if(hub)hub.hidden=true;if(online)online.hidden=false
}
globalThis.openDuelOnlineMode=openDuelOnlineMode;
function directOpenPanel(){
  duelStopPolling();duelClearActiveSession();setMatchControllerMode('duel',{owner:H});setIntroScreen('duel');resetDuelLobbyUi();
  const hub=directEl('duelModeHub'),online=directEl('duelOnlinePanel'),panel=directEl('duelDirectPanel');if(hub)hub.hidden=true;if(online)online.hidden=true;if(panel)panel.hidden=false;
  directEl('duelDirectStage').hidden=true;directEl('duelDirectActions').hidden=false;directEl('duelDirectSignal').value='';directSetStatus('');directConnectionBadge('offline','Direct P2P');queueFit()
}
function makeDirectPeer(role){
  if(!('RTCPeerConnection'in globalThis))throw new Error('WebRTC is not available in this browser.');
  const pc=new RTCPeerConnection(DIRECT_RTC_CONFIG);directDuel.pc=pc;directDuel.role=role;directDuel.seat=role==='host'?H:A;duelSession.seat=directDuel.seat;
  pc.onconnectionstatechange=()=>{
    const st=pc.connectionState;if(st==='connected')directConnectionBadge('online','Direct connected');
    else if(['failed','disconnected','closed'].includes(st)&&directDuel.active){directConnectionBadge('error','Direct interrupted');directSetStatus('Direct connection interrupted. Return to Duel modes and reconnect.',{error:true})}
  };
  if(role==='host'){const channel=pc.createDataChannel('clash4-duel',{ordered:true});directBindChannel(channel)}else pc.ondatachannel=e=>directBindChannel(e.channel);
  return pc
}
function directBindChannel(channel){
  directDuel.channel=channel;channel.onopen=()=>{directDuel.active=true;directDuel.ready={human:false,ai:false};directConnectionBadge('online','Direct connected');directEnterReadyRoom();directSend({kind:'hello',protocol:DIRECT_PROTOCOL})};
  channel.onmessage=e=>{let data;try{data=JSON.parse(e.data)}catch{return}directHandleMessage(data)};
  channel.onclose=()=>{if(directDuel.active){directDuel.active=false;directConnectionBadge('error','Peer disconnected');if(duelSession.active)msg('Opponent disconnected from Direct Duel.')}};
  channel.onerror=()=>directConnectionBadge('error','Direct error')
}
function directSend(data){if(directDuel.channel?.readyState==='open')directDuel.channel.send(JSON.stringify(data))}
async function directCreate(pairing='nearby'){
  directOpenPanel();directDuel.pairing=pairing;directDuel.signalKind='offer';directEl('duelDirectActions').hidden=true;directEl('duelDirectStage').hidden=false;directSetStatus('Creating a direct connection invite…');
  try{
    const pc=makeDirectPeer('host'),offer=await pc.createOffer();await pc.setLocalDescription(offer);await directWaitForIce(pc);
    const signal=await packDirectSignal({protocol:DIRECT_PROTOCOL,kind:'offer',description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});directShowSignal(signal,'offer',pairing)
  }catch(e){directSetStatus(e.message||'Could not create Direct Duel.',{error:true});directClosePeer()}
}
globalThis.directCreate=directCreate;
async function directJoinSignal(raw){
  directOpenPanel();directDuel.signalKind='answer';directEl('duelDirectActions').hidden=true;directEl('duelDirectStage').hidden=false;directSetStatus('Opening the Direct Duel invite…');
  try{
    const signal=await unpackDirectSignal(raw);if(signal.kind!=='offer')throw new Error('This is not a host invite.');
    const pc=makeDirectPeer('guest');await pc.setRemoteDescription(signal.description);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await directWaitForIce(pc);
    const packed=await packDirectSignal({protocol:DIRECT_PROTOCOL,kind:'answer',description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});directShowSignal(packed,'answer',directDuel.pairing||'nearby');directSetStatus('Return this response to Player 1. Connection will open after they accept it.')
  }catch(e){directSetStatus(e.message||'Could not join Direct Duel.',{error:true});directClosePeer()}
}
globalThis.directJoinSignal=directJoinSignal;
async function directAcceptAnswer(raw){
  try{const signal=await unpackDirectSignal(raw);if(signal.kind!=='answer')throw new Error('This is not a return response.');if(directDuel.role!=='host'||!directDuel.pc)throw new Error('Create a Direct Duel invite first.');await directDuel.pc.setRemoteDescription(signal.description);directSetStatus('Response accepted. Establishing the peer-to-peer connection…')}
  catch(e){directSetStatus(e.message||'Could not accept the response.',{error:true})}
}
globalThis.directAcceptAnswer=directAcceptAnswer;
function directShowSignal(signal,kind,pairing){
  const field=directEl('duelDirectSignal');field.value=signal;const title=directEl('duelDirectStageTitle'),copy=directEl('duelDirectStageCopy');
  if(kind==='offer'){title.textContent=pairing==='remote'?'Send this invite':'Player 2 scans this invite';copy.textContent=pairing==='remote'?'Send the invite through Messages, Discord, email, or another app. Then paste the response they send back.':'After Player 2 scans this QR, they will show a return QR. Scan that return QR on this phone.'}
  else{title.textContent=pairing==='remote'?'Send this response back':'Show this return QR to Player 1';copy.textContent=pairing==='remote'?'Send this response to Player 1. Keep this page open while they accept it.':'Keep this page open. Player 1 scans this QR to finish the connection.'}
  directRenderQr(signal);directEl('duelDirectAcceptRow').hidden=kind!=='offer';directSetStatus(kind==='offer'?'Invite ready.':'Response ready.');queueFit()
}
function directRenderQr(text){
  const box=directEl('duelDirectQr');if(!box)return;box.innerHTML='';
  if(!globalThis.QRCode){box.textContent='QR renderer unavailable — use Copy/Share instead.';return}
  try{new QRCode(box,{text,width:228,height:228,correctLevel:QRCode.CorrectLevel.L})}catch{box.textContent='This connection signal is too large for QR on this browser. Use Copy/Share instead.'}
}
async function directCopySignal(){const value=directEl('duelDirectSignal').value;if(!value)return;try{await navigator.clipboard.writeText(value);directSetStatus('Copied Direct Duel signal.')}catch{directEl('duelDirectSignal').focus();directEl('duelDirectSignal').select();directSetStatus('Select and copy the signal above.')}}
async function directShareSignal(){const value=directEl('duelDirectSignal').value;if(!value)return;const label=directDuel.signalKind==='answer'?'Direct Duel response':'Direct Duel invite';if(navigator.share){try{await navigator.share({title:`Clash 4 — ${label}`,text:`${label}\n${value}`});return}catch{}}await directCopySignal()}
async function directPasteAndApply(){
  let value='';try{value=await navigator.clipboard.readText()}catch{}if(!value)value=prompt('Paste the Clash 4 Direct Duel signal:')||'';if(!value)return;
  if(directDuel.role==='host')await directAcceptAnswer(value);else await directJoinSignal(value)
}
function directEnterReadyRoom(){
  setVisible(duelEntryPanel,false);setVisible(duelWaitingPanel,true);duelLobbyCode.textContent='DIRECT';duelSeatLabel.textContent=directDuel.seat===H?'Player 1':'Player 2';
  duelLobbyStatus.textContent='Direct connection ready';duelWaitingCopy.textContent='Peer-to-peer connection established. Both players press Ready.';
  duelYouReady.textContent='Not ready';duelYouReady.classList.remove('ready');duelOpponentReady.textContent='Not ready';duelOpponentReady.classList.remove('ready');duelReadyButton.disabled=false;duelReadyButton.textContent="I'm Ready";queueFit()
}
function directDuelReady(){
  if(!directDuel.active)return;directDuel.ready[directDuel.seat]=true;duelYouReady.textContent='Ready ✓';duelYouReady.classList.add('ready');duelReadyButton.disabled=true;duelReadyButton.textContent='Ready ✓';directSend({kind:'ready'});if(directDuel.role==='host')directTryStart()
}
globalThis.directDuelReady=directDuelReady;
function directTryStart(){
  if(directDuel.role!=='host'||!directDuel.ready[H]||!directDuel.ready[A]||directDuel.authority)return;
  directDuel.authority={state:makeLocalDuelState(randomDuelStarter()),version:1};
  const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
  const guest=localDuelPayload(directDuel.authority.state,A,1,[],players),host=localDuelPayload(directDuel.authority.state,H,1,[],players);
  directSend({kind:'payload',payload:guest});duelApplyPayload(host)
}
function directHandleMessage(data){
  if(!data||typeof data!=='object')return;
  if(data.kind==='ready'){
    const remote=other(directDuel.seat);directDuel.ready[remote]=true;duelOpponentReady.textContent='Ready ✓';duelOpponentReady.classList.add('ready');if(directDuel.role==='host')directTryStart();return
  }
  if(data.kind==='payload'&&directDuel.role==='guest'&&data.payload){duelApplyPayload(data.payload);return}
  if(data.kind==='move'&&directDuel.role==='host'){directAuthorityMove(A,data.type,data.column);return}
  if(data.kind==='error'){duelSession.pendingLocal=null;busy=false;render();msg(humanizeDuelError(data.error));return}
  if(data.kind==='leave'){directDuel.active=false;directConnectionBadge('error','Peer left');msg('Opponent left Direct Duel.')}
}
function directAuthorityMove(owner,type,column){
  const auth=directDuel.authority;if(!auth)return;const q=applyLocalDuelMove(auth.state,owner,type,column);if(q.error){if(owner===A)directSend({kind:'error',error:q.error});else{duelSession.pendingLocal=null;busy=false;msg(humanizeDuelError(q.error))}return}
  auth.state=q.state;auth.version++;
  const players=[{seat:H,ready:true,connected:true},{seat:A,ready:true,connected:true}];
  const guest=localDuelPayload(auth.state,A,auth.version,q.events,players),host=localDuelPayload(auth.state,H,auth.version,q.events,players);
  directSend({kind:'payload',payload:guest});duelApplyPayload(host)
}
function directDuelMove(owner,type,column){
  if(!directDuel.active||!duelSession.active||!ready||busy||s.winner||s.draw||s.turn!==H||owner!==H)return;
  const c=Number(column);if(!T.includes(type)||!Number.isInteger(c)||!legalCols(H).includes(c)||s.inv.human[type]<=0)return;
  duelSession.pendingLocal={type,column:c,before:cloneState(s),baseVersion:duelSession.handledVersion};busy=true;render();
  if(directDuel.role==='host')directAuthorityMove(H,type,c);else directSend({kind:'move',type,column:c,baseVersion:duelSession.handledVersion})
}
globalThis.directDuelMove=directDuelMove;

function ensureDirectScanner(){
  let modal=directEl('directQrScanner');if(modal)return modal;
  modal=document.createElement('div');modal.id='directQrScanner';modal.className='duelQrScanner';modal.hidden=true;modal.innerHTML='<div class="duelQrScannerCard"><div class="duelQrScannerTop"><strong>Scan Clash 4 QR</strong><button id="directQrScannerClose" type="button">Close</button></div><video id="directQrVideo" playsinline muted></video><canvas id="directQrCanvas" hidden></canvas><p id="directQrScannerStatus">Point the camera at the other player’s QR code.</p></div>';document.body.append(modal);directEl('directQrScannerClose').addEventListener('click',directStopScanner);return modal
}
function directStopScanner(){
  const scan=directDuel.scanner;if(scan){scan.stopped=true;try{scan.stream?.getTracks().forEach(t=>t.stop())}catch{};if(scan.raf)cancelAnimationFrame(scan.raf)}directDuel.scanner=null;const modal=directEl('directQrScanner');if(modal)modal.hidden=true
}
async function directScanSignal(){
  const modal=ensureDirectScanner(),video=directEl('directQrVideo'),canvas=directEl('directQrCanvas'),status=directEl('directQrScannerStatus');modal.hidden=false;status.textContent='Starting camera…';
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();const detector='BarcodeDetector'in globalThis?new BarcodeDetector({formats:['qr_code']}):null;const scan={stream,stopped:false,raf:null};directDuel.scanner=scan;status.textContent='Point the camera at the other player’s QR code.';
    const tick=async()=>{if(scan.stopped)return;try{let value='';if(detector){const found=await detector.detect(video);value=found[0]?.rawValue||''}else if(globalThis.jsQR&&video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);const img=ctx.getImageData(0,0,canvas.width,canvas.height),found=jsQR(img.data,img.width,img.height,{inversionAttempts:'dontInvert'});value=found?.data||''}if(value){directStopScanner();if(directDuel.role==='host')await directAcceptAnswer(value);else await directJoinSignal(value);return}}catch{}scan.raf=requestAnimationFrame(tick)};tick()
  }catch(e){status.textContent='Camera scanning is unavailable here. Use Copy/Paste instead.';directSetStatus(e.message||'Could not open camera.',{error:true})}
}
globalThis.directScanSignal=directScanSignal;

function bindDirectDuelUi(){
  directEl('duelDirectMode')?.addEventListener('click',directOpenPanel);directEl('duelOnlineMode')?.addEventListener('click',openDuelOnlineMode);
  directEl('duelDirectBack')?.addEventListener('click',directShowHub);directEl('duelDirectNearby')?.addEventListener('click',()=>directCreate('nearby'));directEl('duelDirectRemote')?.addEventListener('click',()=>directCreate('remote'));
  directEl('duelDirectJoin')?.addEventListener('click',async()=>{let value='';try{value=await navigator.clipboard.readText()}catch{}if(value&&value.includes(DIRECT_SIGNAL_PREFIX))directJoinSignal(value);else{value=prompt('Paste the Direct Duel invite from Player 1:')||'';if(value)directJoinSignal(value)}});
  directEl('duelDirectScanInvite')?.addEventListener('click',()=>{directDuel.role='guest';directScanSignal()});directEl('duelDirectCopy')?.addEventListener('click',directCopySignal);directEl('duelDirectShare')?.addEventListener('click',directShareSignal);directEl('duelDirectScanReturn')?.addEventListener('click',directScanSignal);directEl('duelDirectPaste')?.addEventListener('click',directPasteAndApply)
}
globalThis.bindDirectDuelUi=bindDirectDuelUi;
