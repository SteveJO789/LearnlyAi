import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname,join,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

function runFixture({price='0.0000003',maxCalls=13,numericOnly=false}={}) {
  const root=mkdtempSync(join(tmpdir(),'learnly-live-budget-test-'));
  try {
    const loader=join(root,'fake-transport.mjs'),output=join(root,'output.json'),ledger=join(root,'ledger.json');
    const scenarioModule=new URL('../dist/modules/ai/mock-tutor-scenario.js',import.meta.url).href;
    writeFileSync(loader,`import { mockTutorScenario } from ${JSON.stringify(scenarioModule)};
      globalThis.fetch=async(url,init)=>{
        if(url==='https://openrouter.ai/api/v1/models') return Response.json({data:[{id:'fixture/model',pricing:{prompt:${JSON.stringify(price)},completion:${JSON.stringify(price)}}}]});
        if(url!=='https://openrouter.ai/api/v1/chat/completions') throw new Error('Unexpected external URL');
        const body=JSON.parse(init.body);
        if(body.provider?.allow_fallbacks!==false || body.provider?.max_price?.prompt!==Number(${JSON.stringify(price)})*1000000 || body.provider?.max_price?.completion!==Number(${JSON.stringify(price)})*1000000) throw new Error('Native price ceiling is missing');
        const output=mockTutorScenario({messages:body.messages});
        return Response.json({model:'fixture/model',choices:[{message:{content:JSON.stringify(output)},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:100,cost:0.0001}});
      };`);
    const result=spawnSync(process.execPath,['--import',pathToFileURL(loader).href,'evaluation/rag/run-adaptive-live.mjs','--budget-usd=1',`--max-calls=${maxCalls}`,`--ledger=${ledger}`,`--output=${output}`,...(numericOnly?['--numeric-only']:[])],
      {cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:20000,env:{...process.env,AI_PROVIDER:'openrouter',OPENROUTER_API_KEY:'offline-fixture-key',OPENROUTER_MODEL:'fixture/model',OPENROUTER_BASE_URL:'https://openrouter.ai/api/v1'}});
    assert.equal(result.status,0,result.stderr);assert.equal(existsSync(ledger+'.lock'),false);
    return {report:JSON.parse(readFileSync(output,'utf8')),ledger:existsSync(ledger)?JSON.parse(readFileSync(ledger,'utf8')):null};
  } finally {
    assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(resolve(root).startsWith(join(resolve(tmpdir()),'learnly-live-budget-test-')));
    rmSync(root,{recursive:true,force:true});
  }
}
test('live evaluation budget gate rejects expensive calls before contacting paid transport',()=>{
  const {report,ledger}=runFixture({price:'1'});
  assert.equal(report.calls,0);assert.equal(report.budget.reservedUSD,0);assert.equal(ledger,null);
  assert.ok(report.records.every(record=>record.status!=='ACCEPTED'));
});
test('live evaluation enforces cumulative reservations and exact attempt limit across conversations',()=>{
  const {report,ledger}=runFixture({maxCalls:1});
  assert.equal(report.calls,1);assert.equal(ledger.entries.length,1);assert.ok(report.budget.reservedUSD<=1);
  assert.equal(ledger.entries[0].status,'RETURNED');assert.equal(ledger.entries[0].reportedCostUSD,0.0001);
  assert.equal(report.records.filter(record=>record.status==='ACCEPTED').length,1);
});
test('all five live scenarios execute against an explicitly injected offline transport with preserved engine authority',()=>{
  const {report,ledger}=runFixture();
  assert.equal(report.records.length,13);assert.equal(report.calls,13);assert.equal(ledger.entries.length,13);
  assert.ok(report.records.every(record=>record.status==='ACCEPTED'&&record.engineBinding&&record.retrievalMatches));
  assert.ok(report.budget.reservedUSD<=1);assert.equal(new Set(report.records.map(record=>record.scenario)).size,5);
});
test('numeric-only live evaluation executes exactly three explicit offline fixture turns with current grounding',()=>{
  const {report,ledger}=runFixture({maxCalls:3,numericOnly:true});
  assert.equal(report.calls,3);assert.equal(ledger.entries.length,3);assert.equal(report.records.length,3);
  assert.ok(report.records.every(record=>record.status==='ACCEPTED'&&record.engineBinding&&record.retrievalMatches));
});
