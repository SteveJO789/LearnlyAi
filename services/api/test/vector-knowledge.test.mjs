import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VectorKnowledgeRetriever, reviewedProvenanceHash } from '../dist/modules/knowledge/vector-knowledge-retriever.js';
import { PrismaVectorSearch } from '../dist/prisma/prisma-vector-search.js';
import { knowledgeSearchText } from '../dist/modules/knowledge/local-knowledge-retriever.js';
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from '../dist/modules/knowledge/reviewed-chunks.js';
import { createKnowledgeHarness } from './knowledge-test-helpers.mjs';

function candidate(passage, similarity=.95) {
  const chunk=chunkReviewedPassage(passage)[0];
  return {chunkId:chunk.id,passageId:chunk.passageId,passageHash:chunk.passageHash,contentHash:chunk.contentHash,embeddingInputHash:reviewedChunkEmbeddingInput(passage,chunk).hash,
    provenanceHash:reviewedProvenanceHash(passage),similarity};
}
const options={topK:3,minSimilarity:.8}; // Synthetic test gate, not a calibrated production threshold.
test('semantic result requires current reviewed chunk/provenance and returns original complete teaching/citations',async t=>{
  const harness=createKnowledgeHarness(t), passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0];
  let embedded, searched;
  const reader={readPilot:async()=>passage};
  const embedding={model:'fixture/offline',dimensions:3,embed:async input=>{embedded=input;return [[1,0,0]];}};
  const store={search:async query=>{searched=query;return [candidate(passage),candidate(passage)];}};
  const result=await new VectorKnowledgeRetriever(reader,embedding,store,options).retrieve({studentInput:'แรงดันกับตัวต้านทานเกี่ยวข้องกันอย่างไร'});
  assert.deepEqual(result,[passage]); assert.equal(result[0],passage);
  assert.deepEqual(embedded,['แรงดันกับตัวต้านทานเกี่ยวข้องกันอย่างไร']);
  assert.equal(searched.model,embedding.model);assert.equal(searched.dimensions,3);
  assert.equal(searched.subject,'physics');assert.equal(searched.language,'th');assert.equal(searched.topK,3);
});
test('low-similarity, stale hashes, forged source URL, unknown chunk and non-finite results never authorize citations',async t=>{
  const harness=createKnowledgeHarness(t), passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0];
  const good=candidate(passage), embedding={model:'fixture/offline',dimensions:3,embed:async()=>[[1,0,0]]};
  const sourceChanged={...passage,sources:passage.sources.map(source=>({...source,url:'https://wrong.example/'}))};
  const variants=[{...good,similarity:.79},{...good,similarity:NaN},{...good,similarity:1.01},{...good,chunkId:'fake'},
    {...good,passageId:'fake'},{...good,passageHash:'stale'},{...good,contentHash:'stale'},{...good,embeddingInputHash:'stale'},
    {...good,provenanceHash:reviewedProvenanceHash(sourceChanged)}];
  for(const value of variants) assert.deepEqual(await new VectorKnowledgeRetriever({readPilot:async()=>passage},embedding,{search:async()=>[value]},options).retrieve({studentInput:'Ohm'}),[]);
});
test('review revoked during search and mismatched subject/language cannot trigger trusted fallback',async t=>{
  const harness=createKnowledgeHarness(t), passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0];
  let current=passage, calls=0;
  const embedding={model:'fixture/offline',dimensions:3,embed:async()=>{calls++;return [[1,0,0]];}};
  const retriever=new VectorKnowledgeRetriever({readPilot:async()=>current},embedding,{search:async()=>{current=null;return [candidate(passage)];}},options);
  assert.deepEqual(await retriever.retrieve({studentInput:'Ohm',subject:'mathematics'}),[]);
  assert.deepEqual(await retriever.retrieve({studentInput:'Ohm',language:'en'}),[]);assert.equal(calls,0);
  assert.deepEqual(await retriever.retrieve({studentInput:'Ohm'}),[]);assert.equal(calls,1);
  assert.deepEqual(await retriever.retrieve({studentInput:'Ohm'}),[]);assert.equal(calls,1);
});
test('learner follow-ups retain bounded current topic; new topic and acknowledgements do not carry previous input',()=>{
  assert.equal(knowledgeSearchText({studentInput:'40 V',previousStudentInputs:['กฎของโอห์ม','ขอคำใบ้']}),'กฎของโอห์ม\nFollow-up: 40 V');
  assert.equal(knowledgeSearchText({studentInput:'What about a transformer?',previousStudentInputs:['Ohm']}),'What about a transformer?');
  assert.equal(knowledgeSearchText({studentInput:'Explain photosynthesis',previousStudentInputs:['Ohm']}),'Explain photosynthesis');
  assert.equal(knowledgeSearchText({studentInput:'Thanks',previousStudentInputs:['Ohm']}),null);
  assert.equal(knowledgeSearchText({studentInput:'I am confused',previousStudentInputs:['x'.repeat(8000)]}).length,8000);
  assert.throws(()=>knowledgeSearchText({studentInput:'Ohm',previousStudentInputs:Array(5).fill('old')}),RangeError);
});
test('embedding/search failures remain errors; malformed oversized response cannot be silently accepted',async t=>{
  const harness=createKnowledgeHarness(t),passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0];
  const reader={readPilot:async()=>passage},embedding={model:'fixture/offline',dimensions:3,embed:async()=>[[1,0,0]]};
  await assert.rejects(new VectorKnowledgeRetriever(reader,{...embedding,embed:async()=>{throw Error('controlled provider failure');}},{search:async()=>assert.fail('must not search')},options).retrieve({studentInput:'Ohm'}),/provider failure/);
  await assert.rejects(new VectorKnowledgeRetriever(reader,embedding,{search:async()=>{throw Error('database unavailable');}},options).retrieve({studentInput:'Ohm'}),/database unavailable/);
  await assert.rejects(new VectorKnowledgeRetriever(reader,embedding,{search:async()=>Array(4).fill(candidate(passage))},options).retrieve({studentInput:'Ohm'}),/limits/);
  await assert.rejects(new VectorKnowledgeRetriever(reader,{...embedding,embed:async()=>[[0,0,0]]},{search:async()=>assert.fail('must not search')},options).retrieve({studentInput:'Ohm'}),/invalid/);
});
test('Prisma vector search binds model/filters and finite vector, rejects invalid configuration before SQL',async()=>{
  let captured,queries=0;
  const client={raw:{sql:(strings,...values)=>{captured={strings:[...strings],values};return {returnsRow:()=>({build:()=>captured})};}},
    query:()=>{queries++;return {toArray:async()=>[]};}};
  const store=new PrismaVectorSearch(client);
  const query={vector:[1,0,0],model:"fixture/' OR true --",dimensions:3,subject:'physics',language:'th',...options};
  assert.deepEqual(await store.search(query),[]);
  assert.ok(!captured.strings.join('').includes(query.model));assert.ok(captured.values.includes(query.model));
  assert.ok(captured.strings.join('').includes('OPERATOR(extensions.<=>)'));
  assert.ok(captured.values.includes('[1,0,0]'));assert.equal(queries,1);
  for(const change of [{vector:[NaN,0,0]},{vector:[0,0,0]},{dimensions:2},{topK:9},{minSimilarity:-1},{model:''}]) {
    await assert.rejects(store.search({...query,...change}));
  }
  assert.equal(queries,1);
});
test('one-concept vector pilot cannot authorize adjacent battery/transformer topics even with high similarity',async t=>{
  const harness=createKnowledgeHarness(t),passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0];
  let calls=0;
  const embedding={model:'fixture/offline',dimensions:3,embed:async()=>{calls++;return [[1,0,0]];}};
  const retriever=new VectorKnowledgeRetriever({readPilot:async()=>passage},embedding,{search:async()=>[candidate(passage,1)]},options);
  for(const studentInput of ['Explain AC voltage in a transformer.','How does a battery maintain voltage?', 'Explain photosynthesis.']){
    assert.deepEqual(await retriever.retrieve({studentInput,previousStudentInputs:["Ohm's law"]}),[]);
  }
  assert.equal(calls,0);
});
test('reviewed document title changed without content change invalidates the stored embedding input identity',async t=>{
  const harness=createKnowledgeHarness(t),passage=(await harness.retriever.retrieve({studentInput:'Ohm'}))[0],original=candidate(passage);
  const changed={...passage,title:passage.title+' revised'};
  assert.equal(chunkReviewedPassage(changed)[0].id,chunkReviewedPassage(passage)[0].id);
  assert.notEqual(reviewedChunkEmbeddingInput(changed,chunkReviewedPassage(changed)[0]).hash,original.embeddingInputHash);
  const retriever=new VectorKnowledgeRetriever({readPilot:async()=>changed},{model:'fixture/offline',dimensions:3,embed:async()=>[[1,0,0]]},
    {search:async()=>[original]},options);
  assert.deepEqual(await retriever.retrieve({studentInput:'Ohm'}),[]);
});
