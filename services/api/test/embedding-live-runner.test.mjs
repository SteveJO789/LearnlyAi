import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
function fixture({price='.00000002',maxCalls=3,existingReservation=0}={}){
 const root=mkdtempSync(join(tmpdir(),'learnly-embedding-budget-'));
 try{
  const ledger=join(root,'ledger.json'),output=join(root,'output.json'),loader=join(root,'transport.mjs');
  writeFileSync(ledger,JSON.stringify({budgetUSD:1,entries:existingReservation?[{reservedUSD:existingReservation,reportedCostUSD:0}]:[]}));
  writeFileSync(loader,`globalThis.fetch=async(url,init)=>{
    if(url==='https://openrouter.ai/api/v1/embeddings/models')return Response.json({data:[{id:'fixture/embedding',pricing:{prompt:${JSON.stringify(price)},completion:'0'}}]});
    if(url!=='https://openrouter.ai/api/v1/embeddings')throw Error('Unexpected URL');
    const body=JSON.parse(init.body);
    if(body.provider?.allow_fallbacks!==false||body.provider?.max_price?.prompt!==Number(${JSON.stringify(price)})*1000000||body.provider?.max_price?.completion!==0||body.provider?.max_price?.request!==0)throw Error('Missing native budget ceiling');
    const vectors=body.input.map((text,index)=>({index,embedding:Array.from({length:1536},(_,i)=>i===0?1:0)}));
    return Response.json({model:'fixture/embedding',data:vectors,usage:{prompt_tokens:100,cost:.000001}});
  };`);
  const result=spawnSync(process.execPath,['--import',pathToFileURL(loader).href,'evaluation/rag/run-embedding-live.mjs','--model=fixture/embedding','--budget-usd=1',`--max-calls=${maxCalls}`,`--ledger=${ledger}`,`--output=${output}`],
   {cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:20000,env:{...process.env,OPENROUTER_API_KEY:'explicit-offline-fixture-key'}});
  assert.equal(existsSync(ledger+'.lock'),false);
  const report=JSON.parse(readFileSync(output,'utf8'));
  assert.ok(!JSON.stringify(report).includes('explicit-offline-fixture-key'));
  return{status:result.status,report,ledger:JSON.parse(readFileSync(ledger,'utf8'))};
 }finally{
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),'learnly-embedding-budget-')));rmSync(root,{recursive:true,force:true});
 }
}
test('embedding live gate rejects expensive pricing and exhausted cumulative budget before paid request',()=>{
 for(const options of [{price:'1'},{existingReservation:.995}]){
  const result=fixture(options);assert.equal(result.status,1);assert.equal(result.report.calls,0);assert.equal(result.report.completed,false);
  assert.equal(result.ledger.entries.length,options.existingReservation?1:0);
 }
});
test('embedding live runner reserves first and obeys exact attempt limit without provider fallback/retry',()=>{
 const result=fixture({maxCalls:1});assert.equal(result.status,1);assert.equal(result.report.calls,1);assert.equal(result.ledger.entries.length,1);
 assert.equal(result.ledger.entries[0].operation,'EMBEDDING_EVALUATION');assert.equal(result.ledger.entries[0].reservedUSD,.01);
 assert.equal(result.ledger.entries[0].reportedCostUSD,.000001);assert.equal(result.report.completed,false);
});
test('explicit offline transport verifies three bounded batches and preserved reviewed metadata without proving semantic quality',()=>{
 const result=fixture();assert.equal(result.status,0);assert.equal(result.report.completed,true);assert.equal(result.report.calls,3);
 assert.equal(result.report.cases.length,12);assert.equal(result.report.queryVectors.length,12);
 assert.ok(result.report.queryVectors.every(vector=>vector.length===1536));assert.equal(result.ledger.entries.length,3);
 assert.equal(result.report.budget.reservedUSD,.03);assert.equal(result.report.budget.unknownReportedCostEntries,0);
 assert.ok(result.report.chunks.every(chunk=>chunk.sourceIds.length>0));
});
