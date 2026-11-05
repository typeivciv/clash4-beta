import {createHmac,randomBytes} from 'node:crypto';

// coturn REST authentication: only time-limited browser credentials are returned.
export function createTurnIssuer(env=process.env){
  const urls=(env.TURN_URLS||'').split(',').map(url=>url.trim()).filter(Boolean);
  const secret=env.TURN_SHARED_SECRET||'';
  if(!urls.length&&!secret)return null;
  if(Buffer.byteLength(secret)<32||!urls.length||urls.length>8||urls.some(url=>!/^turns?:[^\s]+$/i.test(url)))throw new Error('Configure TURN_URLS and a TURN_SHARED_SECRET of at least 32 bytes.');
  const ttl=4*60*60;
  return ()=>{
    const expires=Math.floor(Date.now()/1000)+ttl;
    const username=expires+':clash4-'+randomBytes(9).toString('base64url');
    const credential=createHmac('sha1',secret).update(username).digest('base64');
    return {ok:true,expiresAt:expires*1000,iceServers:[{urls,username,credential}]}
  }
}
