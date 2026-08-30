import crypto from 'crypto';

const ID_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_TTL_MS=3*60*1000;
const DEFAULT_MAX_SESSIONS=1000;
const MAX_SDP_LENGTH=64_000;

export class DirectSignalError extends Error{
  constructor(code,status=400){super(code);this.name='DirectSignalError';this.code=code;this.status=status}
}

function randomId(length=10){
  const bytes=crypto.randomBytes(length);let out='';
  for(const b of bytes)out+=ID_ALPHABET[b%ID_ALPHABET.length];
  return out
}
function randomToken(){return crypto.randomBytes(24).toString('base64url')}
function cleanId(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function cloneDescription(description){return{type:description.type,sdp:description.sdp}}
function validateDescription(description,expectedType){
  if(!description||description.type!==expectedType||typeof description.sdp!=='string'||!description.sdp.trim()||description.sdp.length>MAX_SDP_LENGTH){
    throw new DirectSignalError(`invalid-${expectedType}`,400)
  }
}

export function createDirectSignalStore({ttlMs=DEFAULT_TTL_MS,maxSessions=DEFAULT_MAX_SESSIONS,clock=()=>Date.now()}={}){
  const sessions=new Map();
  const ttl=Math.max(30_000,Math.min(10*60*1000,Number(ttlMs)||DEFAULT_TTL_MS));
  const max=Math.max(10,Math.min(10_000,Number(maxSessions)||DEFAULT_MAX_SESSIONS));

  function cleanup(){
    const now=clock();for(const[id,session]of sessions)if(session.expiresAt<=now)sessions.delete(id)
  }
  function sessionFor(rawId){
    cleanup();const id=cleanId(rawId),session=sessions.get(id);if(!session)throw new DirectSignalError('signal-not-found',404);return session
  }
  function requireToken(session,provided,kind){
    const expected=kind==='host'?session.hostToken:session.joinToken;
    if(!provided||provided!==expected)throw new DirectSignalError('invalid-signal-token',401)
  }
  function create(offer){
    cleanup();validateDescription(offer,'offer');if(sessions.size>=max)throw new DirectSignalError('signal-capacity',503);
    let id='';for(let tries=0;tries<30;tries++){id=randomId();if(!sessions.has(id))break}if(!id||sessions.has(id))throw new DirectSignalError('signal-capacity',503);
    const createdAt=clock(),session={id,offer:cloneDescription(offer),answer:null,hostToken:randomToken(),joinToken:randomToken(),createdAt,expiresAt:createdAt+ttl};
    sessions.set(id,session);
    return{id,hostToken:session.hostToken,joinToken:session.joinToken,expiresAt:session.expiresAt,ttlMs:ttl}
  }
  function getOffer(rawId,joinToken){const session=sessionFor(rawId);requireToken(session,joinToken,'join');return{offer:cloneDescription(session.offer),expiresAt:session.expiresAt}}
  function putAnswer(rawId,joinToken,answer){
    const session=sessionFor(rawId);requireToken(session,joinToken,'join');validateDescription(answer,'answer');
    if(session.answer)throw new DirectSignalError('signal-answer-already-set',409);
    session.answer=cloneDescription(answer);return{accepted:true,expiresAt:session.expiresAt}
  }
  function getAnswer(rawId,hostToken){const session=sessionFor(rawId);requireToken(session,hostToken,'host');return session.answer?{ready:true,answer:cloneDescription(session.answer),expiresAt:session.expiresAt}:{ready:false,expiresAt:session.expiresAt}}
  function remove(rawId,hostToken){const session=sessionFor(rawId);requireToken(session,hostToken,'host');sessions.delete(session.id);return true}
  function size(){cleanup();return sessions.size}
  return{create,getOffer,putAnswer,getAnswer,remove,cleanup,size,ttlMs:ttl,maxSessions:max}
}
