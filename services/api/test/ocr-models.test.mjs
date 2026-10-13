import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { prepareOcrModels, verifyOcrModels, readVerifiedOcrArtifact } from '../dist/modules/input/ocr-models.js';
const specification=bytes=>({bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
async function scratch(t){
  const root=await mkdtemp(join(tmpdir(),'learnly-ocr-assets-'));
  t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),'learnly-ocr-assets-')));await rm(root,{recursive:true,force:true});});
  return root;
}
test('artifact integrity checks decoded bytes for compressed HTTP headers and rejects mismatched hash/length',async()=>{
  const body=Buffer.from('Synthetic artifact bytes: not a trained OCR model'),spec=specification(body);
  const decoded=new Response(body,{headers:{'content-encoding':'gzip','content-length':'12'}});
  assert.deepEqual(await readVerifiedOcrArtifact(decoded,spec),body);
  await assert.rejects(readVerifiedOcrArtifact(new Response(body,{headers:{'content-length':'12'}}),spec),/response/);
  await assert.rejects(readVerifiedOcrArtifact(new Response(body),{...spec,sha256:'0'.repeat(64)}),/integrity/);
  await assert.rejects(readVerifiedOcrArtifact(new Response(body),{...spec,bytes:spec.bytes+1}),/integrity/);
});
test('oversize streamed OCR artifact is canceled before caching and upstream error bodies are not exposed',async()=>{
  let canceled=false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(100));},cancel(){canceled=true;}});
  await assert.rejects(readVerifiedOcrArtifact(new Response(stream),specification(Buffer.from('small'))),/size/);
  assert.equal(canceled,true);
  await assert.rejects(readVerifiedOcrArtifact(new Response('credential private provider text',{status:503}),specification(Buffer.from('small'))),error=>!error.message.includes('credential'));
});
test('missing/corrupt cached model fails offline without fetching or modifying existing bytes',async t=>{
  const root=await scratch(t);let calls=0;
  const fetchImpl=async()=>{calls++;assert.fail('offline mode must not fetch');};
  await assert.rejects(prepareOcrModels({root,fetchImpl}),/not prepared/);
  await writeFile(join(root,'eng.traineddata'),'local corrupt bytes');
  await assert.rejects(prepareOcrModels({root,fetchImpl}),/not prepared/);
  assert.equal(calls,0);assert.equal(await readFile(join(root,'eng.traineddata'),'utf8'),'local corrupt bytes');
  await assert.rejects(verifyOcrModels(root),/integrity/);
});
test('explicit download uses only pinned official origin/no redirects/deadline and retains cache on invalid bytes',async t=>{
  const root=await scratch(t);await writeFile(join(root,'eng.traineddata'),'previous bytes');
  let request;
  await assert.rejects(prepareOcrModels({root,download:true,fetchImpl:async(url,init)=>{request={url,init};return new Response('wrong model');}}),error=>error.message==='OCR model preparation failed. No unverified model can be used.');
  assert.equal(request.url,'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/87416418657359cb625c412a48b6e1d6d41c29bd/eng.traineddata');
  assert.equal(request.init.redirect,'error');assert.ok(request.init.signal instanceof AbortSignal);assert.equal(request.init.headers,undefined);
  assert.equal(await readFile(join(root,'eng.traineddata'),'utf8'),'previous bytes');
  assert.deepEqual(await readdir(root),['eng.traineddata']);
});
