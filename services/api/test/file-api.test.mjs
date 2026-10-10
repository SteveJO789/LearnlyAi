import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {once} from 'node:events';
import {createApp} from '../dist/app.js';
import {ApiError} from '../dist/shared/api-error.js';
import {createSupabaseAuthenticator} from '../dist/modules/auth/supabase-auth.js';
import {FileIngestion} from '../dist/modules/input/file-ingestion.js';
import {RealFileTextExtractor} from '../dist/modules/input/real-file-text-extractor.js';
import {PrivateMaterialStorage} from '../dist/modules/input/private-material-storage.js';
import {textPdf,mathPng} from './real-file-fixtures.mjs';
const uid='11111111-1111-4111-8111-11111111ac01',peer='11111111-1111-4111-8111-11111111ac02';
const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_URL='https://synthetic-auth.test';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic-public-key';
after(()=>{if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=oldKey;});
const intents=new Map(),saved=new Map(),objects=new Map();let contexts=0;
const authenticate=createSupabaseAuthenticator({fetch:async(_url,init)=>{
  const id={'Bearer test-a':uid,'Bearer test-b':peer}[init.headers.authorization];
  return id?Response.json({id,email:'synthetic@example.invalid',user_metadata:{}}):Response.json({}, {status:401});
}});
const owned=(request,session)=>{if(request.authUser.id!==uid||session!=='owned')throw new ApiError('NOT_FOUND',404,'Owned session not found');};
function context(request){
  contexts++;
  const storage=new PrivateMaterialStorage({url:'https://fixture.supabase.co',bucket:'learnly-materials',publishableKey:'public',token:request.authToken,authUserId:request.authUser.id,
    fetchImpl:async(url,init)=>{
      if(init.method==='POST'){const key=decodeURI(url.split('/learnly-materials/')[1]);objects.set(key,{bytes:Buffer.from(init.body),mime:init.headers['content-type']});return Response.json({});}
      if(init.method==='DELETE'){for(const key of JSON.parse(init.body).prefixes)objects.delete(key);return Response.json({});}
      const key=decodeURI(url.split('/learnly-materials/')[1]),o=objects.get(key);
      return o?new Response(o.bytes,{headers:{'content-type':o.mime}}):new Response('',{status:404});
    }});
  const store={assertActiveOwnedSession:async id=>owned(request,id),reserve:async(id,m)=>{owned(request,id);intents.set(m.id,m);},
    save:async(id,m)=>{owned(request,id);saved.set(m.id,m);},resolveSave:async(id,m)=>{owned(request,id);return saved.has(m.id)?'SAVED':'NOT_SAVED';},
    cancel:async()=> 'CANCELLED',load:async(id,mid)=>{owned(request,id);if(!intents.has(mid))throw new ApiError('NOT_FOUND',404,'Upload not found');return{state:saved.has(mid)?'FINALIZED':'PENDING',material:intents.get(mid)};}};
  return Promise.resolve({texts:{list:async id=>{owned(request,id);return [...saved.values()].map(m=>({id:m.id,type:m.file.type,status:'READY',normalizedText:m.normalizedText}));},create:async()=>{throw Error('Unused');}},
    files:{listUploads:async id=>{owned(request,id);return [...intents.values()].map(m=>({id:m.id,state:'FINALIZED',type:m.file.type,filename:m.file.filename,createdAt:'2026-10-10T00:00:00Z'}));},
      getFile:async(id,mid)=>{owned(request,id);const m=saved.get(mid);if(!m)throw new ApiError('NOT_FOUND',404,'File not found');return{id:mid,type:m.file.type,storageBucket:m.storageBucket,storageKey:m.storageKey,contentHash:m.file.contentHash,mimeType:m.file.mimeType,sizeBytes:m.file.sizeBytes,filename:m.file.filename,confidence:''};},
      review:async(id,mid,text)=>{owned(request,id);if(!saved.has(mid))throw new ApiError('NOT_FOUND',404,'File not found');return{materialId:mid,status:'READY',normalizedText:text};}},
    ingestion:new FileIngestion(store,storage,new RealFileTextExtractor(),request.authUser.id),storage:()=>storage});
}
async function withApi(work){
  const server=createApp({modelProvider:{generate:async()=>{throw Error('No AI expected');}},materialApi:{authenticate,context}}).listen(0,'127.0.0.1');
  await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/v1/learning-sessions/owned/materials`;
  try{await work(base);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
}
test('protected HTTP file upload -> real PDF/OCR -> durable save -> list/review/resume -> verified binary download',async()=>withApi(async base=>{
  const headers={Authorization:'Bearer test-a'};
  for(const [bytes,mime,name] of [[textPdf(['V = I R']),'application/pdf','โจทย์.pdf'],[mathPng(),'image/png','math.png']]){
    const response=await fetch(base+'/files',{method:'POST',headers:{...headers,'content-type':mime,'x-file-name':encodeURIComponent(name)},body:bytes});
    assert.equal(response.status,201);const {data}=await response.json();assert.equal(data.status,'READY');assert.ok(data.normalizedText);assert.ok(!('storageKey'in data));
    const review=await fetch(base+`/${data.id}/review`,{method:'PATCH',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({text:'โจทย์ที่ตรวจแล้ว x² + 2'})});
    assert.equal(review.status,200);assert.equal((await review.json()).data.normalizedText,'โจทย์ที่ตรวจแล้ว x² + 2');
    const resume=await fetch(base+`/uploads/${data.id}/resume`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}'});assert.equal(resume.status,200);
    const download=await fetch(base+`/${data.id}/file`,{headers});assert.equal(download.status,200);assert.equal(download.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
    const foreign=await fetch(base+`/${data.id}/file`,{headers:{Authorization:'Bearer test-b'}});assert.equal(foreign.status,404);
  }
  const listed=await fetch(base+'/uploads',{headers});assert.equal(listed.status,200);assert.ok((await listed.json()).data.length>=2);
}));
test('missing/invalid Auth, unsupported MIME, oversized/compressed bytes and forged review/recovery fields fail without controlled writes',async()=>withApi(async base=>{
  let before=contexts;
  for(const token of ['', 'Bearer invalid']){const response=await fetch(base+'/files',{method:'POST',headers:{Authorization:token,'content-type':'application/pdf'},body:textPdf()});assert.equal(response.status,401);}
  assert.equal(contexts,before);
  const h={Authorization:'Bearer test-a'};
  assert.equal((await fetch(base+'/files',{method:'POST',headers:{...h,'content-type':'image/svg+xml'},body:'<svg/>'})).status,415);
  assert.equal((await fetch(base+'/files',{method:'POST',headers:{...h,'content-type':'application/pdf','x-file-name':'x.pdf'},body:Buffer.alloc(3*1024*1024+1)})).status,413);
  assert.equal((await fetch(base+'/files',{method:'POST',headers:{...h,'content-type':'application/pdf','content-encoding':'gzip','x-file-name':'x.pdf'},body:Buffer.from('not-gzip')})).status,415);
  assert.equal(contexts,before);
  assert.equal((await fetch(base+'/x/review',{method:'PATCH',headers:{...h,'content-type':'application/json'},body:'{"text":"hello","reviewed":true}'})).status,400);
  assert.equal((await fetch(base+'/uploads/x/resume',{method:'POST',headers:{...h,'content-type':'application/json'},body:'{"storageKey":"forged"}'})).status,400);
}));
