// Local connection evidence only: no SDP, addresses, invite IDs, credentials or game data.
'use strict';
const c4ConnectionDiagnostics=(()=>{
  const records=[],seen=new WeakMap(),lifecycle=[];
  const note=event=>{lifecycle.push({at:new Date().toISOString(),event});if(lifecycle.length>16)lifecycle.shift()};
  function observe(conn,mode,role){
    const pc=conn?.peerConnection;if(!pc||seen.has(pc))return;
    const record={mode,role,at:new Date().toISOString(),ice:pc.iceConnectionState,connection:pc.connectionState,gathering:pc.iceGatheringState,localTypes:[],remoteTypes:[],errors:[],events:[]};
    const sample=event=>{record.ice=pc.iceConnectionState;record.connection=pc.connectionState;record.gathering=pc.iceGatheringState;record.events.push({event,ice:record.ice,connection:record.connection,at:new Date().toISOString()});if(record.events.length>20)record.events.shift()};
    seen.set(pc,record);records.push({pc,record});if(records.length>12)records.shift();
    for(const event of ['iceconnectionstatechange','connectionstatechange','icegatheringstatechange'])pc.addEventListener?.(event,()=>sample(event));
    pc.addEventListener?.('icecandidate',event=>{const type=event.candidate?.type;if(['host','srflx','prflx','relay'].includes(type)&&!record.localTypes.includes(type))record.localTypes.push(type)});
    pc.addEventListener?.('icecandidateerror',event=>{record.errors.push({code:Number(event.errorCode)||0,server:String(event.url||'').split('?')[0].replace(/\/\/[^/@]+@/,'//')});if(record.errors.length>12)record.errors.shift()});
    conn.on?.('error',error=>{record.dataError=String(error?.type||'unknown').slice(0,60)});
    conn.on?.('open',()=>sample('data-open'));conn.on?.('close',()=>sample('data-close'));
    sample('observed');
  }
  async function report(){
    await Promise.all(records.map(async({pc,record})=>{
      try{
        const stats=await pc.getStats();let selected=null;
        for(const stat of stats.values()){
          if(stat.type==='local-candidate'&&stat.candidateType&&!record.localTypes.includes(stat.candidateType))record.localTypes.push(stat.candidateType);
          if(stat.type==='remote-candidate'&&stat.candidateType&&!record.remoteTypes.includes(stat.candidateType))record.remoteTypes.push(stat.candidateType);
          if(stat.type==='transport'&&stat.selectedCandidatePairId)selected=stats.get(stat.selectedCandidatePairId);
        }
        if(!selected)for(const stat of stats.values())if(stat.type==='candidate-pair'&&stat.state==='succeeded'&&stat.nominated){selected=stat;break}
        if(selected){const local=stats.get(selected.localCandidateId),remote=stats.get(selected.remoteCandidateId);record.route={local:local?.candidateType||'unknown',remote:remote?.candidateType||'unknown',protocol:local?.protocol||'unknown'}}
      }catch{}
    }));
    return JSON.stringify({visibility:typeof document!=='undefined'?document.visibilityState:'unknown',lifecycle,attempts:records.map(({record})=>record)},null,2)
  }
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>note(`visibility:${document.visibilityState}`));
  if(typeof window!=='undefined')for(const event of ['online','offline','pageshow','pagehide'])window.addEventListener(event,()=>note(event));
  return {observe,report}
})();
globalThis.c4ConnectionDiagnostics=c4ConnectionDiagnostics;
