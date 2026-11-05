'use strict';
// One configuration for manual Direct, one-scan Direct, and all shared-room seats.
const c4PeerNetworkState={relay:'legacy',error:''};
let c4SettingsPromise,c4SettingsUntil=0,c4RelayPromise,c4RelayUntil=0,c4RelayExpires=0,c4LegacyServers=null;
function c4NetworkUrl(value){
  if(!value)return '';
  const url=new URL(value);
  const local=host=>host==='localhost'||host==='127.0.0.1';
  if(url.username||url.password||url.search||url.hash||
      (url.protocol!=='https:'&&!(url.protocol==='http:'&&local(url.hostname)&&local(location.hostname))))throw new Error('Invalid multiplayer service URL.');
  return url.href.replace(/\/+$/,'')
}
async function c4NetworkJson(url){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),4500);
  try{
    const res=await fetch(url,{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
    if(!res.ok)throw new Error('Multiplayer service unavailable.');
    return await res.json()
  }finally{clearTimeout(timeout)}
}
function c4NetworkSettings(){
  if(c4SettingsPromise&&Date.now()<c4SettingsUntil)return c4SettingsPromise;
  c4SettingsUntil=Date.now()+60000;
  c4SettingsPromise=c4NetworkJson('multiplayer-network.json').then(raw=>{
    const hostedServer=c4NetworkUrl(raw.hostedServer),relayCredentialEndpoint=c4NetworkUrl(raw.relayCredentialEndpoint);
    c4SettingsUntil=Date.now()+300000;
    return {hostedServer,relayCredentialEndpoint}
  }).catch(()=>({hostedServer:'',relayCredentialEndpoint:''}));
  return c4SettingsPromise
}
function c4NetworkRelayServers(body){
  if(!Array.isArray(body?.iceServers)||body.iceServers.length===0||body.iceServers.length>12)throw new Error('No relay servers returned.');
  return body.iceServers.map(item=>{
    const urls=Array.isArray(item.urls)?item.urls:[item.urls];
    if(!urls.length||urls.length>8||urls.some(url=>typeof url!=='string'||!/^turns?:[^\s]+$/i.test(url))||
      typeof item.username!=='string'||!item.username||typeof item.credential!=='string'||!item.credential)throw new Error('Invalid relay credentials.');
    return {urls:[...urls],username:item.username,credential:item.credential}
  })
}
function c4PreparePeerNetwork(){
  if(c4RelayPromise)return c4RelayPromise;
  if(Date.now()<c4RelayUntil)return Promise.resolve();
  c4RelayPromise=(async()=>{
    c4LegacyServers??=DIRECT_RTC_CONFIG.iceServers.slice();
    try{
      const {relayCredentialEndpoint}=await c4NetworkSettings();
      if(!relayCredentialEndpoint)throw new Error('Managed relay is not configured.');
      const body=await c4NetworkJson(relayCredentialEndpoint),servers=c4NetworkRelayServers(body);
      const expiry=Number(body.expiresAt);
      if(!Number.isFinite(expiry)||expiry<Date.now()+60000)throw new Error('Relay credentials expired or have no expiry.');
      const discovery=c4LegacyServers.filter(item=>!(Array.isArray(item.urls)?item.urls:[item.urls]).some(url=>/^turns?:/i.test(url)));
      DIRECT_RTC_CONFIG.iceServers=[...discovery,...servers];
      c4RelayExpires=expiry;c4RelayUntil=Math.min(expiry-30000,Date.now()+300000);
      c4PeerNetworkState.relay='managed';c4PeerNetworkState.error=''
    }catch(error){
      // A configuration outage must not disable direct play or discard usable credentials.
      if(Date.now()>=c4RelayExpires){
        DIRECT_RTC_CONFIG.iceServers=c4LegacyServers.slice();c4PeerNetworkState.relay='legacy'
      }
      c4RelayUntil=Date.now()+15000;c4PeerNetworkState.error=error?.message||'Relay configuration unavailable.'
    }finally{c4RelayPromise=null}
  })();
  return c4RelayPromise
}
globalThis.c4PeerNetwork={state:c4PeerNetworkState,settings:c4NetworkSettings,prepare:c4PreparePeerNetwork,fresh:()=>Date.now()<c4RelayUntil};
if(typeof document!=='undefined')setInterval(()=>{
  if(globalThis.peerRoom?.role==='host'&&document.visibilityState==='visible')c4PreparePeerNetwork()
},60000);
