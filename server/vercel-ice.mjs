import {createTurnIssuer} from './turn-credentials.mjs';

const GAME_ORIGIN='https://typeivciv.github.io';
const TTL=4*60*60;
const MINUTE=60_000;
const MAX_IPS=1024;
const LIMIT=24;
const HEADERS={
  'access-control-allow-origin':GAME_ORIGIN,
  'access-control-allow-methods':'GET,OPTIONS',
  'cache-control':'no-store',
  'vary':'Origin'
};
function json(status,body,headers={}){
  return Response.json(body,{status,headers:{...HEADERS,...headers}})
}
const unavailable=()=>json(503,{ok:false,error:'relay-unavailable'});

function cloudflareIssuer(id,token,fetcher){
  if(!/^[a-z0-9_-]{1,100}$/i.test(id)||!token)throw new Error('Incomplete Cloudflare TURN configuration');
  return async()=>{
    const started=Date.now();
    const response=await fetcher('https://rtc.live.cloudflare.com/v1/turn/keys/'+id+'/credentials/generate-ice-servers',{
      method:'POST',redirect:'error',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
      body:JSON.stringify({ttl:TTL}),signal:AbortSignal.timeout(5000)
    });
    if(!response.ok)throw new Error('TURN credential provider rejected the request');
    const {iceServers}=await response.json();
    if(!Array.isArray(iceServers)||iceServers.length>8)throw new Error('Invalid ICE server list');
    const servers=[];
    for(const entry of iceServers){
      if(!entry||typeof entry.username!=='string'||!entry.username||typeof entry.credential!=='string'||!entry.credential)continue;
      const urls=(Array.isArray(entry.urls)?entry.urls:[entry.urls]).filter(url=>
        typeof url==='string'&&/^turns?:turn\.cloudflare\.com:(?:80|443|3478|5349)(?:\?transport=(?:udp|tcp))?$/.test(url));
      if(urls.length)servers.push({urls:[...new Set(urls)],username:entry.username,credential:entry.credential});
    }
    if(!servers.length)throw new Error('No usable TURN routes returned');
    return {ok:true,expiresAt:started+TTL*1000,iceServers:servers}
  }
}

export function createIceHandler(env,{fetcher=fetch,clock=Date.now}={}){
  let issue;
  try{
    const cf=env.CF_TURN_KEY_ID||env.CF_TURN_KEY_API_TOKEN;
    const coturn=env.TURN_URLS||env.TURN_SHARED_SECRET;
    if(cf&&coturn)throw new Error('Configure only one TURN credential provider');
    issue=cf?cloudflareIssuer(env.CF_TURN_KEY_ID||'',env.CF_TURN_KEY_API_TOKEN,fetcher):createTurnIssuer(env);
  }catch{issue=null}
  const counts=new Map();
  let windowStart=-1;
  return async request=>{
    if(request.headers.get('origin')!==GAME_ORIGIN)return json(403,{ok:false,error:'origin-not-allowed'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
    if(request.method!=='GET')return json(405,{ok:false,error:'method-not-allowed'},{allow:'GET, OPTIONS'});
    if(!issue)return unavailable();

    const window=Math.floor(clock()/MINUTE);
    if(windowStart!==window){counts.clear();windowStart=window}
    const ip=(request.headers.get('x-vercel-forwarded-for')||'unknown').slice(0,128);
    const count=counts.get(ip)||0;
    if(count>=LIMIT||(!count&&counts.size>=MAX_IPS))return json(429,{ok:false,error:'rate-limit'},{'retry-after':'60'});
    counts.set(ip,count+1);
    try{return json(200,await issue())}catch{return unavailable()}
  }
}
