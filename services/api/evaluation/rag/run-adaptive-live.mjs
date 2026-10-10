// Explicit paid evaluation only; never part of npm test/CI. Requires existing budget approval.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { OpenRouterModelProvider } from '../../dist/modules/ai/providers/openrouter-model-provider.js';
import { loadModelProviderConfig } from '../../dist/modules/ai/providers/create-model-provider.js';
import { createEvaluationHarness, inspectCitations, sanitize } from './helpers.mjs';

const arg = name => process.argv.find(value => value.startsWith(name+'='))?.slice(name.length+1);
const budget = Number(arg('--budget-usd')), maxCalls = Number(arg('--max-calls'));
const ledgerArg = arg('--ledger'), outputArg = arg('--output');
if (budget !== 1 || !Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 13 || !ledgerArg || !outputArg) {
  throw new Error('Explicit approved US$1 budget, max 13 calls, persistent ledger and new evidence output are required.');
}
const ledgerPath = resolve(ledgerArg), outputPath = resolve(outputArg);
if (existsSync(outputPath)) throw new Error('Evidence output exists; preserve prior results.');
mkdirSync(dirname(ledgerPath), {recursive:true}); mkdirSync(dirname(outputPath), {recursive:true});
const lock = ledgerPath+'.lock';
const fd = openSync(lock,'wx'); closeSync(fd);
const report = {category:'LIVE_ADAPTIVE_EVALUATION',startedAt:new Date().toISOString(),maxCalls,budgetUSD:budget,
  transport:'Actual OpenRouter; in-memory learning persistence; not Auth/DB/browser E2E',records:[],completed:false};
