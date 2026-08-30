// Nearby Direct Duel one-scan UX using PeerJS Cloud only for connection brokering.
// The QR carries the host peer ID in a Clash 4 HTTPS deep link. After the WebRTC data
// connection opens, PeerJS signaling is disconnected and gameplay remains peer-to-peer.
'use strict';
const DIRECT_PEER_JOIN_PARAM='c4peer';
const DIRECT_PEER_TIMEOUT_MS=90_000;
let directPeerSession={peer:null,conn:null,role:null,opened:false,deadline:0,timer:null};

function directPeerReset(){
  if(directPeerSession.timer)clearTimeout(directPeerSession.timer);
  try{directPeerSession.conn?.close()}catch{}
  try{directPeerSession.peer?.destroy()}catch{}
  directPeerSession={peer:null,conn:null,role:null,opened:false,deadline:0,timer:null}
}
function directNearbyManualUi(show){
  const label=directEl('duelDirectSignal')?.closest('.duelSignalLabel'),actions=directEl('duelDirectCopy')?.parentElement,accept=directEl('duelDirectAcceptRow');
  if(label)label.hidden=!show;if(actions)actions.hidden=!show;if(accept)accept.hidden=!show
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
  if(type==='peer-unavailable')return 'That Nearby invite is no longer available. Ask Player 1 to create a new QR.';
  if(type==='network'||type==='server-error'||type==='socket-error'||type==='socket-closed')return 'Could not reach the Nearby pairing broker. Check internet access and try again.';
  if(type==='browser-incompatible')return 'This browser cannot create the Direct WebRTC connection.';
  return error?.message||'Nearby pairing failed.'
}
function directSetPeerRole(role){
  directDuel.role=role;directDuel.pairing='nearby';directDuel.seat=role==='host'?H:A;duelSession.seat=directDuel.seat;directPeerSession.role=role
}
function directPeerChannelAdapter(conn){
  const channel={readyState:'connecting',onopen:null,onmessage:null,onclose:null,onerror:null,
    send(value){conn.send(value)},close(){try{conn.close()}catch{}}};
  conn.on('open',()=>{channel.readyState='open';directPeerSession.opened=true;channel.onopen?.();
    // PeerJS documents that existing P2P connections remain alive after disconnecting
    // from the signaling server, so remove signaling from the match path immediately.
    try{directPeerSession.peer?.disconnect()}catch{}
  });
  conn.on('data',data=>channel.onmessage?.({data:typeof data==='string'?data:JSON.stringify(data)}));
  conn.on('close',()=>{channel.readyState='closed';channel.onclose?.()});
  conn.on('error',error=>channel.onerror?.(error));
  return channel
}
function directBindPeerJsConnection(conn){
  if(directPeerSession.conn&&directPeerSession.conn!==conn){try{conn.close()}catch{};return}
  directPeerSession.conn=conn;directDuel.pc={close(){directPeerReset()}};directBindChannel(directPeerChannelAdapter(conn));
  directSetStatus('Peer found. Establishing the direct connection…')
}
function directCreatePeer(role){
  if(!globalThis.Peer)throw new Error('Nearby pairing library did not load. Refresh and try again.');
  directSetPeerRole(role);
  const peer=new Peer(undefined,{debug:0,config:DIRECT_RTC_CONFIG});directPeerSession.peer=peer;directPeerSession.deadline=Date.now()+DIRECT_PEER_TIMEOUT_MS;
  peer.on('error',error=>{if(directPeerSession.opened)return;directSetStatus(directPeerErrorMessage(error),{error:true})});
  peer.on('disconnected',()=>{if(!directPeerSession.opened)directConnectionBadge('offline','Pairing interrupted')});
  directPeerSession.timer=setTimeout(()=>{if(!directPeerSession.opened){directSetStatus('Nearby pairing timed out. Create a new QR and try again.',{error:true});directPeerReset()}},DIRECT_PEER_TIMEOUT_MS);
  return peer
}

const directClosePeerBeforePeerJs=directClosePeer;
directClosePeer=function(options={}){directPeerReset();return directClosePeerBeforePeerJs(options)};
globalThis.directClosePeer=directClosePeer;

async function directCreateNearby(){
  directOpenPanel();directPeerReset();directDuel.pairing='nearby';
  directNearbyStage({title:'Preparing one-scan invite…',copy:'Player 2 will scan one QR with the normal Camera app. No return QR or service URL is required.',status:'Connecting to the temporary pairing broker…',showQr:false});
  try{
    const peer=directCreatePeer('host');
    peer.on('connection',conn=>directBindPeerJsConnection(conn));
    peer.on('open',id=>{
      const link=directNearbyJoinLink(id),qr=directEl('duelDirectQr'),field=directEl('duelDirectSignal');
      if(field)field.value=link;if(qr){qr.hidden=false;directRenderQr(link)}
      directNearbyStage({title:'Player 2 · Scan once to join',copy:'Player 2: use the normal Camera app, scan this QR, and tap the Clash 4 link. Both phones will connect automatically.',status:'Waiting for Player 2 to scan…',showQr:true});
      if(!globalThis.QRCode)directNearbyManualUi(true)
    })
  }catch(e){directSetStatus(directPeerErrorMessage(e),{error:true});directPeerReset()}
}
globalThis.directCreateNearby=directCreateNearby;

async function directJoinNearbyFromPeerId(hostPeerId){
  directOpenPanel();directPeerReset();
  directNearbyStage({title:'Joining Player 1…',copy:'Clash 4 is connecting directly to Player 1. Keep this screen open.',status:'Opening the peer-to-peer connection…',showQr:false});
  try{
    const peer=directCreatePeer('guest');
    peer.on('open',()=>{
      const conn=peer.connect(hostPeerId,{reliable:true,serialization:'json'});directBindPeerJsConnection(conn)
    })
  }catch(e){directSetStatus(directPeerErrorMessage(e),{error:true});directPeerReset()}
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
directBootNearbyPeerUx();
