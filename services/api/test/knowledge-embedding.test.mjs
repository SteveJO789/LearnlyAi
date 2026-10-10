import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OpenRouterEmbeddingProvider } from '../dist/modules/ai/providers/openrouter-embedding-provider.js';
import { validateEmbedding } from '../dist/modules/knowledge/embedding-port.js';
import { chunkReviewedPassage } from '../dist/modules/knowledge/reviewed-chunks.js';
const passage = { passageId:'document@1:teaching',conceptId:'document',conceptVersion:'1',sourceType:'TRUSTED_KNOWLEDGE_BASE',
  subject:'physics',language:'th',sources:[{sourceId:'original-author'}],content:'สูตร V = IR และ x²\n\n'+ 'ก'.repeat(600) +'\n\n'+ 'ข'.repeat(600) };
test('reviewed chunks preserve complete math and paragraphs with deterministic document/provenance identities', () => {
  const first = chunkReviewedPassage(passage, 700), second = chunkReviewedPassage(passage, 700);
  assert.deepEqual(first, second); assert.equal(first.length, 2);
  assert.equal(first.map(chunk => chunk.content).join('\n\n'), passage.content);
  assert.ok(first[0].content.includes('x²')); assert.equal(new Set(first.map(chunk => chunk.id)).size, 2);
  assert.ok(first.every(chunk => chunk.documentId==='document' && chunk.page===null && chunk.sourceIds[0]==='original-author'));
  assert.throws(() => chunkReviewedPassage({...passage,content:'x'.repeat(800)},700), /paragraph/);
  assert.throws(() => chunkReviewedPassage({...passage,sourceType:'USER_MATERIAL'}), /reviewed/);
  assert.throws(() => chunkReviewedPassage({...passage,sources:[]}), /reviewed/);
});
test('real embedding adapter sends bounded requests and restores indexed result order without paid calls', async () => {
  let request;
  const provider = new OpenRouterEmbeddingProvider({apiKey:'fixture-secret',model:'openai/text-embedding-3-small',dimensions:2,
    fetchImpl:async (url,init) => { request={url,init}; return Response.json({model:'openai/text-embedding-3-small',data:[
      {index:1,embedding:[0,1]},{index:0,embedding:[1,0]}]}); }});
  assert.deepEqual(await provider.embed(['one','two']), [[1,0],[0,1]]);
  assert.equal(request.url,'https://openrouter.ai/api/v1/embeddings'); assert.equal(request.init.redirect,'error');
  assert.deepEqual(JSON.parse(request.init.body),{model:provider.model,input:['one','two'],dimensions:2,encoding_format:'float'});
  await assert.rejects(provider.embed(['x'.repeat(8001)]), /limits/);
});
test('embedding transport rejects malformed vectors, mismatched identities, duplicate indices and raw errors', async () => {
  for (const embedding of [[0,0],[1],[NaN,1],[Infinity,1],['1',0],[1,,]]) assert.throws(() => validateEmbedding(embedding,2));
  assert.throws(() => validateEmbedding([1],0));
  const model='openai/text-embedding-3-small';
  for (const payload of [{model:'wrong',data:[{index:0,embedding:[1,0]}]}, {model,data:[{index:1,embedding:[1,0]}]},
    {model,data:[{index:0,embedding:[0,0]}]}, {model,data:[{index:0,embedding:[1,0]},{index:0,embedding:[0,1]}]}]) {
    const provider=new OpenRouterEmbeddingProvider({apiKey:'fixture-secret',model,dimensions:2,fetchImpl:async()=>Response.json(payload)});
    await assert.rejects(provider.embed(payload.data.length===2?['one','two']:['one']),error=>error.message==='Knowledge embedding request failed.' && !error.message.includes('fixture-secret'));
  }
  const provider=new OpenRouterEmbeddingProvider({apiKey:'fixture-secret',model,dimensions:2,fetchImpl:async()=>{throw new Error('fixture-secret private learner input');}});
  await assert.rejects(provider.embed(['one']), error=>error.message==='Knowledge embedding request failed.');
});
test('embedding provider cancels oversize streamed bodies and non-success responses', async () => {
  let canceled = false;
  const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(1024*1024+1));},cancel(){canceled=true;}});
  const options={apiKey:'fixture-secret',model:'openai/text-embedding-3-small',dimensions:2};
  await assert.rejects(new OpenRouterEmbeddingProvider({...options,fetchImpl:async()=>new Response(stream)}).embed(['one']));
  assert.equal(canceled,true);
  await assert.rejects(new OpenRouterEmbeddingProvider({...options,fetchImpl:async()=>Response.json({error:'private provider details'},{status:429})}).embed(['one']), /Knowledge embedding request failed/);
});
test('OpenRouter native OpenAI embedding name denotes the requested model, with no generic alias or dimension bypass',async()=>{
  const request='openai/text-embedding-3-small';
  const provider=new OpenRouterEmbeddingProvider({apiKey:'fixture-secret',model:request,dimensions:2,
    fetchImpl:async()=>Response.json({model:'text-embedding-3-small',data:[{index:0,embedding:[1,0]}]})});
  assert.deepEqual(await provider.embed(['one']),[[1,0]]);assert.equal(provider.model,request);
  for(const [model,responseModel,embedding] of [[request,'text-embedding-3-large',[1,0]],['different/text-embedding-3-small','text-embedding-3-small',[1,0]],
    [request,'text-embedding-3-small',[1]]]){
    const invalid=new OpenRouterEmbeddingProvider({apiKey:'fixture-secret',model,dimensions:2,
      fetchImpl:async()=>Response.json({model:responseModel,data:[{index:0,embedding}]})});
    await assert.rejects(invalid.embed(['one']),/Knowledge embedding request failed/);
  }
});
