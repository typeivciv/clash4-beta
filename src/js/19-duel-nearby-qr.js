// Nearby Direct Duel one-scan UX using PeerJS Cloud only for connection brokering.
// The QR carries the host peer ID in a Clash 4 HTTPS deep link. After the WebRTC data
// connection opens, PeerJS signaling is disconnected and gameplay remains peer-to-peer.
'use strict';
const DIRECT_PEER_JOIN_PARAM='c4peer';
const DIRECT_PEER_TIMEOUT_MS=90_000;
let directPeerSession={peer:null,conn:null,role:null,opened:false,deadline:0,timer:null,lastIce:'new',lastConnection:'new'};

// Keep host/LAN candidates and broaden STUN discovery. This still prefers a true direct
// connection; it does not add a relay/TURN server or put game traffic on a backend.
try{
  const urls=DIRECT_RTC_CONFIG?.iceServers?.[0]?.urls;
  if(Array.isArray(urls)&&!urls.includes('stun:stun.cloudflare.com:3478'))urls.push('stun:stun.cloudflare.com:3478')
}catch{}

function directPeerReset(){
  if(directPeerSession.timer)clearTimeout(directPeerSession.timer);
  try{directPeerSession.conn?.close()}catch{}
  try{directPeerSession.peer?.destroy()}catch{}
  directPeerSession={peer:null,conn:null,role:null,opened:false,deadline:0,timer:null,lastIce:'new',lastConnection:'new'}
}
function directNearbyManualUi(show){
  const label=directEl('duelDirectSignal')?.closest('.duelSignalLabel'),actions=directEl('duelDirectCopy')?.parentElement,accept=directEl('duelDirectAcceptRow');
  if(label)label.hidden=!show;if(actions)actions.hidden=!show;if(accept)accept.hidden=!show
}
function directRefreshInviteUi(show){
  const row=directEl('duelDirectRefreshRow'),button=directEl('duelDirectRefreshInvite');
  if(row)row.hidden=!show;if(button){button.disabled=false;button.textContent='Refresh Invite'}
}
function directNearbyStage({title,copy,status,showQr=true}){
  directEl('duelDirectActions').hidden=true;directEl('duelDirectStage').hidden=false;directNearbyManualUi(false);
  const titleEl=directEl('duelDirectStageTitle'),copyEl=directEl('duelDirectStageCopy'),qr=directEl('duelDirectQr');
  if(titleEl)titleEl.textContent=title;if(copyEl)copyEl.textContent=copy;if(qr)qr.hidden=!showQr;directSetStatus(status||'');queueFit()
}
function directNearbyJoinLink(peerId){return `${location.origin}${location.pathname}${location.search}#${DIRECT_PEER_JOIN_PARAM}=${encodeURIComponent(peerId)}`}
function directReadNearbyPeerId(){
  const raw=String(location.hash||'').replace(/^#/,'');if(!raw)return'';
  const value=new URLSearchParams(raw).get(DIRECT_PEER_JOIN_PARAM)||'';
  return /^[A-Za-z0-9_-]{1,128}$/.test(value)?value:''
}
function directClearNearbyHash(){
  if(!location.hash.includes(`${DIRECT_PEER_JOIN_PARAM}=`))return;
  try{history.replaceState(null,'',`${location.pathname}${location.search}`)}catch{}
}
function directPeerErrorMessage(error){
  const type=String(error?.type||'');
  if(type==='peer-unavailable')return 'Player 1’s invite is no longer available. Player 1 should refresh the Direct invite and send the new QR or link.';
  if(type==='network'||type==='server-error'||type==='socket-error'||type==='socket-closed')return 'Could not reach the temporary Direct pairing broker. Check internet access, then refresh the invite and try again.';
  if(type==='browser-incompatible')return 'This browser does not support the WebRTC features needed for Direct Duel.';
  if(type==='webrtc')return directPeerRouteFailureMessage();
  return error?.message||'Direct pairing failed before a connection could open.'
}
function directPeerRouteFailureMessage(){
  const ice=directPeerSession.lastIce||'unknown',connection=directPeerSession.lastConnection||'unknown';
  return `Player 1 was found, but the phones could not establish the direct WebRTC route (ICE: ${ice}, connection: ${connection}). Try both phones on the same non-guest Wi-Fi and disable VPN/Private Relay. If it still fails, this network needs a TURN relay or Online Room fallback.`
}
function directSetPeerRole(role){
  directDuel.role=role;directDuel.pairing='nearby';directDuel.seat=role==='host'?H:A;duelSession.seat=directDuel.seat;directPeerSession.role=role
}
function directPeerChannelAdapter(conn){
  const channel={readyState:'connecting',onopen:null,onmessage:null,onclose:null,onerror:null,
    send(value){conn.send(value)},close(){try{conn.close()}catch{}}};
  conn.on('open',()=>{channel.readyState='open';directPeerSession.opened=true;if(directPeerSession.timer)clearTimeout(directPeerSession.timer);directRefreshInviteUi(false);channel.onopen?.();
    // Existing P2P connections stay alive after PeerJS signaling disconnects.
    try{directPeerSession.peer?.disconnect()}catch{}
  });
  conn.on('data',data=>channel.onmessage?.({data:typeof data==='string'?data:JSON.stringify(data)}));
  conn.on('close',()=>{channel.readyState='closed';channel.onclose?.()});
  conn.on('error',error=>channel.onerror?.(error));
  return channel
}
function directObservePeerConnection(conn){
  const pc=conn?.peerConnection;if(!pc)return;
  const update=()=>{
    directPeerSession.lastIce=pc.iceConnectionState||directPeerSession.lastIce;
    directPeerSession.lastConnection=pc.connectionState||directPeerSession.lastConnection;
    if(directPeerSession.opened)return;
    if(pc.iceConnectionState==='checking')directSetStatus('Player found. Checking direct network paths…');
    if(pc.iceConnectionState==='connected'||pc.iceConnectionState==='completed')directSetStatus('Direct network path found. Opening the game connection…');
    if(pc.iceConnectionState==='failed'||pc.connectionState==='failed'){
      directConnectionBadge('error','Direct route blocked');
      directSetStatus(directPeerRouteFailureMessage(),{error:true})
    }
  };
  pc.addEventListener?.('iceconnectionstatechange',update);pc.addEventListener?.('connectionstatechange',update);update()
}
function directBindPeerJsConnection(conn){
  if(directPeerSession.conn&&directPeerSession.conn!==conn){try{conn.close()}catch{};return}
  directPeerSession.conn=conn;directDuel.pc={close(){directPeerReset()}};
  const channel=directPeerChannelAdapter(conn);directBindChannel(channel);
  // Replace the core's deliberately generic channel error with actionable Nearby diagnostics.
  channel.onerror=error=>{
    directConnectionBadge('error','Direct route failed');
    directSetStatus(directPeerErrorMessage(error),{error:true})
  };
  directObservePeerConnection(conn);directSetStatus('Peer found. Establishing the direct connection…')
}
function directExpireHostInvite(){
  const qr=directEl('duelDirectQr'),field=directEl('duelDirectSignal');
  directPeerReset();
  if(qr){qr.innerHTML='';qr.hidden=true}if(field)field.value='';
  directNearbyStage({title:'Invite expired',copy:'No player joined within 90 seconds. Refresh the invite to generate a new QR code and share link.',status:'This QR and link have expired. Refresh before Player 2 joins.',showQr:false});
  directRefreshInviteUi(true)
}
function directCreatePeer(role){
  if(!globalThis.Peer)throw new Error('Nearby pairing library did not load. Refresh and try again.');
  directSetPeerRole(role);
  const peer=new Peer(undefined,{debug:0,config:DIRECT_RTC_CONFIG});directPeerSession.peer=peer;directPeerSession.deadline=Date.now()+DIRECT_PEER_TIMEOUT_MS;
  peer.on('error',error=>{if(directPeerSession.opened)return;directConnectionBadge('error','Pairing failed');directSetStatus(directPeerErrorMessage(error),{error:true})});
  peer.on('disconnected',()=>{if(!directPeerSession.opened)directConnectionBadge('offline','Pairing interrupted')});
  directPeerSession.timer=setTimeout(()=>{if(!directPeerSession.opened){
    const role=directPeerSession.role,sawIce=directPeerSession.lastIce&&directPeerSession.lastIce!=='new';
    directConnectionBadge('error','Pairing timed out');
    if(role==='host'&&!sawIce){directExpireHostInvite();return}
    directSetStatus(sawIce?directPeerRouteFailureMessage():'Direct pairing timed out before the phones found each other. Ask Player 1 to refresh the invite and try again.',{error:true});directPeerReset();directRefreshInviteUi(false)
  }},DIRECT_PEER_TIMEOUT_MS);
  return peer
}

const directClosePeerBeforePeerJs=directClosePeer;
directClosePeer=function(options={}){directRefreshInviteUi(false);directPeerReset();return directClosePeerBeforePeerJs(options)};
globalThis.directClosePeer=directClosePeer;

async function directCreateNearby(){
  directOpenPanel();directRefreshInviteUi(false);directPeerReset();directDuel.pairing='nearby';
  directNearbyStage({title:'Preparing one-scan invite…',copy:'Player 2 will scan one QR with the normal Camera app. No return QR or service URL is required.',status:'Connecting to the temporary pairing broker…',showQr:false});
  try{
    const peer=directCreatePeer('host');
    peer.on('connection',conn=>directBindPeerJsConnection(conn));
    peer.on('open',id=>{
      const link=directNearbyJoinLink(id),qr=directEl('duelDirectQr'),field=directEl('duelDirectSignal');
      if(field)field.value=link;if(qr){qr.hidden=false;directRenderQr(link)}
      directRefreshInviteUi(false);
      directNearbyStage({title:'Player 2 · Scan once to join',copy:'Player 2: use the normal Camera app, scan this QR, and tap the Clash 4 link. Both phones will connect automatically.',status:'Waiting for Player 2 to scan…',showQr:true});
      if(!globalThis.QRCode)directNearbyManualUi(true)
    })
  }catch(e){directConnectionBadge('error','Pairing failed');directSetStatus(directPeerErrorMessage(e),{error:true});directPeerReset()}
}
globalThis.directCreateNearby=directCreateNearby;
function directRefreshNearbyInvite(){
  if(directDuel?.active)return;
  const button=directEl('duelDirectRefreshInvite');if(button){button.disabled=true;button.textContent='Refreshing…'}
  directCreateNearby()
}
globalThis.directRefreshNearbyInvite=directRefreshNearbyInvite;

async function directJoinNearbyFromPeerId(hostPeerId){
  directOpenPanel();directRefreshInviteUi(false);directPeerReset();
  directNearbyStage({title:'Joining Player 1…',copy:'Clash 4 is connecting directly to Player 1. Keep this screen open.',status:'Opening the peer-to-peer connection…',showQr:false});
  try{
    const peer=directCreatePeer('guest');
    peer.on('open',()=>{
      directSetStatus('Pairing broker connected. Finding Player 1…');
      const conn=peer.connect(hostPeerId,{reliable:true,serialization:'json'});directBindPeerJsConnection(conn)
    })
  }catch(e){directConnectionBadge('error','Pairing failed');directSetStatus(directPeerErrorMessage(e),{error:true});directPeerReset()}
}
async function directHandleNearbyLaunch(){
  const peerId=directReadNearbyPeerId();if(!peerId)return false;directClearNearbyHash();await directJoinNearbyFromPeerId(peerId);return true
}

const directCreateManual=directCreate;
directCreate=async function(pairing='nearby'){return pairing==='nearby'?directCreateNearby():directCreateManual(pairing)};
globalThis.directCreate=directCreate;

function directBootNearbyPeerUx(){setTimeout(()=>directHandleNearbyLaunch(),0)}
globalThis.directNearbyJoinLink=directNearbyJoinLink;
globalThis.directHandleNearbyLaunch=directHandleNearbyLaunch;
globalThis.directBootNearbyPeerUx=directBootNearbyPeerUx;
directEl('duelDirectRefreshInvite')?.addEventListener('click',directRefreshNearbyInvite);
directBootNearbyPeerUx();