import assert from 'node:assert/strict';
import {test} from 'node:test';
import {inspectFileEnvelope,MAX_FILE_BYTES} from '../dist/modules/input/file-envelope.js';
import {PrivateMaterialStorage,materialStorageKey} from '../dist/modules/input/private-material-storage.js';
const actor='11111111-1111-4111-8111-11111111ae01';
const other='11111111-1111-4111-8111-11111111ae02';
// Original synthetic PDF header fixture only: not a valid document or extraction proof.
const pdf=Buffer.from('%PDF-1.7\nfixture envelope\n%%EOF\n');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQAAAABJRU5ErkJggg==','base64');
test('envelope derives hashes and detected MIME from bytes rather than trusting an extension',()=>{
  const file=inspectFileEnvelope(pdf,'application/pdf','โจทย์.pdf');
  assert.equal(file.type,'PDF');assert.equal(file.extension,'pdf');assert.equal(file.contentHash.length,64);assert.equal(file.sizeBytes,pdf.length);
  assert.equal(inspectFileEnvelope(png,'image/png','worksheet.bin').mimeType,'image/png');
  assert.throws(()=>inspectFileEnvelope(png,'application/pdf','worksheet.pdf'),error=>error.code==='INVALID_FILE');
  assert.throws(()=>inspectFileEnvelope(Buffer.from('<svg>script</svg>'),'image/svg+xml','x.svg'),error=>error.status===415);
});
test('oversize/empty/corrupt envelopes, traversing filenames and pathological PNG dimensions are controlled failures',()=>{
  assert.throws(()=>inspectFileEnvelope(new Uint8Array(MAX_FILE_BYTES+1),'application/pdf','x.pdf'),error=>error.status===413);
  assert.throws(()=>inspectFileEnvelope(new Uint8Array(),'application/pdf','x.pdf'),error=>error.status===400);
  assert.throws(()=>inspectFileEnvelope(Buffer.from('%PDF-1.7\nno trailer'),'application/pdf','x.pdf'),error=>error.code==='INVALID_FILE');
  for(const name of ['../x.pdf','folder\\x.pdf','bad\0.pdf','x'.repeat(129)]) assert.throws(()=>inspectFileEnvelope(pdf,'application/pdf',name));
  const huge=Buffer.from(png);huge.writeUInt32BE(10000,16);huge.writeUInt32BE(10000,20);
  assert.throws(()=>inspectFileEnvelope(huge,'image/png','x.png'),error=>error.code==='IMAGE_TOO_LARGE');
});
test('storage path uses verified auth UUID rather than an app primary key or untrusted filename',()=>{
  assert.equal(materialStorageKey(actor,'legacy-session','material-id','pdf'),`${actor}/legacy-session/material-id.pdf`);
  for(const session of ['../s','s/slash','s\\slash','']) assert.throws(()=>materialStorageKey(actor,session,'m','pdf'));
  assert.throws(()=>materialStorageKey('legacy-app-user','s','m','pdf'));
});
test('real storage transport keeps bearer/keys on the configured origin, never upserts or derives public URLs',async()=>{
  const calls=[];const storage=new PrivateMaterialStorage({url:'https://fixture.supabase.co',bucket:'learnly-materials',publishableKey:'fixture-public-key',token:'fixture-token',authUserId:actor,
    fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json({Key:'ignored-private-path'});}});
  const key=materialStorageKey(actor,'session','material','pdf'),file=inspectFileEnvelope(pdf,'application/pdf','x.pdf');
  await storage.upload(key,pdf,file);await storage.remove(key);
  assert.equal(calls[0].url,`https://fixture.supabase.co/storage/v1/object/learnly-materials/${key}`);
  assert.equal(calls[0].init.headers.Authorization,'Bearer fixture-token');assert.equal(calls[0].init.headers['x-upsert'],'false');
  assert.equal(calls[0].init.redirect,'error');assert.ok(calls[0].init.signal);
  assert.equal(calls[1].init.method,'DELETE');assert.deepEqual(JSON.parse(calls[1].init.body),{prefixes:[key]});
  await assert.rejects(storage.remove(`${other}/s/m.pdf`),error=>error.status===403);assert.equal(calls.length,2);
  const changed=Buffer.from(pdf);changed[10]=120;
  await assert.rejects(storage.upload(key,changed,file),error=>error.code==='INVALID_FILE');assert.equal(calls.length,2);
  await assert.rejects(storage.upload(key,new Uint8Array(MAX_FILE_BYTES+1),file),error=>error.code==='INVALID_FILE');assert.equal(calls.length,2);
});
test('storage failures redact upstream content and invalid origins cannot receive credentials',async()=>{
  const options={bucket:'learnly-materials',publishableKey:'fixture-public-key',token:'fixture-token',authUserId:actor};
  for(const url of ['http://fixture.supabase.co','https://user:secret@fixture.supabase.co','https://fixture.supabase.co/path']) assert.throws(()=>new PrivateMaterialStorage({...options,url}));
  const storage=new PrivateMaterialStorage({...options,url:'https://fixture.supabase.co',fetchImpl:async()=>Response.json({error:'fixture-token personal data'},{status:403})});
  await assert.rejects(storage.remove(materialStorageKey(actor,'s','m','pdf')),error=>error.code==='STORAGE_UNAVAILABLE'&&!error.message.includes('fixture-token'));
});

