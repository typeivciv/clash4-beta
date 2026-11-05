import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {createHostedHandler} from '../server/vercel-hosted-room.mjs';

const store={
  async read(key){
    const result=await get(key,{access:'private',useCache:false});
    if(!result)return {rooms:{},etag:null};
    if(result.statusCode!==200||!result.blob.etag)throw new Error('Invalid room store response');
    return {rooms:await new Response(result.stream).json(),etag:result.blob.etag}
  },
  async write(key,rooms,etag){
    try{
      await put(key,JSON.stringify(rooms),{access:'private',contentType:'application/json',addRandomSuffix:false,
        allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{})});
      return true
    }catch(error){
      if(error instanceof BlobPreconditionFailedError||(!etag&&/already exists/i.test(error.message)))return false;
      throw error
    }
  }
};
export default {fetch:createHostedHandler(store)};
