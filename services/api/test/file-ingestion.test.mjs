import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FileIngestion, normalizeFileExtraction, validatePreparedFileMaterial } from '../dist/modules/input/file-ingestion.js';
import { inspectFileEnvelope } from '../dist/modules/input/file-envelope.js';
import { PrismaFileMaterials } from '../dist/modules/input/prisma-file-materials.js';
import { ApiError } from '../dist/shared/api-error.js';
const authId='10000000-0000-0000-0000-000000000001';
// Envelope-only fixture. Extractor injection tests orchestration, not a working PDF parser/OCR.
const bytes=()=>Buffer.from('%PDF-1.7\nfixture\n%%EOF\n');
const extraction={method:'PDF_TEXT',confidence:null,pages:[{page:1,text:'  สูตร x²\r\nV = IR  '},{page:2,text:''}]};
function harness({ownerFailure,extractFailure,saveFailure,uploadFailure,removeFailure,mutateExtraction,
  saveOutcome='NOT_SAVED',resolveFailure,reserveFailure,cancelOutcome='CANCELLED',cancelFailure,verifyFailure,loadState='PENDING'}={}) {
  const events=[],saved=[],reserved=[];
  const store={assertActiveOwnedSession:async()=>{events.push('owner');if(ownerFailure)throw ownerFailure;},
    reserve:async(session,material)=>{events.push('reserve');reserved.push({session,material});if(reserveFailure)throw reserveFailure;},
    load:async()=>{events.push('load');return {state:loadState,material:reserved[0].material};},
    cancel:async()=>{events.push('cancel');if(cancelFailure)throw cancelFailure;return cancelOutcome;},
    save:async(session,material)=>{events.push('save');saved.push({session,material});if(saveFailure)throw saveFailure;},
    resolveSave:async(session,material)=>{events.push('resolve');assert.equal(session,saved[0].session);
      assert.equal(material,saved[0].material);if(resolveFailure)throw resolveFailure;return saveOutcome;}};
  const storage={bucketId:'learnly-materials',upload:async()=>{events.push('upload');if(uploadFailure)throw uploadFailure;},
    verify:async()=>{events.push('verify');if(verifyFailure)throw verifyFailure;},remove:async()=>{events.push('remove');if(removeFailure)throw removeFailure;}};
  const extractor={extract:async(snapshot,file,signal)=>{events.push('extract');assert.equal(file.type,'PDF');assert.ok(signal instanceof AbortSignal);if(extractFailure)throw extractFailure;if(mutateExtraction)snapshot[0]=0;return extraction;}};
  const cleanup=[];
  return {events,saved,reserved,cleanup,store,storage,extractor,service:new FileIngestion(store,storage,extractor,authId,id=>cleanup.push(id))};
}
test('owned file orchestration preserves exact binary hash and actual page metadata before saving READY user material',async()=>{
  const h=harness(),original=bytes(),result=await h.service.ingest('session',original,'application/pdf','lesson.pdf');
  assert.deepEqual(h.events,['owner','extract','reserve','upload','save']);assert.equal(result.status,'READY');assert.equal(result.type,'PDF');
  const saved=h.saved[0].material;
  assert.equal(saved.normalizedText,'สูตร x²\nV = IR');assert.equal(saved.extraction.pages[1].page,2);assert.equal(saved.extraction.pages[1].text,'');
  assert.equal(saved.file.contentHash,inspectFileEnvelope(original,'application/pdf','lesson.pdf').contentHash);
  assert.ok(saved.storageKey.startsWith(authId+'/session/'));assert.ok(!('storageKey' in result));
  assert.equal(saved.storageBucket,'learnly-materials');assert.ok(!('storageBucket' in result));
  assert.notEqual(saved.normalizedHash,saved.file.contentHash);
});
test('unconfirmed durable reservation never starts a Storage request and leaves only a redacted operator ID',async()=>{
  const h=harness({reserveFailure:Error('COMMIT acknowledgement missing with credential')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),e=>e.code==='FILE_RECONCILIATION_REQUIRED'&&!e.message.includes('credential'));
  assert.deepEqual(h.events,['owner','extract','reserve']);assert.deepEqual(h.cleanup,[h.reserved[0].material.id]);
});
test('an extractor returning after its deadline never creates a durable intent or uploads bytes',async context=>{
  context.mock.method(AbortSignal,'timeout',()=>AbortSignal.abort());
  const h=harness();
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),e=>e.code==='FILE_PROCESSING_TIMEOUT');
  assert.deepEqual(h.events,['owner','extract']);assert.equal(h.reserved.length,0);
});
test('a restarted coordinator resumes an ambiguous upload using durable intent and exact-byte verification without decoding or uploading twice',async()=>{
  const h=harness({uploadFailure:new ApiError('STORAGE_UNAVAILABLE',503,'Upload acknowledgement missing')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),ApiError);
  assert.equal(h.saved.length,0);const intent=h.reserved[0].material;
  h.events.length=0;
  const restarted=new FileIngestion(h.store,h.storage,h.extractor,authId);
  const result=await restarted.resume('session',intent.id);
  assert.equal(result.status,'READY');assert.equal(result.materialId,intent.id);
  assert.deepEqual(h.events,['load','verify','save']);assert.ok(!('storageKey' in result));
});
test('missing/corrupt stored bytes never finalize; cancelled intent retries cleanup without resurrection',async()=>{
  const corrupt=harness({verifyFailure:new ApiError('FILE_INTEGRITY_ERROR',422,'Stored file mismatch')});
  await corrupt.service.ingest('session',bytes(),'application/pdf','lesson.pdf');corrupt.events.length=0;corrupt.saved.length=0;
  await assert.rejects(corrupt.service.resume('session',corrupt.reserved[0].material.id),e=>e.code==='FILE_INTEGRITY_ERROR');
  assert.deepEqual(corrupt.events,['load','verify']);assert.equal(corrupt.saved.length,0);
  const cancelled=harness({loadState:'CANCELLED',uploadFailure:Error('upload response lost')});
  await assert.rejects(cancelled.service.ingest('session',bytes(),'application/pdf','lesson.pdf'));cancelled.events.length=0;
  const result=await cancelled.service.resume('session',cancelled.reserved[0].material.id);
  assert.equal(result.status,'CANCELLED');assert.deepEqual(cancelled.events,['load','remove']);
  cancelled.storage.remove=async()=>{throw Error('private Storage error');};
  await assert.rejects(cancelled.service.resume('session',cancelled.reserved[0].material.id),e=>e.code==='FILE_CLEANUP_REQUIRED'&&!e.message.includes('private'));
});
test('concurrent finalization wins over cancellation; ambiguous cancellation never deletes',async()=>{
  const won=harness({saveFailure:Error('transient'),cancelOutcome:'SAVED'});
  assert.equal((await won.service.ingest('session',bytes(),'application/pdf','lesson.pdf')).status,'READY');
  assert.ok(won.events.includes('cancel'));assert.ok(!won.events.includes('remove'));
  for(const options of [{cancelOutcome:'UNKNOWN'},{cancelFailure:Error('lost cancel COMMIT response')}]){
    const h=harness({saveFailure:Error('transient'),...options});
    await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),e=>e.code==='FILE_RECONCILIATION_REQUIRED');
    assert.ok(!h.events.includes('remove'));
  }
});
test('durable intent validation rejects forged paths, mismatched text/hash and binary metadata before Storage access',async()=>{
  const h=harness();await h.service.ingest('session',bytes(),'application/pdf','lesson.pdf');
  const m=h.reserved[0].material;
  for(const changed of [{storageKey:'https://evil.test/file'},{storageBucket:'foreign-bucket'},{normalizedText:'fabricated'},
    {normalizedHash:'0'.repeat(64)},{file:{...m.file,sizeBytes:4*1024*1024}},{file:{...m.file,mimeType:'image/png'}}]){
    assert.throws(()=>validatePreparedFileMaterial({...m,...changed},'session',m.id,authId,'learnly-materials'),ApiError);
  }
  assert.equal(validatePreparedFileMaterial(m,'session',m.id,authId,'learnly-materials').normalizedHash,m.normalizedHash);
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
test('confirmed upload is compensated only after persistence absence is verified; cleanup failure records only material ID',async()=>{
  const h=harness({saveFailure:Error('database credentials/private query')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='MATERIAL_PERSISTENCE_UNAVAILABLE'&&!error.message.includes('credentials'));
  assert.deepEqual(h.events,['owner','extract','reserve','upload','save','resolve','cancel','remove']);
  const failed=harness({saveFailure:Error('database'),removeFailure:Error('storage secret')});
  await assert.rejects(failed.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='FILE_CLEANUP_REQUIRED'&&!error.message.includes('secret'));
  assert.deepEqual(failed.cleanup,[failed.saved[0].material.id]);assert.ok(!failed.cleanup[0].includes('/'));
});
test('lost COMMIT response returns the confirmed READY receipt without deleting the committed file or retrying save',async()=>{
  const h=harness({saveFailure:Error('socket closed after COMMIT with secret'),saveOutcome:'SAVED'});
  const result=await h.service.ingest('session',bytes(),'application/pdf','lesson.pdf');
  assert.equal(result.status,'READY');assert.equal(result.materialId,h.saved[0].material.id);
  assert.deepEqual(h.events,['owner','extract','reserve','upload','save','resolve']);assert.deepEqual(h.cleanup,[]);
});
test('unavailable, hidden, conflicting or malformed receipts preserve the uploaded object and redact failure details',async()=>{
  for(const options of [{saveOutcome:'UNKNOWN'},{resolveFailure:Error('private query or token')},{saveOutcome:null},
    {saveOutcome:'unexpected'}]){
    const h=harness({saveFailure:Error('database secret'),...options});
    await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>
      error.code==='FILE_RECONCILIATION_REQUIRED'&&error.status===503&&!/private|token|secret/.test(error.message));
    assert.ok(!h.events.includes('remove'));assert.deepEqual(h.cleanup,[h.saved[0].material.id]);
  }
});

function receiptHarness({level='read committed',owned=true,rows=[{outcome:'SAVED'}],lockFailure}={}){
  const plans=[];
  const raw={sql:(strings,...values)=>({returnsRow:()=>({build:()=>({sql:strings.join('?'),values})}),
    affectedCount:()=>({build:()=>({sql:strings.join('?'),values})})})};
  const tx={execute:async plan=>{plans.push(plan);return {affectedRows:0};},query:plan=>{
    plans.push(plan);return {toArray:async()=>{
      if(plan.sql.includes('transaction_isolation'))return [{level}];
      if(plan.sql.includes('FOR UPDATE')){if(lockFailure)throw lockFailure;return owned?[{id:'session'}]:[];}
      return rows;
    }};
  }};
  const client={raw,transaction:async work=>work(tx)};
  const file=inspectFileEnvelope(bytes(),'application/pdf','lesson.pdf');
  const material={id:'material',storageKey:authId+'/session/material.pdf',storageBucket:'learnly-materials',file,
    ...normalizeFileExtraction(extraction,file)};
  return {plans,material,store:new PrismaFileMaterials(client,'legacy-application-id')};
}
test('Prisma durable intent is committed before upload and cancellation serializes with finalization without changing a READY receipt',async()=>{
  const saved=receiptHarness();
  assert.equal(await saved.store.cancel('session',saved.material),'SAVED');
  assert.ok(saved.plans.some(p=>p.sql.includes("set_config('learnly.api_write'")));
  assert.ok(!saved.plans.some(p=>p.sql.startsWith('UPDATE')));
  const pending=receiptHarness({rows:[]});
  // Cancellation uses affectedRows=0 in this fixture: absence/hidden/mismatch must remain UNKNOWN.
  assert.equal(await pending.store.cancel('session',pending.material),'UNKNOWN');
  const change=pending.plans.find(p=>p.sql.startsWith('UPDATE'));
  assert.ok(change.sql.includes("'CANCELLED'"));assert.ok(change.sql.includes('"material"::jsonb'));
  assert.ok(change.values.includes(JSON.stringify(pending.material)));
  assert.ok(pending.plans.findIndex(p=>p.sql.includes('FOR UPDATE'))<pending.plans.indexOf(change));
  const hidden=receiptHarness({owned:false});assert.equal(await hidden.store.cancel('session',hidden.material),'UNKNOWN');
  assert.ok(!hidden.plans.some(p=>p.sql.startsWith('UPDATE')));
});
test('cancelled or missing pending intent prevents READY insertion before any session progress change',async()=>{
  const h=receiptHarness({rows:[]});
  await assert.rejects(h.store.save('session',h.material),e=>e.code==='FILE_STATE_CONFLICT');
  assert.ok(!h.plans.some(p=>p.sql.startsWith('INSERT INTO public."SourceMaterial"')));
  assert.ok(!h.plans.some(p=>p.sql.startsWith('UPDATE public."LearningSession"')));
});
test('Prisma receipt resolution locks owner before a fresh exact receipt read, including closed sessions',async()=>{
  const h=receiptHarness();assert.equal(await h.store.resolveSave('session',h.material),'SAVED');
  const lock=h.plans.findIndex(p=>p.sql.includes('FOR UPDATE')),receipt=h.plans.findIndex(p=>p.sql.includes('CASE WHEN'));
  assert.ok(lock>0&&receipt>lock);assert.ok(h.plans[lock].values.includes('legacy-application-id'));
  assert.ok(!h.plans[lock].sql.includes("'ACTIVE'"));
  const read=h.plans[receipt];
  for(const value of [h.material.storageKey,h.material.storageBucket,h.material.file.contentHash,h.material.normalizedHash,
    h.material.normalizedText,JSON.stringify(h.material.extraction),h.material.id,'session'])assert.ok(read.values.includes(value));
  assert.ok(read.sql.includes("'LEARNER_INPUT'"));assert.ok(read.sql.includes("'READY'"));assert.ok(read.sql.includes("'false'"));
  assert.ok(h.plans.some(p=>p.sql.includes("lock_timeout = '3s'")));
  assert.ok(h.plans.some(p=>p.sql.includes("statement_timeout = '5s'")));
  assert.ok(!h.plans.some(p=>/INSERT|DELETE|UPDATE public/.test(p.sql)));
});
test('Prisma cleanup requires conclusive absence; hidden ownership and stale snapshot never authorize deletion',async()=>{
  const missing=receiptHarness({rows:[]});assert.equal(await missing.store.resolveSave('session',missing.material),'NOT_SAVED');
  for(const options of [{owned:false},{level:'repeatable read'},{level:'serializable'},{rows:[{outcome:'UNKNOWN'}]},
    {rows:[{outcome:'SAVED'},{outcome:'SAVED'}]}]){
    const h=receiptHarness(options);assert.equal(await h.store.resolveSave('session',h.material),'UNKNOWN');
    if(options.owned===false||options.level)assert.ok(!h.plans.some(p=>p.sql.includes('CASE WHEN')));
  }
  const busy=receiptHarness({lockFailure:Error('lock timeout')});
  await assert.rejects(busy.store.resolveSave('session',busy.material),/lock timeout/);
  assert.ok(!busy.plans.some(p=>p.sql.includes('CASE WHEN')));
});
test('ownership changed during persistence still compensates, ambiguous upload failure never saves or blindly deletes',async()=>{
  const h=harness({saveFailure:new ApiError('NOT_FOUND',404,'Session no longer active')});
  await assert.rejects(h.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.status===404);
  assert.ok(h.events.includes('remove'));
  const ambiguous=harness({uploadFailure:new ApiError('STORAGE_UNAVAILABLE',503,'Storage temporarily unavailable')});
  await assert.rejects(ambiguous.service.ingest('session',bytes(),'application/pdf','lesson.pdf'),error=>error.code==='STORAGE_UNAVAILABLE');
  assert.deepEqual(ambiguous.events,['owner','extract','reserve','upload']);
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
