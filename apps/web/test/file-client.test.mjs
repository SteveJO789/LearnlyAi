import assert from 'node:assert/strict';
import {afterEach,test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),supabase=require('../.web-test-build/lib/supabase.js'),files=require('../.web-test-build/lib/file-materials.js');
const originalClient=supabase.getSupabaseClient,originalFetch=globalThis.fetch;
afterEach(()=>{supabase.getSupabaseClient=originalClient;globalThis.fetch=originalFetch;});
const auth=()=>{supabase.getSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:{access_token:'test-token'}},error:null})}});};
const ready={id:'material',materialId:'material',status:'READY',type:'PDF',normalizedText:'โจทย์ x²',contentHash:'a'.repeat(64),mimeType:'application/pdf',sizeBytes:10};
test('file client sends original bytes and encoded filename with verified Bearer on same origin; review sends text only',async()=>{
  auth();const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({data:url.endsWith('/review')?{materialId:'material',status:'READY',normalizedText:'ตรวจแล้ว'}:ready});};
  const file=new File(['%PDF-1.4'],'โจทย์.pdf',{type:'application/pdf'});
  await files.uploadFileMaterial('session/slash',file);
  assert.equal(calls[0].url,'/api/learning-sessions/session%2Fslash/materials/files');
  assert.equal(calls[0].init.body,file);assert.equal(calls[0].init.headers['Content-Type'],'application/pdf');assert.equal(calls[0].init.headers.Authorization,'Bearer test-token');
  assert.equal(calls[0].init.headers['x-file-name'],encodeURIComponent('โจทย์.pdf'));assert.equal(calls[0].init.redirect,'error');
  await files.reviewFileMaterial('s','material','ตรวจแล้ว');assert.deepEqual(JSON.parse(calls[1].init.body),{text:'ตรวจแล้ว'});
});
test('invalid files and unauthenticated uploads never send bytes; malformed server metadata is rejected',async()=>{
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({data:{...ready,normalizedText:''}});};
  auth();await assert.rejects(files.uploadFileMaterial('s',new File(['x'],'x.svg',{type:'image/svg+xml'})),/PDF/);
  await assert.rejects(files.uploadFileMaterial('s',new File([new Uint8Array(3*1024*1024+1)],'x.pdf',{type:'application/pdf'})),/3 MiB/);
  supabase.getSupabaseClient=()=>({auth:{getSession:async()=>({data:{session:null},error:null})}});
  await assert.rejects(files.uploadFileMaterial('s',new File(['x'],'x.pdf',{type:'application/pdf'})),/log in/);assert.equal(calls,0);
  auth();await assert.rejects(files.uploadFileMaterial('s',new File(['x'],'x.pdf',{type:'application/pdf'})),/invalid response/);
});
test('recovery lists bounded owned receipts and sends empty resume body without re-uploading; downloads use authenticated API',async()=>{
  auth();const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url,init});if(url.endsWith('/uploads'))return Response.json({data:[{id:'m',state:'PENDING',type:'PDF',filename:'x.pdf',createdAt:'2026-10-10T00:00:00Z'}]});
    if(url.endsWith('/file'))return new Response('%PDF',{headers:{'content-type':'application/pdf'}});return Response.json({data:{id:'m',materialId:'m',status:'CANCELLED'}});};
  assert.equal((await files.listUploadReceipts('s'))[0].state,'PENDING');
  assert.equal((await files.resumeFileUpload('s','m')).status,'CANCELLED');assert.equal(calls[1].init.body,'{}');
  const blob=await files.downloadFileMaterial('s','m');assert.equal(blob.type,'application/pdf');assert.equal(calls[2].init.headers.Authorization,'Bearer test-token');
});