const checkpoint = () => writeFileSync(outputPath,JSON.stringify(sanitize(report),null,2));
let calls = 0;
let ledger;
try {
  ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath,'utf8')) : {goal:'LearnlyAI university MVP 2026-10-09',budgetUSD:1,entries:[]};
  if (ledger.budgetUSD!==budget || !Array.isArray(ledger.entries) || ledger.entries.some(entry=>!Number.isFinite(entry.reservedUSD)||entry.reservedUSD<0)) throw new Error('Invalid budget ledger.');
  const config = loadModelProviderConfig({...process.env,AI_PROVIDER:'openrouter'}).openRouter;
  const response = await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('Pricing unavailable');
  const model = (await response.json()).data.find(model=>model.id===config.model);
  const inputPrice=Number(model?.pricing?.prompt),outputPrice=Number(model?.pricing?.completion);
  if(!model || !Number.isFinite(inputPrice)||!Number.isFinite(outputPrice)||inputPrice<0||outputPrice<0 ||
    Object.entries(model.pricing).some(([key,value])=>!['prompt','completion','input_cache_read','input_cache_write'].includes(key)&&Number(value)>0)) throw new Error('Pricing cannot be bounded.');
  report.model=config.model;report.pricing={source:'https://openrouter.ai/api/v1/models',fetchedAt:new Date().toISOString(),inputPerTokenUSD:inputPrice,outputPerTokenUSD:outputPrice};
  const provider = new OpenRouterModelProvider({...config,maxRetries:0}, {fetch:async (url,init)=>{
    if (url!=='https://openrouter.ai/api/v1/chat/completions'||calls>=maxCalls) throw new Error('Evaluation request limit.');
    const body=JSON.parse(init.body);
    if(body.model!==config.model || !Number.isInteger(body.max_tokens)||body.max_tokens<1||body.max_tokens>2048 || body.stream) throw new Error('Unbounded evaluation request.');
    // UTF-8 bytes conservatively bound tokenizer input; include schema and generous framing margin.
    const inputTokenCeiling=Buffer.byteLength(JSON.stringify(body),'utf8')+4096;
    const reservedUSD=Math.max(0.01,1.5*(inputTokenCeiling*inputPrice+body.max_tokens*outputPrice));
    const total=ledger.entries.reduce((sum,entry)=>sum+entry.reservedUSD,0);
    if(total+reservedUSD>budget) throw new Error('Approved budget exhausted.');
    const entry={number:ledger.entries.length+1,at:new Date().toISOString(),model:body.model,inputTokenCeiling,maxOutputTokens:body.max_tokens,reservedUSD,status:'RESERVED'};
    ledger.entries.push(entry);writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));calls++;
    // Keep conservative reservations even if actual cost is lower or response is ambiguous.
    try {
      const response=await fetch(url,{...init,redirect:'error',body:JSON.stringify({...body,usage:{include:true}})});
      const payload=await response.clone().json().catch(()=>null);
      const cost=payload?.usage?.cost;
      if(typeof cost==='number'&&Number.isFinite(cost)&&cost>=0) entry.reportedCostUSD=cost;
      entry.status=response.ok?'RETURNED':'HTTP_ERROR';
      return response;
    } catch {entry.status='AMBIGUOUS_TRANSPORT_FAILURE';throw new Error('Evaluation transport failed.');}
    finally {writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));}
  }});
  const scenarios=[
    {id:'english-confusion',turns:[['Explain Ohm\'s law',1],['I don\'t understand',1]]},
    {id:'thai-hint',turns:[['Explain Ohm\'s law',1],['ขอคำใบ้',1]]},
    {id:'follow-up-acknowledgement',turns:[['Explain Ohm\'s law',1],['What if resistance doubles?',1],['Thanks.',0]]},
    {id:'topic-reset',turns:[['Explain Ohm\'s law',1],['Explain photosynthesis.',0],['I don\'t understand',0]]},
    {id:'attempt-and-stage',turns:[['Explain Ohm\'s law',1],['I think using V = IR gives 40 V',1],['Using Ohm\'s law, continue to practice',1,'ADVANCE']]},
  ];
  for(const scenario of scenarios){
    const h=createEvaluationHarness(provider);let failed=false;
    for(const [index,[input,expectedReferences,action='RESPOND']] of scenario.turns.entries()){
      const record={scenario:scenario.id,turn:index+1,input,action,expectedReferences};
      if(failed) record.status='NOT_RUN_PREVIOUS_TURN_FAILED';
      else {
        try {
          const output=await h.engine.process({sessionId:'adaptive-live-'+scenario.id,userInput:input,action});
          const task=JSON.parse(h.requests.at(-1).messages.at(-1).content);
          record.status='ACCEPTED';record.acceptedOutput=output;record.citations=inspectCitations(output,task);
          record.referenceCount=task.sourceMaterials.length;record.previousMessageCount=h.requests.at(-1).messages.length-2;
          record.engineBinding=output.stage===task.outputStage && ['percent','canAdvance','nextAction'].every(key=>output.progress[key]===task.progress[key]);
          record.retrievalMatches=record.referenceCount===expectedReferences;
        } catch(error){record.status='REJECTED';record.error={code:typeof error.code==='string'?error.code:'EVALUATION_FAILURE'};failed=true;}
        record.generation=h.generations.at(-1);
      }
      report.records.push(record);checkpoint();
      console.log(JSON.stringify({scenario:record.scenario,turn:record.turn,status:record.status,error:record.error?.code}));
    }
  }
  report.completed=true;
} catch {report.runnerFailure='EVALUATION_RUNNER_FAILURE';process.exitCode=1;}
finally {
  report.finishedAt=new Date().toISOString();report.calls=calls;
  report.budget={reservedUSD:ledger?.entries.reduce((sum,entry)=>sum+entry.reservedUSD,0)??null,
    reportedCostUSD:ledger?.entries.every(entry=>Number.isFinite(entry.reportedCostUSD))?ledger.entries.reduce((sum,entry)=>sum+entry.reportedCostUSD,0):null};
  checkpoint();unlinkSync(lock);
  console.log(JSON.stringify({completed:report.completed,calls,budget:report.budget}));
}
