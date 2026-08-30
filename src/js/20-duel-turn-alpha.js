// Alpha TURN fallback for Nearby Direct Duel.
// ICE still prefers a direct host/STUN path. These public Open Relay entries are staging-only
// so restrictive NAT/firewall pairs can fall back to an encrypted TURN relay during testing.
'use strict';
const DIRECT_ALPHA_TURN_SERVERS=[
  {urls:'stun:openrelay.metered.ca:80'},
  {urls:'turn:openrelay.metered.ca:80',username:'openrelayproject',credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443?transport=tcp',username:'openrelayproject',credential:'openrelayproject'}
];
for(const entry of DIRECT_ALPHA_TURN_SERVERS){
  const urls=Array.isArray(entry.urls)?entry.urls:[entry.urls];
  const exists=(DIRECT_RTC_CONFIG.iceServers||[]).some(server=>{
    const current=Array.isArray(server.urls)?server.urls:[server.urls];return urls.some(url=>current.includes(url))
  });
  if(!exists)DIRECT_RTC_CONFIG.iceServers.push(entry)
}
DIRECT_RTC_CONFIG.iceCandidatePoolSize=Math.max(4,Number(DIRECT_RTC_CONFIG.iceCandidatePoolSize)||0);

async function directAlphaRouteKind(conn){
  const pc=conn?.peerConnection;if(!pc?.getStats)return null;
  try{
    const stats=await pc.getStats();let pair=null;
    for(const report of stats.values()){
      if(report.type==='transport'&&report.selectedCandidatePairId){pair=stats.get(report.selectedCandidatePairId);break}
    }
    if(!pair){
      for(const report of stats.values())if(report.type==='candidate-pair'&&report.state==='succeeded'&&(report.nominated||report.selected)){pair=report;break}
    }
    if(!pair)return null;
    const local=stats.get(pair.localCandidateId),remote=stats.get(pair.remoteCandidateId);
    return local?.candidateType==='relay'||remote?.candidateType==='relay'?'relay':'direct'
  }catch{return null}
}
async function directAlphaReportRoute(conn){
  await new Promise(resolve=>setTimeout(resolve,250));
  const kind=await directAlphaRouteKind(conn);
  if(kind==='relay'){
    directConnectionBadge('online','Connected · relay fallback');
    directSetStatus('Connected through encrypted TURN relay because a direct phone-to-phone route was unavailable.')
  }else if(kind==='direct'){
    directConnectionBadge('online','Direct connected');
    directSetStatus('Connected directly between devices.')
  }
}
const directBindPeerJsConnectionBeforeTurn=directBindPeerJsConnection;
directBindPeerJsConnection=function(conn){
  conn.on('open',()=>directAlphaReportRoute(conn));
  return directBindPeerJsConnectionBeforeTurn(conn)
};
globalThis.directAlphaRouteKind=directAlphaRouteKind;
