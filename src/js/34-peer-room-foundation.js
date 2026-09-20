'use strict';
const PEER_ROOM_VERSION='0.19.0';
const PEER_ROOM_PROTOCOL=1;
const PEER_ROOM_MAX_SEATS=4;
const PEER_ROOM_JOIN_PARAM='c4room';
const PEER_ROOM_HOST_PARAM='c4hostroom';
const PEER_ROOM_HOST_STORAGE='clash4.peerRoomHost.v1';
const PEER_ROOM_CLIENT_STORAGE='clash4.peerRoomClient.v1';
const PEER_ROOM_CHAT_MAX=80;
const PEER_ROOM_CHAT_CHARS=200;
const PEER_ROOM_RECONNECT_MS=1600;

let peerRoom={
  active:false,role:null,peer:null,hostId:'',roomId:'',seat:null,clientKey:'',conn:null,
  connections:new Map(),seatByClient:new Map(),seats:[],blocked:new Set(),chat:[],
  roomVersion:1,projectionVersion:1,privateTokens:{},reconnectTimer:null,intentionalClose:false
};

globalThis.peerRoom=peerRoom;
function peerRoomEl(id){return document.getElementById(id)}
function peerRoomRandom(length=10){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=new Uint8Array(length);try{crypto.getRandomValues(bytes)}catch{for(let i=0;i<length;i++)bytes[i]=Math.floor(Math.random()*256)}return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('')}
function peerRoomNormalizeText(value){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,PEER_ROOM_CHAT_CHARS)}
function peerRoomSafeStorageGet(key){try{return localStorage.getItem(key)||''}catch{return''}}
function peerRoomSafeStorageSet(key,value){try{localStorage.setItem(key,value)}catch{}}
function peerRoomSafeStorageRemove(key){try{localStorage.removeItem(key)}catch{}}
function peerRoomClientKey(){
  let key=peerRoomSafeStorageGet(PEER_ROOM_CLIENT_STORAGE);
  if(!/^[A-Za-z0-9_-]{12,80}$/.test(key)){key=`c4c_${peerRoomRandom(24)}`;peerRoomSafeStorageSet(PEER_ROOM_CLIENT_STORAGE,key)}
  return key
}
function peerRoomDefaultSeats(){return Array.from({length:PEER_ROOM_MAX_SEATS},(_,i)=>({seat:i+1,label:`Player ${i+1}`,connected:i===0,reserved:i===0,clientKey:i===0?'HOST':''}))}
function peerRoomFreshPrivateTokens(){const out={};for(let seat=1;seat<=PEER_ROOM_MAX_SEATS;seat++)out[seat]=`P${seat}-${peerRoomRandom(8)}`;return out}
function peerRoomReadHashParam(name){try{return new URLSearchParams(String(location.hash||'').replace(/^#/,'')).get(name)||''}catch{return''}}
function peerRoomSetHash(name,value){try{history.replaceState(null,'',`${location.pathname}${location.search}#${name}=${encodeURIComponent(value)}`)}catch{}}
function peerRoomClearHash(){if(!location.hash.includes(`${PEER_ROOM_JOIN_PARAM}=`)&&!location.hash.includes(`${PEER_ROOM_HOST_PARAM}=`))return;try{history.replaceState(null,'',`${location.pathname}${location.search}`)}catch{}}
function peerRoomInviteLink(hostId=peerRoom.hostId){return `${location.origin}${location.pathname}${location.search}#${PEER_ROOM_JOIN_PARAM}=${encodeURIComponent(hostId)}`}
function peerRoomStatus(text,tone=''){const el=peerRoomEl('peerRoomStatus');if(!el)return;el.textContent=text||'';el.dataset.tone=tone}
function peerRoomConnectionConfig(){return typeof DIRECT_RTC_CONFIG!=='undefined'?DIRECT_RTC_CONFIG:{iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}],iceCandidatePoolSize:2}}
function peerRoomConnOpen(conn){return !!(conn&&conn.open!==false&&conn.peerConnection?.connectionState!=='closed')}

function peerRoomPersistHost(){
  if(peerRoom.role!=='host'||!peerRoom.hostId)return;
  const snapshot={version:1,hostId:peerRoom.hostId,roomId:peerRoom.roomId,roomVersion:peerRoom.roomVersion,projectionVersion:peerRoom.projectionVersion,privateTokens:peerRoom.privateTokens,chat:peerRoom.chat.slice(-PEER_ROOM_CHAT_MAX),seats:peerRoom.seats.map(s=>({seat:s.seat,label:s.label,clientKey:s.clientKey||'',reserved:!!s.reserved})),savedAt:Date.now()};
  peerRoomSafeStorageSet(PEER_ROOM_HOST_STORAGE,JSON.stringify(snapshot))
}
function peerRoomReadHostSnapshot(hostId=''){
  try{const raw=peerRoomSafeStorageGet(PEER_ROOM_HOST_STORAGE);if(!raw)return null;const data=JSON.parse(raw);if(data?.version!==1||!data.hostId||!data.roomId)return null;if(hostId&&data.hostId!==hostId)return null;return data}catch{return null}
}
function peerRoomPublicState(){return{roomId:peerRoom.roomId,roomVersion:peerRoom.roomVersion,hostSeat:1,seats:peerRoom.seats.map(s=>({seat:s.seat,label:s.label,connected:!!s.connected,reserved:!!s.reserved}))}}
function peerRoomProjectionFor(seat){return{roomId:peerRoom.roomId,roomVersion:peerRoom.roomVersion,projectionVersion:peerRoom.projectionVersion,seat,shared:`ROOM-${peerRoom.roomId}-V${peerRoom.projectionVersion}`,privateToken:peerRoom.privateTokens[seat]||''}}
function peerRoomSend(conn,data){try{if(conn?.open)conn.send(data)}catch{}}
function peerRoomBroadcast(data,exceptSeat=null){for(const [seat,conn] of peerRoom.connections){if(seat===exceptSeat)continue;peerRoomSend(conn,data)}}
function peerRoomBroadcastState(){
  peerRoom.roomVersion++;
  const state=peerRoomPublicState();peerRoomBroadcast({kind:'room-state',protocol:PEER_ROOM_PROTOCOL,state});peerRoomPersistHost();peerRoomRenderRoster()
}
function peerRoomBroadcastProjections(){
  peerRoom.projectionVersion++;
  peerRoom.privateTokens=peerRoomFreshPrivateTokens();
  for(const [seat,conn] of peerRoom.connections)peerRoomSend(conn,{kind:'room-projection',protocol:PEER_ROOM_PROTOCOL,projection:peerRoomProjectionFor(seat)});
  peerRoomPersistHost();peerRoomRenderProjection(peerRoomProjectionFor(1));peerRoomStatus(`Projection test ${peerRoom.projectionVersion} sent separately to every occupied seat.`,'ok')
}

function peerRoomCreateStaticUi(){
  const hub=document.querySelector('.alphaMoreGrid'),online=peerRoomEl('duelOnlineMode'),entry=peerRoomEl('duelEntryPanel');
  if(!hub||!entry||peerRoomEl('peerRoomMode'))return;
  const mode=document.createElement('button');mode.id='peerRoomMode';mode.className='duelModeCard peerRoomMode alphaCompactMode';mode.type='button';mode.innerHTML='<span class="duelModeIcon">◉</span><strong>Peer Room · 2–4</strong><small>One player hosts the room directly from their browser.</small><em>Foundation 0.19 · Experimental</em>';
  hub.insertBefore(mode,online||hub.firstChild);
  const panel=document.createElement('div');panel.id='peerRoomPanel';panel.className='peerRoomPanel';panel.hidden=true;
  panel.innerHTML=`<button id="peerRoomBack" class="duelSectionBack" type="button">← Multiplayer</button>
    <div class="peerRoomHead"><div><div class="eyebrow">PEER ROOM · FOUNDATION 0.19</div><h3>Host-as-server WebRTC room</h3><p>Player 1's browser owns the room. Up to three guests connect directly to the host.</p></div><span id="peerRoomRoleBadge" class="peerRoomRoleBadge">Prototype</span></div>
    <div id="peerRoomStart" class="peerRoomStart"><button id="peerRoomCreate" class="duelPrimary" type="button">Create 2–4 Player Room</button><p>No dedicated Clash 4 game server. PeerJS is used only to introduce browsers.</p></div>
    <div id="peerRoomLive" class="peerRoomLive" hidden>
      <div id="peerRoomInvite" class="peerRoomInvite" hidden><div><span>ROOM CODE</span><strong id="peerRoomCode">------</strong><small>Same invite can connect Players 2–4.</small></div><div id="peerRoomQr" class="peerRoomQr" aria-label="Peer Room invite QR"></div><label><span>Invite link</span><input id="peerRoomInviteLink" type="text" readonly></label><div class="peerRoomInviteActions"><button id="peerRoomCopy" type="button">Copy Link</button><button id="peerRoomShare" type="button">Share</button></div></div>
      <div id="peerRoomStatus" class="peerRoomStatus" role="status" aria-live="polite"></div>
      <section class="peerRoomSection"><div class="peerRoomSectionHead"><div><span>ROOM</span><strong>Seats</strong></div><small>Host is always Player 1</small></div><div id="peerRoomSeats" class="peerRoomSeats"></div></section>
      <section class="peerRoomProjection"><div><span>FOG / PRIVATE PAYLOAD TEST</span><strong>Your private projection</strong><small>Each seat receives a different private token from the host.</small></div><code id="peerRoomProjectionValue">Waiting…</code><button id="peerRoomRotateProjection" type="button" hidden>Rotate test projections</button></section>
      <section class="peerRoomChat"><div class="peerRoomSectionHead"><div><span>ROOM CHAT</span><strong>Everyone in this room</strong></div><small>Relayed by the host over WebRTC</small></div><div id="peerRoomChatLog" class="peerRoomChatLog" role="log" aria-live="polite"></div><form id="peerRoomChatForm" class="peerRoomChatForm"><input id="peerRoomChatInput" maxlength="${PEER_ROOM_CHAT_CHARS}" autocomplete="off" inputmode="text" enterkeyhint="send" placeholder="Message room…" aria-label="Message room"><button type="submit">Send</button></form></section>
      <div class="peerRoomFooter"><button id="peerRoomCopyDiagnostics" type="button">Copy Room Diagnostics</button><button id="peerRoomLeave" class="duelLeaveButton" type="button">Leave Room</button></div>
    </div>`;
  entry.append(panel);
  mode.addEventListener('click',peerRoomOpen);
  peerRoomEl('peerRoomBack').addEventListener('click',peerRoomReturnHub);
  peerRoomEl('peerRoomCreate').addEventListener('click',peerRoomCreateHost);
  peerRoomEl('peerRoomCopy').addEventListener('click',peerRoomCopyInvite);
  peerRoomEl('peerRoomShare').addEventListener('click',peerRoomShareInvite);
  peerRoomEl('peerRoomRotateProjection').addEventListener('click',()=>{if(peerRoom.role==='host')peerRoomBroadcastProjections()});
  peerRoomEl('peerRoomChatForm').addEventListener('submit',peerRoomSubmitChat);
  peerRoomEl('peerRoomLeave').addEventListener('click',peerRoomLeave);
  peerRoomEl('peerRoomCopyDiagnostics').addEventListener('click',peerRoomCopyDiagnostics)
}
function peerRoomOpen(){
  try{directClosePeer({notify:true})}catch{};try{duelStopPolling()}catch{};try{duelClearActiveSession()}catch{};
  setMatchControllerMode('duel',{owner:H});setIntroScreen('duel');
  const hub=peerRoomEl('duelModeHub'),online=peerRoomEl('duelOnlinePanel'),direct=peerRoomEl('duelDirectPanel'),panel=peerRoomEl('peerRoomPanel');
  if(hub)hub.hidden=true;if(online)online.hidden=true;if(direct)direct.hidden=true;if(panel)panel.hidden=false;
  if(peerRoomEl('duelWaitingPanel'))peerRoomEl('duelWaitingPanel').hidden=true;
  peerRoomRender();queueFit()
}
function peerRoomReturnHub(){peerRoomShutdown({notify:true,clearPersistence:peerRoom.role==='host'});peerRoomClearHash();const panel=peerRoomEl('peerRoomPanel');if(panel)panel.hidden=true;openDuelHub()}

function peerRoomRender(){
  const start=peerRoomEl('peerRoomStart'),live=peerRoomEl('peerRoomLive'),invite=peerRoomEl('peerRoomInvite'),badge=peerRoomEl('peerRoomRoleBadge'),leave=peerRoomEl('peerRoomLeave'),rotate=peerRoomEl('peerRoomRotateProjection');
  if(start)start.hidden=peerRoom.active||peerRoom.role==='guest';if(live)live.hidden=!(peerRoom.active||peerRoom.role==='guest');
  if(invite)invite.hidden=peerRoom.role!=='host';
  if(badge)badge.textContent=peerRoom.role==='host'?'HOST · Player 1':peerRoom.role==='guest'?`GUEST · Player ${peerRoom.seat||'?'}`:'Prototype';
  if(leave)leave.textContent=peerRoom.role==='host'?'End Room':'Leave Room';if(rotate)rotate.hidden=peerRoom.role!=='host';
  peerRoomRenderRoster();peerRoomRenderChat()
}
function peerRoomRenderInvite(){
  const code=peerRoomEl('peerRoomCode'),field=peerRoomEl('peerRoomInviteLink'),qr=peerRoomEl('peerRoomQr');const link=peerRoomInviteLink();
  if(code)code.textContent=peerRoom.roomId||'------';if(field)field.value=link;if(qr){qr.innerHTML='';if(globalThis.QRCode){try{new QRCode(qr,{text:link,width:176,height:176,correctLevel:QRCode.CorrectLevel.L})}catch{qr.textContent='QR unavailable — use Copy Link.'}}else qr.textContent='QR unavailable — use Copy Link.'}
}
function peerRoomRenderRoster(state=peerRoomPublicState()){
  const root=peerRoomEl('peerRoomSeats');if(!root)return;root.innerHTML='';
  for(const seat of state.seats||[]){
    const card=document.createElement('div');card.className='peerRoomSeat';card.dataset.state=seat.connected?'online':seat.reserved?'reserved':'open';
    const copy=document.createElement('div');const kicker=document.createElement('span');kicker.textContent=`PLAYER ${seat.seat}`;const name=document.createElement('strong');name.textContent=seat.seat===1?'Host':seat.label||`Player ${seat.seat}`;const status=document.createElement('small');status.textContent=seat.connected?'Connected':seat.reserved?'Reserved · reconnecting':'Open seat';copy.append(kicker,name,status);card.append(copy);
    if(peerRoom.role==='host'&&seat.seat>1&&seat.reserved){const kick=document.createElement('button');kick.type='button';kick.textContent='Remove';kick.addEventListener('click',()=>peerRoomKickSeat(seat.seat));card.append(kick)}
    root.append(card)
  }
}
function peerRoomRenderProjection(projection){const el=peerRoomEl('peerRoomProjectionValue');if(!el)return;if(!projection){el.textContent='Waiting…';return}el.textContent=`Shared ${projection.shared} · Seat ${projection.seat} private ${projection.privateToken}`}
function peerRoomRenderChat(){
  const log=peerRoomEl('peerRoomChatLog');if(!log)return;const nearBottom=log.scrollHeight-log.scrollTop-log.clientHeight<72;log.innerHTML='';
  if(!peerRoom.chat.length){const empty=document.createElement('p');empty.className='peerRoomChatEmpty';empty.textContent='Room chat is ready.';log.append(empty)}
  for(const message of peerRoom.chat){const row=document.createElement('div');row.className=`peerRoomChatMessage${message.seat===peerRoom.seat?' mine':''}`;const meta=document.createElement('span');meta.textContent=`Player ${message.seat}`;const text=document.createElement('p');text.textContent=message.text;row.append(meta,text);log.append(row)}
  if(nearBottom)requestAnimationFrame(()=>{log.scrollTop=log.scrollHeight})
}
function peerRoomApplyPublicState(state){if(!state?.seats)return;peerRoom.roomId=state.roomId||peerRoom.roomId;peerRoom.roomVersion=state.roomVersion||peerRoom.roomVersion;peerRoom.seats=state.seats.map(s=>({...s,clientKey:''}));peerRoomRenderRoster(state)}

function peerRoomHostAssign(conn,clientKey){
  if(peerRoom.blocked.has(clientKey)){peerRoomSend(conn,{kind:'room-kicked',protocol:PEER_ROOM_PROTOCOL,reason:'Removed by host'});setTimeout(()=>{try{conn.close()}catch{}},40);return null}
  let seat=peerRoom.seatByClient.get(clientKey)||null;
  if(!seat){const open=peerRoom.seats.find(s=>s.seat>1&&!s.reserved);if(!open){peerRoomSend(conn,{kind:'room-full',protocol:PEER_ROOM_PROTOCOL});setTimeout(()=>{try{conn.close()}catch{}},40);return null}seat=open.seat;open.clientKey=clientKey;open.reserved=true;peerRoom.seatByClient.set(clientKey,seat)}
  const old=peerRoom.connections.get(seat);if(old&&old!==conn)try{old.close()}catch{}
  const record=peerRoom.seats.find(s=>s.seat===seat);record.connected=true;record.reserved=true;conn.__peerRoomSeat=seat;conn.__peerRoomClientKey=clientKey;peerRoom.connections.set(seat,conn);
  peerRoomSend(conn,{kind:'room-welcome',protocol:PEER_ROOM_PROTOCOL,seat,roomId:peerRoom.roomId,state:peerRoomPublicState(),projection:peerRoomProjectionFor(seat),chat:peerRoom.chat.slice(-PEER_ROOM_CHAT_MAX)});
  peerRoomBroadcastState();peerRoomStatus(`Player ${seat} connected.`,'ok');return seat
}
function peerRoomHostBind(conn){
  conn.on('open',()=>peerRoomStatus('Peer connected. Assigning a seat…'));
  conn.on('data',data=>peerRoomHostMessage(conn,data));
  conn.on('close',()=>{const seat=conn.__peerRoomSeat;if(!seat)return;if(peerRoom.connections.get(seat)===conn)peerRoom.connections.delete(seat);const record=peerRoom.seats.find(s=>s.seat===seat);if(record)record.connected=false;peerRoomBroadcastState();peerRoomStatus(`Player ${seat} disconnected. Their seat is reserved for reconnect.`,'warn')});
  conn.on('error',()=>peerRoomStatus('A guest WebRTC connection reported an error.','warn'))
}
function peerRoomHostMessage(conn,data){
  if(!data||typeof data!=='object'||data.protocol!==PEER_ROOM_PROTOCOL)return;
  if(data.kind==='room-join'){
    const key=String(data.clientKey||'');if(!/^[A-Za-z0-9_-]{12,80}$/.test(key)){peerRoomSend(conn,{kind:'room-kicked',protocol:PEER_ROOM_PROTOCOL,reason:'Invalid client identity'});return}peerRoomHostAssign(conn,key);return
  }
  const seat=conn.__peerRoomSeat;if(!seat)return;
  if(data.kind==='room-chat-submit'){peerRoomHostAppendChat(seat,data.text,data.id);return}
  if(data.kind==='room-leave'){peerRoomHostReleaseSeat(seat,{block:false});try{conn.close()}catch{};return}
  if(data.kind==='room-ping')peerRoomSend(conn,{kind:'room-pong',protocol:PEER_ROOM_PROTOCOL,at:Date.now()})
}
function peerRoomHostAppendChat(seat,value,id=''){
  const text=peerRoomNormalizeText(value);if(!text)return;const message={id:/^[A-Za-z0-9_-]{6,80}$/.test(String(id))?String(id):`rmsg_${peerRoomRandom(12)}`,seat,text,at:Date.now()};
  peerRoom.chat.push(message);if(peerRoom.chat.length>PEER_ROOM_CHAT_MAX)peerRoom.chat.splice(0,peerRoom.chat.length-PEER_ROOM_CHAT_MAX);peerRoomBroadcast({kind:'room-chat',protocol:PEER_ROOM_PROTOCOL,message});peerRoomPersistHost();peerRoomRenderChat()
}
function peerRoomHostReleaseSeat(seat,{block=false}={}){
  if(seat<=1)return;const record=peerRoom.seats.find(s=>s.seat===seat);if(!record)return;const key=record.clientKey;if(block&&key)peerRoom.blocked.add(key);if(key)peerRoom.seatByClient.delete(key);const conn=peerRoom.connections.get(seat);peerRoom.connections.delete(seat);record.connected=false;record.reserved=false;record.clientKey='';if(conn&&block)peerRoomSend(conn,{kind:'room-kicked',protocol:PEER_ROOM_PROTOCOL,reason:'Removed by host'});peerRoomBroadcastState();peerRoomPersistHost()
}
function peerRoomKickSeat(seat){peerRoomHostReleaseSeat(Number(seat),{block:true});const conn=peerRoom.connections.get(Number(seat));if(conn)try{conn.close()}catch{};peerRoomStatus(`Player ${seat} removed from this room.`,'warn')}

function peerRoomCreateHost(){
  peerRoomShutdown({notify:false,clearPersistence:false});peerRoom.intentionalClose=false;peerRoom.role='host';peerRoom.seat=1;peerRoom.clientKey='HOST';peerRoom.roomId=peerRoomRandom(6);peerRoom.hostId=`c4r-${peerRoom.roomId.toLowerCase()}-${peerRoomRandom(8).toLowerCase()}`;peerRoom.seats=peerRoomDefaultSeats();peerRoom.privateTokens=peerRoomFreshPrivateTokens();peerRoom.chat=[];peerRoom.roomVersion=1;peerRoom.projectionVersion=1;peerRoom.seatByClient=new Map();peerRoom.connections=new Map();peerRoom.blocked=new Set();peerRoomOpen();peerRoomRender();peerRoomStatus('Opening host rendezvous…');
  if(!globalThis.Peer){peerRoomStatus('PeerJS pairing library is unavailable. Refresh and try again.','error');return}
  try{
    const peer=new Peer(peerRoom.hostId,{debug:0,config:peerRoomConnectionConfig()});peerRoom.peer=peer;
    peer.on('open',id=>{peerRoom.active=true;peerRoom.hostId=id;peerRoomSetHash(PEER_ROOM_HOST_PARAM,id);peerRoomRender();peerRoomRenderInvite();peerRoomRenderProjection(peerRoomProjectionFor(1));peerRoomPersistHost();peerRoomStatus('Room is live. Share one invite with up to three players.','ok')});
    peer.on('connection',peerRoomHostBind);
    peer.on('disconnected',()=>{peerRoomStatus('Rendezvous connection paused. Existing WebRTC guests can stay connected; reconnecting broker…','warn');try{peer.reconnect()}catch{}});
    peer.on('error',error=>peerRoomStatus(error?.type==='unavailable-id'?'That room identity is still active elsewhere. Close the older host tab, then reload this page.':error?.message||'Could not create Peer Room.','error'))
  }catch(error){peerRoomStatus(error?.message||'Could not create Peer Room.','error')}
}
function peerRoomRestoreHost(snapshot){
  if(!snapshot?.hostId)return;peerRoomShutdown({notify:false,clearPersistence:false});peerRoom.intentionalClose=false;peerRoom.role='host';peerRoom.seat=1;peerRoom.clientKey='HOST';peerRoom.hostId=snapshot.hostId;peerRoom.roomId=snapshot.roomId;peerRoom.roomVersion=snapshot.roomVersion||1;peerRoom.projectionVersion=snapshot.projectionVersion||1;peerRoom.privateTokens=snapshot.privateTokens||peerRoomFreshPrivateTokens();peerRoom.chat=Array.isArray(snapshot.chat)?snapshot.chat.slice(-PEER_ROOM_CHAT_MAX):[];peerRoom.seats=peerRoomDefaultSeats();peerRoom.seatByClient=new Map();
  for(const saved of snapshot.seats||[]){if(saved.seat<=1||saved.seat>PEER_ROOM_MAX_SEATS||!saved.clientKey)continue;const rec=peerRoom.seats.find(s=>s.seat===saved.seat);rec.clientKey=saved.clientKey;rec.reserved=!!saved.reserved;rec.connected=false;if(rec.reserved)peerRoom.seatByClient.set(rec.clientKey,rec.seat)}
  peerRoomOpen();peerRoomRender();peerRoomStatus('Restoring host room after reload…','warn');
  if(!globalThis.Peer){peerRoomStatus('PeerJS pairing library is unavailable.','error');return}
  const peer=new Peer(peerRoom.hostId,{debug:0,config:peerRoomConnectionConfig()});peerRoom.peer=peer;peer.on('open',id=>{peerRoom.active=true;peerRoomRender();peerRoomRenderInvite();peerRoomRenderProjection(peerRoomProjectionFor(1));peerRoomPersistHost();peerRoomStatus('Host room restored. Reserved guests can reconnect to their previous seats.','ok')});peer.on('connection',peerRoomHostBind);peer.on('disconnected',()=>{try{peer.reconnect()}catch{}});peer.on('error',error=>peerRoomStatus(error?.message||'Host room could not be restored.','error'))
}

function peerRoomGuestBind(conn){
  peerRoom.conn=conn;
  conn.on('open',()=>{peerRoom.active=true;peerRoomStatus('Connected to host. Claiming your seat…');peerRoomSend(conn,{kind:'room-join',protocol:PEER_ROOM_PROTOCOL,clientKey:peerRoom.clientKey})});
  conn.on('data',peerRoomGuestMessage);
  conn.on('close',()=>{if(peerRoom.intentionalClose)return;peerRoom.active=false;peerRoomStatus('Connection interrupted. Reconnecting to the host…','warn');peerRoomScheduleReconnect()});
  conn.on('error',()=>{if(!peerRoom.intentionalClose){peerRoomStatus('WebRTC connection error. Retrying…','warn');peerRoomScheduleReconnect()}})
}
function peerRoomGuestConnect(){
  if(peerRoom.intentionalClose||peerRoom.role!=='guest'||!peerRoom.hostId||!peerRoom.peer)return;
  if(peerRoom.conn?.open)return;
  try{if(peerRoom.peer.disconnected)peerRoom.peer.reconnect()}catch{}
  try{const conn=peerRoom.peer.connect(peerRoom.hostId,{reliable:true,serialization:'json',metadata:{protocol:PEER_ROOM_PROTOCOL,clientKey:peerRoom.clientKey}});peerRoomGuestBind(conn)}catch{peerRoomScheduleReconnect()}
}
function peerRoomScheduleReconnect(){if(peerRoom.intentionalClose||peerRoom.reconnectTimer)return;peerRoom.reconnectTimer=setTimeout(()=>{peerRoom.reconnectTimer=null;peerRoomGuestConnect()},PEER_ROOM_RECONNECT_MS)}
function peerRoomGuestMessage(data){
  if(!data||typeof data!=='object'||data.protocol!==PEER_ROOM_PROTOCOL)return;
  if(data.kind==='room-welcome'){peerRoom.seat=data.seat;peerRoom.roomId=data.roomId||peerRoom.roomId;peerRoom.chat=Array.isArray(data.chat)?data.chat.slice(-PEER_ROOM_CHAT_MAX):[];peerRoomApplyPublicState(data.state);peerRoomRenderProjection(data.projection);peerRoomRender();peerRoomStatus(`Connected as Player ${peerRoom.seat}.`,'ok');return}
  if(data.kind==='room-state'){peerRoomApplyPublicState(data.state);return}
  if(data.kind==='room-projection'){peerRoomRenderProjection(data.projection);return}
  if(data.kind==='room-chat'){const m=data.message;if(m&&peerRoomNormalizeText(m.text)){peerRoom.chat.push({id:String(m.id||''),seat:Number(m.seat)||0,text:peerRoomNormalizeText(m.text),at:Number(m.at)||Date.now()});if(peerRoom.chat.length>PEER_ROOM_CHAT_MAX)peerRoom.chat.shift();peerRoomRenderChat()}return}
  if(data.kind==='room-full'){peerRoom.intentionalClose=true;peerRoomStatus('This Peer Room is full.','error');try{peerRoom.conn?.close()}catch{};return}
  if(data.kind==='room-kicked'){peerRoom.intentionalClose=true;peerRoomStatus(data.reason||'Removed from the room.','error');try{peerRoom.conn?.close()}catch{};return}
  if(data.kind==='room-ended'){peerRoom.intentionalClose=true;peerRoomStatus('Host ended the Peer Room.','warn');try{peerRoom.conn?.close()}catch{};return}
}
function peerRoomJoin(hostId){
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(String(hostId||'')))return;peerRoomShutdown({notify:false,clearPersistence:false});peerRoom.intentionalClose=false;peerRoom.role='guest';peerRoom.hostId=String(hostId);peerRoom.clientKey=peerRoomClientKey();peerRoom.seats=peerRoomDefaultSeats().map(s=>({...s,connected:false,reserved:false,clientKey:''}));peerRoomOpen();peerRoomRender();peerRoomStatus('Connecting directly to the host browser…');
  if(!globalThis.Peer){peerRoomStatus('PeerJS pairing library is unavailable. Refresh and try again.','error');return}
  try{const peer=new Peer(undefined,{debug:0,config:peerRoomConnectionConfig()});peerRoom.peer=peer;peer.on('open',peerRoomGuestConnect);peer.on('disconnected',()=>{if(!peerRoom.intentionalClose){try{peer.reconnect()}catch{};peerRoomScheduleReconnect()}});peer.on('error',error=>{if(!peerRoom.intentionalClose){peerRoomStatus(error?.message||'Could not reach the host. Retrying…','warn');peerRoomScheduleReconnect()}})}catch(error){peerRoomStatus(error?.message||'Could not join Peer Room.','error')}
}

function peerRoomSubmitChat(event){event?.preventDefault?.();const input=peerRoomEl('peerRoomChatInput');if(!input)return;const text=peerRoomNormalizeText(input.value);if(!text)return;input.value='';const id=`rmsg_${peerRoomRandom(12)}`;if(peerRoom.role==='host')peerRoomHostAppendChat(1,text,id);else if(peerRoom.role==='guest'&&peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-chat-submit',protocol:PEER_ROOM_PROTOCOL,id,text})}
async function peerRoomCopyInvite(){const link=peerRoomInviteLink();try{await navigator.clipboard.writeText(link);peerRoomStatus('Invite link copied.','ok')}catch{const field=peerRoomEl('peerRoomInviteLink');field?.focus();field?.select();peerRoomStatus('Select and copy the invite link.','warn')}}
async function peerRoomShareInvite(){const link=peerRoomInviteLink();if(navigator.share){try{await navigator.share({title:'Clash 4 Peer Room',text:'Join my Clash 4 Peer Room',url:link});return}catch{}}await peerRoomCopyInvite()}
async function peerRoomCopyDiagnostics(){const lines=[`Clash 4 Peer Room ${PEER_ROOM_VERSION}`,`Role: ${peerRoom.role||'none'}`,`Seat: ${peerRoom.seat||'none'}`,`Room: ${peerRoom.roomId||'none'}`,`Host peer: ${peerRoom.hostId||'none'}`,`Active: ${peerRoom.active}`,`Seats: ${peerRoom.seats.map(s=>`${s.seat}:${s.connected?'online':s.reserved?'reserved':'open'}`).join(', ')}`,`Projection version: ${peerRoom.projectionVersion}`];try{await navigator.clipboard.writeText(lines.join('\n'));peerRoomStatus('Room diagnostics copied.','ok')}catch{peerRoomStatus(lines.join(' · '))}}

function peerRoomShutdown({notify=false,clearPersistence=false}={}){
  peerRoom.intentionalClose=true;if(peerRoom.reconnectTimer)clearTimeout(peerRoom.reconnectTimer);peerRoom.reconnectTimer=null;
  if(peerRoom.role==='host'&&notify)peerRoomBroadcast({kind:'room-ended',protocol:PEER_ROOM_PROTOCOL});
  if(peerRoom.role==='guest'&&notify&&peerRoom.conn?.open)peerRoomSend(peerRoom.conn,{kind:'room-leave',protocol:PEER_ROOM_PROTOCOL});
  for(const conn of peerRoom.connections.values())try{conn.close()}catch{};try{peerRoom.conn?.close()}catch{};try{peerRoom.peer?.destroy()}catch{};
  if(clearPersistence)peerRoomSafeStorageRemove(PEER_ROOM_HOST_STORAGE);
  peerRoom.active=false;peerRoom.role=null;peerRoom.peer=null;peerRoom.conn=null;peerRoom.hostId='';peerRoom.roomId='';peerRoom.seat=null;peerRoom.connections=new Map();peerRoom.seatByClient=new Map();peerRoom.seats=[];peerRoom.chat=[];peerRoom.blocked=new Set();peerRoom.privateTokens={};peerRoom.intentionalClose=false
}
function peerRoomLeave(){const wasHost=peerRoom.role==='host';peerRoomShutdown({notify:true,clearPersistence:wasHost});peerRoomClearHash();const panel=peerRoomEl('peerRoomPanel');if(panel)panel.hidden=true;openDuelHub()}
function peerRoomLifecycleResume(){if(document.hidden||peerRoom.intentionalClose)return;if(peerRoom.role==='guest'){if(!peerRoom.conn?.open)peerRoomScheduleReconnect();else peerRoomSend(peerRoom.conn,{kind:'room-ping',protocol:PEER_ROOM_PROTOCOL,at:Date.now()})}else if(peerRoom.role==='host'&&peerRoom.peer?.disconnected){try{peerRoom.peer.reconnect()}catch{}}}

function peerRoomInstall(){
  peerRoomCreateStaticUi();
  const directMode=peerRoomEl('duelDirectMode'),onlineMode=peerRoomEl('duelOnlineMode'),passMode=peerRoomEl('duelPassMode');for(const button of [directMode,onlineMode,passMode])button?.addEventListener('click',()=>{const panel=peerRoomEl('peerRoomPanel');if(panel)panel.hidden=true});
  document.addEventListener('visibilitychange',peerRoomLifecycleResume);window.addEventListener('pageshow',peerRoomLifecycleResume);window.addEventListener('online',peerRoomLifecycleResume);window.addEventListener('focus',peerRoomLifecycleResume);
  const guestId=peerRoomReadHashParam(PEER_ROOM_JOIN_PARAM),hostId=peerRoomReadHashParam(PEER_ROOM_HOST_PARAM);
  if(guestId)setTimeout(()=>peerRoomJoin(guestId),0);else if(hostId){const snapshot=peerRoomReadHostSnapshot(hostId);if(snapshot)setTimeout(()=>peerRoomRestoreHost(snapshot),0)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',peerRoomInstall,{once:true});else peerRoomInstall();

globalThis.peerRoomFoundation={version:PEER_ROOM_VERSION,create:peerRoomCreateHost,join:peerRoomJoin,leave:peerRoomLeave,rotateProjection:peerRoomBroadcastProjections};
