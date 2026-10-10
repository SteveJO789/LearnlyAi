// Explicit budgeted paid evaluation, never a normal CI command. No provider/model retries.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { LocalReviewedKnowledgeReader } from '../../dist/modules/knowledge/reviewed-knowledge-reader.js';
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from '../../dist/modules/knowledge/reviewed-chunks.js';
import { reviewedProvenanceHash } from '../../dist/modules/knowledge/vector-knowledge-retriever.js';
import { knowledgeSearchText } from '../../dist/modules/knowledge/local-knowledge-retriever.js';
import { OpenRouterEmbeddingProvider } from '../../dist/modules/ai/providers/openrouter-embedding-provider.js';
import { validateEmbedding } from '../../dist/modules/knowledge/embedding-port.js';
import { runtimeRoot } from './helpers.mjs';

const arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const model=arg('--model'),budget=Number(arg('--budget-usd')),maxCalls=Number(arg('--max-calls'));
const ledgerArg=arg('--ledger'),outputArg=arg('--output');
const reuseArg=arg('--reuse-queries');
if(budget!==1||!Number.isInteger(maxCalls)||maxCalls<1||maxCalls>3||!ledgerArg||!outputArg||
  typeof model!=='string'||!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(model))throw Error('Explicit approved budget/model/max3calls/shared ledger/new output required.');
const ledgerPath=resolve(ledgerArg),outputPath=resolve(outputArg);
if(!existsSync(ledgerPath)||existsSync(outputPath))throw Error('Existing budget ledger and unused evidence path required.');
let reused;
if(reuseArg){
  reused=JSON.parse(readFileSync(resolve(reuseArg),'utf8'));
  if(!reused.completed||reused.model!==model||reused.dimensions!==1536||!Array.isArray(reused.queryVectors)||reused.queryVectors.length!==12)throw Error('Invalid reusable actual query embeddings');
  for(const vector of reused.queryVectors)validateEmbedding(vector,1536);
}
mkdirSync(dirname(outputPath),{recursive:true});
const lock=ledgerPath+'.lock',fd=openSync(lock,'wx');closeSync(fd);
let calls=0,ledger;
const report={category:'LIVE_REVIEWED_EMBEDDING_EVALUATION',startedAt:new Date().toISOString(),model,dimensions:1536,
  scope:'Actual embeddings on current reviewed pilot + synthetic learner queries; not production ingestion/Auth/browser',completed:false,calls:0};
