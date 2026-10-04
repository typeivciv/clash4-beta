'use strict';
// Shared network setup for Direct Duel and 2–4-player rooms. Provider API keys
// belong in a server-side credential endpoint; this file reads browser ICE credentials.
let c4PeerNetworkLoad=null,c4PeerNetworkLoadedAt=0,c4PeerNetworkServers=[];
const c4PeerNetworkState={source:'legacy',error:''};
function c4PeerNetworkValidate(servers){
  if(!Array.isArray(servers)||servers.length>12)throw new Error('Invalid relay configuration.');
  return servers.map(server=>{
    const urls=Array.isArray(server?.urls)?server.urls:[server?.urls];
    if(!urls.length||urls.length>8||urls.some(url=>typeof url!=='string'||!/^turns?:[^\s]+$/i.test(url)))throw new Error('Relay configuration must contain TURN addresses.');
    if(typeof server.username!=='string'||!server.username||typeof server.credential!=='string'||!server.credential)throw new Error('Relay credentials are missing.');
    return {urls:[...urls],username:server.username,credential:server.credential}
  })
}
async function c4PreparePeerNetwork(){
  if(c4PeerNetworkLoadedAt&&Date.now()-c4PeerNetworkLoadedAt<300000)return;
  if(c4PeerNetworkLoad)return c4PeerNetworkLoad;
  c4PeerNetworkLoad=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
    try{
      const options={cache:'no-store',credentials:'omit',signal:controller.signal};
      const response=await fetch('multiplayer-network.json',options);
      if(!response.ok)throw new Error('Network configuration could not load.');
      const config=await response.json();let servers=config.iceServers||[];
      if(config.credentialEndpoint){
        const endpoint=new URL(config.credentialEndpoint,location.href);
        if(endpoint.protocol!=='https:')throw new Error('Relay credential endpoint must use HTTPS.');
        const credentials=await fetch(endpoint.href,options);
        if(!credentials.ok)throw new Error('Relay credentials could not load.');
        const body=await credentials.json();servers=Array.isArray(body)?body:body.iceServers;
      }
      const next=c4PeerNetworkValidate(servers);
      DIRECT_RTC_CONFIG.iceServers=DIRECT_RTC_CONFIG.iceServers.filter(server=>!c4PeerNetworkServers.includes(server));
      c4PeerNetworkServers=next;DIRECT_RTC_CONFIG.iceServers.push(...next);
      c4PeerNetworkState.source=next.length?'configured':'legacy';c4PeerNetworkState.error='';c4PeerNetworkLoadedAt=Date.now()
    }catch(error){
      c4PeerNetworkState.error=error?.message||'Network configuration unavailable.';
      throw new Error(c4PeerNetworkState.error)
    }finally{clearTimeout(timer);c4PeerNetworkLoad=null}
  })();
  return c4PeerNetworkLoad
}
globalThis.c4PeerNetwork={state:c4PeerNetworkState,prepare:c4PreparePeerNetwork};
