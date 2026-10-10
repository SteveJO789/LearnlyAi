import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FileIngestion, normalizeFileExtraction } from '../dist/modules/input/file-ingestion.js';
import { inspectFileEnvelope } from '../dist/modules/input/file-envelope.js';
import { PrismaFileMaterials } from '../dist/modules/input/prisma-file-materials.js';
import { ApiError } from '../dist/shared/api-error.js';
const authId='10000000-0000-0000-0000-000000000001';
// Envelope-only fixture. Extractor injection tests orchestration, not a working PDF parser/OCR.
const bytes=()=>Buffer.from('%PDF-1.7\nfixture\n%%EOF\n');
const extraction={method:'PDF_TEXT',confidence:null,pages:[{page:1,text:'  สูตร x²\r\nV = IR  '},{page:2,text:''}]};
function harness({ownerFailure,extractFailure,saveFailure,uploadFailure,removeFailure,mutateExtraction}={}) {
  const events=[],saved=[];
  const store={assertActiveOwnedSession:async()=>{events.push('owner');if(ownerFailure)throw ownerFailure;},
    save:async(session,material)=>{events.push('save');saved.push({session,material});if(saveFailure)throw saveFailure;}};
  const storage={bucketId:'learnly-materials',upload:async()=>{events.push('upload');if(uploadFailure)throw uploadFailure;},remove:async()=>{events.push('remove');if(removeFailure)throw removeFailure;}};
  const extractor={extract:async(snapshot,file,signal)=>{events.push('extract');assert.equal(file.type,'PDF');assert.ok(signal instanceof AbortSignal);if(extractFailure)throw extractFailure;if(mutateExtraction)snapshot[0]=0;return extraction;}};
  const cleanup=[];
  return {events,saved,cleanup,service:new FileIngestion(store,storage,extractor,authId,id=>cleanup.push(id))};
}
test('owned file orchestration preserves exact binary hash and actual page metadata before saving READY user material',async()=>{
  const h=harness(),original=bytes(),result=await h.service.ingest('session',original,'application/pdf','lesson.pdf');
  assert.deepEqual(h.events,['owner','extract','upload','save']);assert.equal(result.status,'READY');assert.equal(result.type,'PDF');
  const saved=h.saved[0].material;
  assert.equal(saved.normalizedText,'สูตร x²\nV = IR');assert.equal(saved.extraction.pages[1].page,2);assert.equal(saved.extraction.pages[1].text,'');
  assert.equal(saved.file.contentHash,inspectFileEnvelope(original,'application/pdf','lesson.pdf').contentHash);
  assert.ok(saved.storageKey.startsWith(authId+'/session/'));assert.ok(!('storageKey' in result));
  assert.equal(saved.storageBucket,'learnly-materials');assert.ok(!('storageBucket' in result));
  assert.notEqual(saved.normalizedHash,saved.file.contentHash);
});
test('cross-user/closed session denial occurs before extraction, storage and persistence',async()=>{
  const h=harness({ownerFailure:new ApiError('NOT_FOUND',404,'Owned active session not found')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.status===404);
  assert.deepEqual(h.events,['owner']);assert.equal(h.saved.length,0);
});
test('failed decode and mutated extracted bytes never upload; raw decoder errors are redacted',async()=>{
  const h=harness({extractFailure:Error('private filename/learner text/credential')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='INVALID_FILE'&&!error.message.includes('private'));
  assert.deepEqual(h.events,['owner','extract']);
  const mutated=harness({mutateExtraction:true});
  await assert.rejects(mutated.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='INVALID_FILE');
  assert.deepEqual(mutated.events,['owner','extract']);
});
test('confirmed upload is compensated if persistence fails; cleanup failure is explicit and records only material ID',async()=>{
  const h=harness({saveFailure:Error('database credentials/private query')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='MATERIAL_PERSISTENCE_UNAVAILABLE'&&!error.message.includes('credentials'));
  assert.deepEqual(h.events,['owner','extract','upload','save','remove']);
  const failed=harness({saveFailure:Error('database'),removeFailure:Error('storage secret')});
  await assert.rejects(failed.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='FILE_CLEANUP_REQUIRED'&&!error.message.includes('secret'));
  assert.deepEqual(failed.cleanup,[failed.saved[0].material.id]);assert.ok(!failed.cleanup[0].includes('/'));
});
test('ownership changed during persistence still compensates, ambiguous upload failure never saves or blindly deletes',async()=>{
  const h=harness({saveFailure:new ApiError('NOT_FOUND',404,'Session no longer active')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.status===404);
  assert.ok(h.events.includes('remove'));
  const ambiguous=harness({uploadFailure:new ApiError('STORAGE_UNAVAILABLE',503,'Storage temporarily unavailable')});
  await assert.rejects(ambiguous.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='STORAGE_UNAVAILABLE');
  assert.deepEqual(ambiguous.events,['owner','extract','upload']);
});
test('extraction rejects fabricated/missing page identity, oversize/empty text and invalid OCR confidence without truncation',()=>{
  const pdf=inspectFileEnvelope(bytes(),'application/pdf','lesson.pdf');
  const invalid=[{...extraction,pages:[{page:2,text:'text'}]}, {...extraction,pages:[{page:1,text:'text'},,{page:3,text:'text'}]},
    {...extraction,pages:[{page:1,text:'x'.repeat(8001)}]}, {...extraction,pages:[{page:1,text:' '} ]},
    {...extraction,pages:Array.from({length:11},(_,i)=>({page:i+1,text:'text'}))}, {...extraction,confidence:101}];
  for(const value of invalid) assert.throws(()=>normalizeFileExtraction(value,pdf),ApiError);
  const image={...pdf,type:'IMAGE',mimeType:'image/png',extension:'png'};
  assert.throws(()=>normalizeFileExtraction(extraction,image),ApiError);
  const normalized=normalizeFileExtraction({method:'OCR',confidence:85,pages:[{page:null,text:'โจทย์ 2 + 3'}]},image);
  assert.equal(normalized.normalizedText,'โจทย์ 2 + 3');assert.equal(normalized.extraction.pages[0].page,null);
});
test('Prisma file persistence binds application owner, locks active session and inserts only USER material inside API context',async()=>{
  const plans=[],events=[];
  const raw={sql:(strings,...values)=>({returnsRow:()=>({build:()=>({sql:strings.join('?'),values})}),affectedCount:()=>({build:()=>({sql:strings.join('?'),values})})})};
  let owned=true;
  const tx={query:plan=>{plans.push(plan);return {toArray:async()=>owned?[{id:'session'}]:[]};},execute:async plan=>{plans.push(plan);return {affectedRows:1};}};
  const client={raw,query:tx.query,transaction:async work=>{events.push('begin');try{const result=await work(tx);events.push('commit');return result;}catch(error){events.push('rollback');throw error;}}};
  const store=new PrismaFileMaterials(client,'legacy-application-id');
  await store.assertActiveOwnedSession('session');assert.ok(plans[0].values.includes('legacy-application-id'));
  const file=inspectFileEnvelope(bytes(),'application/pdf','lesson.pdf');
  await store.save('session',{id:'material',storageKey:authId+'/session/material.pdf',storageBucket:'learnly-materials',file,...normalizeFileExtraction(extraction,file)});
  const insert=plans.find(plan=>plan.sql.includes('INSERT INTO public."SourceMaterial"'));
  const metadata=JSON.parse(insert.values.at(-1));assert.equal(metadata.origin,'LEARNER_INPUT');assert.equal(metadata.reviewed,false);
  assert.equal(metadata.extraction.pages[1].page,2);assert.ok(plans.some(plan=>plan.sql.includes('FOR UPDATE')));
  assert.ok(plans.some(plan=>plan.sql.includes("set_config('learnly.api_write'")));assert.deepEqual(events,['begin','commit']);
  plans.length=0;owned=false;
  await assert.rejects(store.save('session',{id:'material',storageKey:'key',storageBucket:'learnly-materials',file,...normalizeFileExtraction(extraction,file)}),error=>error.code==='NOT_FOUND');
  assert.ok(!plans.some(plan=>plan.sql.includes('INSERT')));assert.equal(events.at(-1),'rollback');
});
