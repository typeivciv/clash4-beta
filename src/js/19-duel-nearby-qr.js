// Nearby Direct Duel one-scan UX.
// A tiny HTTP signaling service exchanges only the WebRTC offer/answer. Once the DataChannel
// opens, gameplay is peer-to-peer and the service is no longer on the match path.
'use strict';
const DIRECT_JOIN_PARAM='c4join';
const DIRECT_SIGNAL_POLL_MS=450;
const DIRECT_SIGNAL_TIMEOUT_MS=2*60*1000;
let directSignalSession={server:'',id:'',hostToken:'',joinToken:'',pollTimer:null,deadline:0};

function directSignalDescriptorEncode(value){return bytesToB64Url(new TextEncoder().encode(JSON.stringify(value)))}
function directSignalDescriptorDecode(value){try{return JSON.parse(new TextDecoder().decode(b64UrlToBytes(value)))}catch{return null}}
function directSignalServer(){return normalizeDuelServer(duelSession.server||initialDuelServer())}
function directNearbyJoinLink({server,id,joinToken}){
  const descriptor=directSignalDescriptorEncode({v:1,server:normalizeDuelServer(server),id,joinToken});
  return `${location.origin}${location.pathname}#${DIRECT_JOIN_PARAM}=${descriptor}`
}
function directReadNearbyJoin(){
  const raw=String(location.hash||'').replace(/^#/,'');if(!raw)return null;
  const params=new URLSearchParams(raw),encoded=params.get(DIRECT_JOIN_PARAM);if(!encoded)return null;
  const value=directSignalDescriptorDecode(encoded);if(!value||value.v!==1||!value.server||!value.id||!value.joinToken)return null;
  const server=normalizeDuelServer(value.server);if(!/^https:\/\//i.test(server)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(server))return null;
  return{server,id:String(value.id).toUpperCase(),joinToken:String(value.joinToken)}
}
function directClearNearbyJoinHash(){
  if(!location.hash.includes(`${DIRECT_JOIN_PARAM}=`))return;
  try{history.replaceState(null,'',`${location.pathname}${location.search}`)}catch{}
}
async function directSignalRequest(server,path,{method='GET',token='',body=null}={}){
  const headers={'content-type':'application/json'};if(token)headers.authorization=`Bearer ${token}`;
  const response=await fetch(normalizeDuelServer(server)+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok){const error=new Error(data.error||`http-${response.status}`);error.status=response.status;throw error}
  return data
}
function directStopSignalPolling(){if(directSignalSession.pollTimer)clearTimeout(directSignalSession.pollTimer);directSignalSession.pollTimer=null}
function directResetSignalSession(){directStopSignalPolling();directSignalSession={server:'',id:'',hostToken:'',joinToken:'',pollTimer:null,deadline:0}}
function directNearbyManualUi(show){
  const label=directEl('duelDirectSignal')?.closest('.duelSignalLabel'),actions=directEl('duelDirectCopy')?.parentElement,accept=directEl('duelDirectAcceptRow');
  if(label)label.hidden=!show;if(actions)actions.hidden=!show;if(accept)accept.hidden=!show
}
function directNearbyStage({title,copy,status,showQr=true}){
  directEl('duelDirectActions').hidden=true;directEl('duelDirectStage').hidden=false;directNearbyManualUi(false);
  const titleEl=directEl('duelDirectStageTitle'),copyEl=directEl('duelDirectStageCopy'),qr=directEl('duelDirectQr');
  if(titleEl)titleEl.textContent=title;if(copyEl)copyEl.textContent=copy;if(qr)qr.hidden=!showQr;directSetStatus(status||'');queueFit()
}

const directClosePeerBeforeOneScan=directClosePeer;
directClosePeer=function(options={}){directResetSignalSession();return directClosePeerBeforeOneScan(options)};
globalThis.directClosePeer=directClosePeer;

async function directCreateNearby(){
  const server=directSignalServer();directOpenPanel();
  if(!server){directSetStatus('Nearby one-scan pairing needs the lightweight Pairing service. Set the Multiplayer server once under Online Room, then return here.',{error:true});return}
  directDuel.pairing='nearby';directDuel.signalKind='offer';
  directNearbyStage({title:'Preparing one-scan invite…',copy:'Player 2 will scan one QR with the normal Camera app. No return QR is required.',status:'Creating a short-lived pairing session…',showQr:false});
  try{
    const pc=makeDirectPeer('host'),offer=await pc.createOffer();await pc.setLocalDescription(offer);await directWaitForIce(pc);
    const created=await directSignalRequest(server,'/api/direct/signals',{method:'POST',body:{offer:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}});
    directSignalSession={server,id:created.id,hostToken:created.hostToken,joinToken:created.joinToken,pollTimer:null,deadline:Date.now()+Math.min(Number(created.ttlMs)||DIRECT_SIGNAL_TIMEOUT_MS,DIRECT_SIGNAL_TIMEOUT_MS)};
    const link=directNearbyJoinLink(directSignalSession),qr=directEl('duelDirectQr');if(qr){qr.hidden=false;directRenderQr(link)}
    directNearbyStage({title:'Player 2 · Scan once to join',copy:'Use the normal Camera app and tap the Clash 4 link. Player 2 will open directly into pairing, and both phones will connect automatically.',status:'Waiting for Player 2 to scan…',showQr:true});
    directPollNearbyAnswer()
  }catch(e){directSetStatus(`Could not create one-scan pairing: ${e.message||'unknown error'}`,{error:true});directClosePeer()}
}
globalThis.directCreateNearby=directCreateNearby;

async function directPollNearbyAnswer(){
  directStopSignalPolling();const session=directSignalSession;if(!session.id||!session.hostToken||directDuel.role!=='host'||!directDuel.pc)return;
  if(Date.now()>session.deadline){directSetStatus('Pairing invite expired. Create a new Nearby Duel and scan the new QR.',{error:true});return}
  try{
    const result=await directSignalRequest(session.server,`/api/direct/signals/${encodeURIComponent(session.id)}/answer`,{token:session.hostToken});
    if(result.ready&&result.answer){directStopSignalPolling();await directDuel.pc.setRemoteDescription(result.answer);directSetStatus('Player 2 found. Finishing the direct connection…');return}
  }catch(e){if(e.status===404){directSetStatus('Pairing invite expired. Create a new Nearby Duel.',{error:true});return}}
  directSignalSession.pollTimer=setTimeout(directPollNearbyAnswer,DIRECT_SIGNAL_POLL_MS)
}

async function directJoinNearbyFromLink(descriptor){
  directOpenPanel();directDuel.pairing='nearby';directDuel.signalKind='answer';
  directNearbyStage({title:'Joining Player 1…',copy:'The QR already contains everything needed to find the temporary pairing session. Keep this screen open.',status:'Receiving Player 1’s WebRTC offer…',showQr:false});
  try{
    const result=await directSignalRequest(descriptor.server,`/api/direct/signals/${encodeURIComponent(descriptor.id)}`,{token:descriptor.joinToken});
    const pc=makeDirectPeer('guest');await pc.setRemoteDescription(result.offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await directWaitForIce(pc);
    await directSignalRequest(descriptor.server,`/api/direct/signals/${encodeURIComponent(descriptor.id)}/answer`,{method:'POST',token:descriptor.joinToken,body:{answer:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}});
    directSetStatus('Pairing response sent. Connecting directly to Player 1…')
  }catch(e){directSetStatus(`Could not join this Nearby Duel: ${e.message||'pairing failed'}`,{error:true});directClosePeer()}
}

async function directHandleNearbyLaunch(){
  const descriptor=directReadNearbyJoin();if(!descriptor)return false;directClearNearbyJoinHash();await directJoinNearbyFromLink(descriptor);return true
}

const directCreateManual=directCreate;
directCreate=async function(pairing='nearby'){return pairing==='nearby'?directCreateNearby():directCreateManual(pairing)};
globalThis.directCreate=directCreate;

function directBootNearbySignalUx(){setTimeout(()=>directHandleNearbyLaunch(),0)}
globalThis.directNearbyJoinLink=directNearbyJoinLink;
globalThis.directHandleNearbyLaunch=directHandleNearbyLaunch;
globalThis.directBootNearbySignalUx=directBootNearbySignalUx;
directBootNearbySignalUx();