const checkpoint=()=>writeFileSync(outputPath,JSON.stringify(report,null,2));
try{
  ledger=JSON.parse(readFileSync(ledgerPath,'utf8'));
  if(ledger.budgetUSD!==1||!Array.isArray(ledger.entries)||ledger.entries.some(entry=>!Number.isFinite(entry.reservedUSD)||entry.reservedUSD<0))throw Error('Invalid shared ledger');
  const reader=new LocalReviewedKnowledgeReader(runtimeRoot),passage=await reader.readPilot();
  if(!passage)throw Error('No reviewed passage');
  const chunks=chunkReviewedPassage(passage);
  if(chunks.length>8)throw Error('Reviewed index batch exceeds limits');
  const catalogUrl='https://openrouter.ai/api/v1/embeddings/models';
  const catalogResponse=await fetch(catalogUrl,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!catalogResponse.ok)throw Error('Embedding pricing unavailable');
  const metadata=(await catalogResponse.json()).data.find(item=>item.id===model);
  const inputPrice=Number(metadata?.pricing?.prompt),outputPrice=Number(metadata?.pricing?.completion);
  if(!metadata||!Number.isFinite(inputPrice)||inputPrice<0||outputPrice!==0||
    Object.entries(metadata.pricing).some(([key,value])=>!['prompt','completion','input_cache_read','input_cache_write'].includes(key)&&Number(value)>0))throw Error('Cannot bound embedding pricing');
  report.pricing={catalogUrl,fetchedAt:new Date().toISOString(),inputPerTokenUSD:inputPrice,outputPerTokenUSD:outputPrice};
  const provider=new OpenRouterEmbeddingProvider({apiKey:process.env.OPENROUTER_API_KEY??'',model,dimensions:1536,fetchImpl:async(url,init)=>{
    if(url!=='https://openrouter.ai/api/v1/embeddings'||calls>=maxCalls)throw Error('Evaluation call limit');
    const body=JSON.parse(init.body);
    if(body.model!==model||body.dimensions!==1536||body.encoding_format!=='float'||!Array.isArray(body.input)||body.input.length<1||body.input.length>8||
      body.input.some(text=>typeof text!=='string'||!text.trim()||text.length>8000))throw Error('Unbounded embedding input');
    const inputTokenCeiling=Buffer.byteLength(JSON.stringify(body),'utf8')+4096;
    const reservedUSD=Math.max(.01,1.5*inputTokenCeiling*inputPrice),total=ledger.entries.reduce((sum,entry)=>sum+entry.reservedUSD,0);
    if(total+reservedUSD>budget)throw Error('Shared approved budget exhausted');
    const entry={number:ledger.entries.length+1,at:new Date().toISOString(),operation:'EMBEDDING_EVALUATION',model,inputTokenCeiling,maxOutputTokens:0,reservedUSD,status:'RESERVED'};
    ledger.entries.push(entry);writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));calls++;
    try{
      const response=await fetch(url,{...init,redirect:'error',body:JSON.stringify({...body,
        provider:{max_price:{prompt:inputPrice*1000000,completion:0,request:0},allow_fallbacks:false}})});
      entry.status=response.ok?'RETURNED':'HTTP_ERROR';
      if(!response.ok){await response.body?.cancel();return new Response(null,{status:response.status});}
      const stream=response.body.getReader(),parts=[];let bytes=0;
      for(;;){const next=await stream.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>1024*1024){await stream.cancel();throw Error('Embedding response too large');}parts.push(next.value);}
      const payload=JSON.parse(Buffer.concat(parts).toString('utf8')),cost=payload?.usage?.cost;
      // Fixed schema diagnostics only; never retain upstream body/model text/credentials on failure.
      const rows=Array.isArray(payload?.data)?payload.data:[];
      (report.responseChecks??=[]).push({modelMatches:payload?.model===model,
        modelMatchesKnownOpenAiBasename:model.startsWith('openai/')&&payload?.model===model.slice('openai/'.length),
        dataIsArray:Array.isArray(payload?.data),expectedCount:body.input.length,actualCount:rows.length,
        dimensions:rows.map(row=>Array.isArray(row?.embedding)?row.embedding.length:null),
        indicesValid:rows.every(row=>Number.isInteger(row?.index)&&row.index>=0&&row.index<body.input.length)&&new Set(rows.map(row=>row?.index)).size===rows.length,
        finiteNonzeroVectors:rows.every(row=>Array.isArray(row?.embedding)&&row.embedding.every(value=>typeof value==='number'&&Number.isFinite(value))&&row.embedding.some(value=>value!==0))});
      if(typeof cost==='number'&&Number.isFinite(cost)&&cost>=0)entry.reportedCostUSD=cost;
      const tokens=payload?.usage?.prompt_tokens;
      if(Number.isSafeInteger(tokens)&&tokens>=0)entry.reportedPromptTokens=tokens;
      return Response.json(payload);
    }catch{entry.status='AMBIGUOUS_TRANSPORT_FAILURE';throw Error('Embedding evaluation transport failed');}
    finally{writeFileSync(ledgerPath,JSON.stringify(ledger,null,2));}
  }});
  report.passage={id:passage.passageId,conceptId:passage.conceptId,version:passage.conceptVersion,subject:passage.subject,language:passage.language,
    provenanceHash:reviewedProvenanceHash(passage)};
  report.chunks=chunks;
  report.embeddingInputs=chunks.map(chunk=>reviewedChunkEmbeddingInput(passage,chunk));
  report.embeddingTemplate='reviewed-title-concept-content-v1';
  const cases=[
    {id:'calibration-th-ohm',partition:'calibration',expected:true,studentInput:'กฎของโอห์มคืออะไร'},
    {id:'calibration-en-ohm',partition:'calibration',expected:true,studentInput:"Explain Ohm's law"},
    {id:'calibration-photosynthesis',partition:'calibration',expected:false,studentInput:'Explain photosynthesis.'},
    {id:'calibration-project',partition:'calibration',expected:false,studentInput:'current project status'},
    {id:'holdout-th-givens',partition:'holdout',expected:true,studentInput:'ตัวต้านทาน 20 Ω มีกระแส 2 A ต้องหาความต่างศักย์อย่างไร'},
    {id:'holdout-en-givens',partition:'holdout',expected:true,studentInput:'Current is 2 A through a 20 ohm resistor. How do I find voltage?'},
    {id:'holdout-numeric-context',partition:'holdout',expected:true,studentInput:'40 V',previousStudentInputs:['กฎของโอห์ม I = 2 A, R = 20 Ω ต้องหาค่า V']},
    {id:'holdout-confusion-context',partition:'holdout',expected:true,studentInput:"I don't understand",previousStudentInputs:["Explain Ohm's law"]},
    {id:'holdout-transformer',partition:'holdout',expected:false,studentInput:'Explain AC voltage in a transformer.'},
    {id:'holdout-battery',partition:'holdout',expected:false,studentInput:'How does a battery maintain voltage?'},
    {id:'holdout-antibiotic',partition:'holdout',expected:false,studentInput:'Explain antibiotic resistance in bacteria.'},
    {id:'holdout-topic-reset',partition:'holdout',expected:false,studentInput:'Explain photosynthesis.',previousStudentInputs:["Ohm's law"]}
  ];
  report.cases=cases.map(item=>({...item,searchText:knowledgeSearchText(item)}));report.queryVectors=[];
  if(reuseArg&&JSON.stringify(reused.cases)!==JSON.stringify(report.cases))throw Error('Cannot reuse different query/model evidence');
  report.chunkVectors=await provider.embed(report.embeddingInputs.map(item=>item.text));checkpoint();
  if(reuseArg){
    report.queryVectors=reused.queryVectors;report.queryVectorsReused=true;
  }else for(let start=0;start<cases.length;start+=8){report.queryVectors.push(...await provider.embed(report.cases.slice(start,start+8).map(item=>item.searchText)));checkpoint();}
  const current=await reader.readPilot();
  if(!current||reviewedProvenanceHash(current)!==report.passage.provenanceHash||JSON.stringify(chunkReviewedPassage(current))!==JSON.stringify(chunks))throw Error('Reviewed source changed during evaluation');
  report.completed=true;
}catch{report.runnerFailure='EMBEDDING_EVALUATION_FAILED';process.exitCode=1;}
finally{
  report.finishedAt=new Date().toISOString();report.calls=calls;
  report.budget={reservedUSD:ledger?.entries.reduce((sum,entry)=>sum+entry.reservedUSD,0)??null,
    reportedCostUSD:ledger?.entries.every(entry=>Number.isFinite(entry.reportedCostUSD))?ledger.entries.reduce((sum,entry)=>sum+entry.reportedCostUSD,0):null,
    unknownReportedCostEntries:ledger?.entries.filter(entry=>!Number.isFinite(entry.reportedCostUSD)).length??null};
  checkpoint();unlinkSync(lock);
  console.log(JSON.stringify({completed:report.completed,calls,budget:report.budget,error:report.runnerFailure}));
}
