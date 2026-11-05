import {randomBytes} from 'node:crypto';
import {ROOM_TTL_MS,CODE_ALPHABET,A,token,playerFor,parseSince,projectedPayload,lobbyStatus,newLobby,startIfReady,applyMove,touch} from './hosted-room-core.mjs';

const CODE=/^[A-HJ-NP-Z2-9]{6}$/;
const MAX_SHARD_ROOMS=4;
const roomLive=room=>room&&Date.now()-room.updatedAt<ROOM_TTL_MS;
function randomCode(){return Array.from(randomBytes(6),n=>CODE_ALPHABET[n%CODE_ALPHABET.length]).join('')}
const shardFor=code=>'rooms-v1/'+code[0]+'.json';
const ticket=(room,p)=>({ok:true,code:room.code,token:p.token,seat:p.owner,status:lobbyStatus(room)});

export function createHostedHandler(store,{origin='https://typeivciv.github.io'}={}){
  const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'content-type,authorization','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'};
  const json=(status,body)=>Response.json(body,{status,headers});
  const fail=(status,error)=>json(status,{ok:false,error});
  async function create(){
    for(let i=0;i<6;i++){
      const code=randomCode(),key=shardFor(code),{rooms,etag}=await store.read(key);
      const live=Object.fromEntries(Object.entries(rooms).filter(([,r])=>roomLive(r)));
      if(Object.hasOwn(live,code)||Object.keys(live).length>=MAX_SHARD_ROOMS)continue;
      const {room,p1}=newLobby(code);live[code]=room;
      if(await store.write(key,live,etag))return json(201,ticket(room,p1))
    }
    return fail(503,'server-capacity')
  }
  return async request=>{
    const url=new URL(request.url),pathname=url.pathname==='/api/hosted'?'/api/'+url.searchParams.get('route'):url.pathname;
    const source=request.headers.get('origin');
    if(source&&source!==origin&&source!==url.origin)return fail(403,'origin-not-allowed');
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    try{
      if(request.method==='GET'&&pathname==='/api/health'){
        await store.read('rooms-v1/A.json');
        return json(200,{ok:true,service:'clash4-duel',storage:'private-blob',relayConfigured:false})
      }
      if(request.method==='POST'&&pathname==='/api/lobbies')return await create();
      const match=pathname.match(/^\/api\/lobbies\/([a-z0-9]{6})(?:\/(join|ready|move))?$/i);
      if(!match)return fail(404,'not-found');
      const code=match[1].toUpperCase(),action=match[2]?.toLowerCase();
      if(!CODE.test(code))return fail(404,'lobby-not-found');
      if(request.method!==(action?'POST':'GET'))return fail(405,'method-not-allowed');
      const auth=request.headers.get('authorization')||'',raw=auth.startsWith('Bearer ')?auth.slice(7):'';
      if(action!=='join'&&!/^[a-zA-Z0-9_-]{32}$/.test(raw))return fail(401,'invalid-player-token');
      let input={};
      if(action==='move'){
        const body=await request.text();
        if(body.length>4096)return fail(413,'body-too-large');
        try{input=JSON.parse(body)}catch{return fail(400,'bad-request')}
        if(!input||typeof input!=='object')return fail(400,'bad-request')
      }
      const key=shardFor(code);
      for(let i=0;i<5;i++){
        const {rooms,etag}=await store.read(key),room=rooms[code];
        if(!roomLive(room))return fail(404,'lobby-not-found');
        let payload;
        if(action==='join'){
          if(room.players.length>=2)return fail(409,'lobby-full');
          const p={owner:A,token:token(),ready:false};room.players.push(p);touch(room);payload=ticket(room,p)
        }else{
          const player=playerFor(room,raw);
          if(!player)return fail(401,'invalid-player-token');
          if(!action)return json(200,projectedPayload(room,player,{since:parseSince(url)}));
          if(action==='ready'){
            if(player.ready)return json(200,projectedPayload(room,player));
            player.ready=true;touch(room);startIfReady(room)
          }else{
            const result=applyMove(room,player,input.type,input.column);
            if(result.error)return fail(result.status,result.error)
          }
          payload=projectedPayload(room,player)
        }
        if(await store.write(key,rooms,etag))return json(200,payload)
      }
      return fail(503,'room-busy')
    }catch(error){
      console.error('Hosted Room storage failure:',error?.name||'Error');
      return fail(503,'hosted-room-unavailable')
    }
  }
}
