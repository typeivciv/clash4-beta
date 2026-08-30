// Nearby Direct Duel QR UX: turn raw WebRTC signaling blobs into Clash 4 deep links.
// The first QR can be scanned with the phone's normal Camera app. The return QR is still
// two-way signaling (required without a signaling server), but Clash 4 makes the handoff explicit.
'use strict';
const DIRECT_LINK_PARAM='c4direct';
const DIRECT_RETURN_KEY='clash4-direct-return-v1';
const DIRECT_RETURN_CHANNEL='clash4-direct-return-v1';
const DIRECT_SIGNAL_PATTERN=/C4D1\.[DJ]\.[A-Za-z0-9_-]+/;
let directReturnChannel=null;

function directSignalOnly(value){const match=String(value||'').match(DIRECT_SIGNAL_PATTERN);return match?match[0]:''}
function directNearbyLink(signal){
  const clean=directSignalOnly(signal);if(!clean)return String(signal||'');
  return `${location.origin}${location.pathname}#${DIRECT_LINK_PARAM}=${clean}`
}
function directLaunchSignal(){
  const raw=String(location.hash||'').replace(/^#/,'');if(!raw)return'';
  const params=new URLSearchParams(raw),value=params.get(DIRECT_LINK_PARAM);return directSignalOnly(value||raw)
}
function directClearLaunchHash(){
  if(!location.hash.includes(DIRECT_LINK_PARAM))return;
  try{history.replaceState(null,'',`${location.pathname}${location.search}`)}catch{}
}
function directNearbyFallbackVisible(show){
  const label=directEl('duelDirectSignal')?.closest('.duelSignalLabel'),actions=directEl('duelDirectCopy')?.parentElement;
  if(label)label.hidden=!show;if(actions)actions.hidden=!show
}

const directRenderQrBase=directRenderQr;
directRenderQr=function(text){
  const clean=directSignalOnly(text),qrText=clean&&directDuel.pairing==='nearby'?directNearbyLink(clean):text;
  return directRenderQrBase(qrText)
};

const directShowSignalBase=directShowSignal;
directShowSignal=function(signal,kind,pairing){
  directShowSignalBase(signal,kind,pairing);
  if(pairing!=='nearby'){directNearbyFallbackVisible(true);return}
  directNearbyFallbackVisible(false);
  const title=directEl('duelDirectStageTitle'),copy=directEl('duelDirectStageCopy'),accept=directEl('duelDirectAcceptRow');
  if(kind==='offer'){
    if(title)title.textContent='1 · Player 2 scans this QR';
    if(copy)copy.textContent='Player 2: use your normal Camera app. Tap the Clash 4 link it finds. Clash 4 will open and create the return QR automatically.';
    if(accept)accept.hidden=false;
    const scan=directEl('duelDirectScanReturn');if(scan)scan.textContent='2 · Scan Player 2 Return QR';
    directSetStatus('Keep this screen open. After Player 2 joins, tap the return-scan button below.')
  }else{
    if(title)title.textContent='2 · Show this Return QR to Player 1';
    if(copy)copy.textContent="Player 1: go back to the original Clash 4 screen and tap ‘Scan Player 2 Return QR’, then scan this code. Do not close Player 2's screen.";
    if(accept)accept.hidden=true;
    directSetStatus('Return QR ready. Player 1 finishes pairing from their original Clash 4 screen.')
  }
};

function directPostReturnSignal(signal){
  const clean=directSignalOnly(signal);if(!clean)return false;const packet={kind:'answer',signal:clean,ts:Date.now()};
  try{localStorage.setItem(DIRECT_RETURN_KEY,JSON.stringify(packet))}catch{}
  try{directReturnChannel?.postMessage(packet)}catch{}
  return true
}
async function directTryBridgedAnswer(signal){
  const clean=directSignalOnly(signal);if(!clean||directDuel.role!=='host'||!directDuel.pc)return false;
  try{const parsed=await unpackDirectSignal(clean);if(parsed.kind!=='answer')return false;await directAcceptAnswer(clean);directSetStatus('Return QR received. Connecting directly…');return true}catch{return false}
}
function directInstallReturnBridge(){
  if('BroadcastChannel'in globalThis){
    try{directReturnChannel=new BroadcastChannel(DIRECT_RETURN_CHANNEL);directReturnChannel.onmessage=e=>{if(e.data?.kind==='answer')directTryBridgedAnswer(e.data.signal)}}catch{}
  }
  addEventListener('storage',e=>{if(e.key!==DIRECT_RETURN_KEY||!e.newValue)return;try{const packet=JSON.parse(e.newValue);if(packet?.kind==='answer')directTryBridgedAnswer(packet.signal)}catch{}})
}
function directShowReturnLinkLanding(signal){
  directPostReturnSignal(signal);
  directOpenPanel();directEl('duelDirectActions').hidden=true;directEl('duelDirectStage').hidden=false;directNearbyFallbackVisible(false);
  const qr=directEl('duelDirectQr'),accept=directEl('duelDirectAcceptRow'),title=directEl('duelDirectStageTitle'),copy=directEl('duelDirectStageCopy');
  if(qr)qr.innerHTML='<div class="duelReturnHint">✓</div>';if(accept)accept.hidden=true;
  if(title)title.textContent='Return QR received';
  if(copy)copy.textContent="Go back to Player 1's original Clash 4 tab. If it is still open, the response was sent there automatically. If it does not connect, use that screen's ‘Scan Player 2 Return QR’ button instead.";
  directSetStatus('Do not continue from this extra tab; the original Player 1 tab owns the WebRTC connection.')
}
async function directHandleNearbyLaunch(){
  const signal=directLaunchSignal();if(!signal)return false;directClearLaunchHash();
  try{
    const parsed=await unpackDirectSignal(signal);
    if(parsed.kind==='offer'){await directJoinSignal(signal,'nearby');return true}
    if(parsed.kind==='answer'){directShowReturnLinkLanding(signal);return true}
  }catch(e){openDuelHub();directSetStatus(e.message||'This Clash 4 QR could not be opened.',{error:true})}
  return false
}
function directBootNearbyQrUx(){directInstallReturnBridge();setTimeout(()=>directHandleNearbyLaunch(),0)}
globalThis.directNearbyLink=directNearbyLink;
globalThis.directHandleNearbyLaunch=directHandleNearbyLaunch;
globalThis.directBootNearbyQrUx=directBootNearbyQrUx;
directBootNearbyQrUx();