test('recovery streams authenticated original bytes and checks exact MIME, size and SHA256 before accepting a stored object',async()=>{
  const calls=[],file=inspectFileEnvelope(pdf,'application/pdf','x.pdf'),key=materialStorageKey(actor,'s','m','pdf');
  const options={url:'https://fixture.supabase.co',bucket:'learnly-materials',publishableKey:'public',token:'fixture-token',authUserId:actor};
  const storage=new PrivateMaterialStorage({...options,fetchImpl:async(url,init)=>{calls.push({url,init});
    return new Response(pdf,{headers:{'content-type':'application/pdf; charset=binary'}});}});
  await storage.verify(key,file);
  assert.equal(calls[0].url,`https://fixture.supabase.co/storage/v1/object/authenticated/learnly-materials/${key}`);
  assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.headers.Authorization,'Bearer fixture-token');
  assert.equal(calls[0].init.redirect,'error');assert.ok(calls[0].init.signal instanceof AbortSignal);
  const changed=Buffer.from(pdf);changed[10]^=1;
  for(const body of [changed,pdf.subarray(0,pdf.length-1),Buffer.concat([pdf,Buffer.from('extra')])]){
    const bad=new PrivateMaterialStorage({...options,fetchImpl:async()=>new Response(body,{headers:{'content-type':'application/pdf'}})});
    await assert.rejects(bad.verify(key,file),e=>e.code==='FILE_INTEGRITY_ERROR');
  }
  const wrongMime=new PrivateMaterialStorage({...options,fetchImpl:async()=>new Response(pdf,{headers:{'content-type':'image/png'}})});
  await assert.rejects(wrongMime.verify(key,file),e=>e.code==='FILE_INTEGRITY_ERROR');
  const hidden=new PrivateMaterialStorage({...options,fetchImpl:async()=>new Response('private token filename',{status:404})});
  await assert.rejects(hidden.verify(key,file),e=>e.code==='STORAGE_UNAVAILABLE'&&!/token|filename/.test(e.message));
  await assert.rejects(storage.verify(`${other}/s/m.pdf`,file),e=>e.status===403);assert.equal(calls.length,1);
});

test('oversized stored stream is stopped and released without buffering the rest of the file',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_FILE_BYTES+1));},cancel(){cancelled=true;}});
  const storage=new PrivateMaterialStorage({url:'https://fixture.supabase.co',bucket:'learnly-materials',publishableKey:'public',token:'token',authUserId:actor,
    fetchImpl:async()=>new Response(stream,{headers:{'content-type':'application/pdf'}})});
  await assert.rejects(storage.verify(materialStorageKey(actor,'s','m','pdf'),inspectFileEnvelope(pdf,'application/pdf','x.pdf')),e=>e.code==='FILE_INTEGRITY_ERROR');
  assert.equal(cancelled,true);
});
