// Execute real saved embeddings through adapter SQL on a transaction-local TEMP table.
// No public schema changes, learner data, Auth accounts, provider calls or persistent fixtures.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { PrismaVectorSearch } from '../../dist/prisma/prisma-vector-search.js';
import { VectorKnowledgeRetriever, reviewedProvenanceHash } from '../../dist/modules/knowledge/vector-knowledge-retriever.js';
import { LocalReviewedKnowledgeReader } from '../../dist/modules/knowledge/reviewed-knowledge-reader.js';
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from '../../dist/modules/knowledge/reviewed-chunks.js';
import { validateEmbedding } from '../../dist/modules/knowledge/embedding-port.js';
import { runtimeRoot } from './helpers.mjs';
const arg=name=>process.argv.find(value=>value.startsWith(name+'='))?.slice(name.length+1);
const inputArg=arg('--input'),outputArg=arg('--output');
if(!inputArg||!outputArg)throw Error('Explicit saved embedding input and new evidence output required.');
const input=resolve(inputArg),output=resolve(outputArg);
if(existsSync(output)||statSync(input).size>1024*1024)throw Error('Preserve prior output/bound input size.');
const saved=JSON.parse(readFileSync(input,'utf8'));
if(!saved.completed||saved.model!=='openai/text-embedding-3-small'||saved.dimensions!==1536||!Array.isArray(saved.chunks)||!Array.isArray(saved.cases)||
  !Array.isArray(saved.chunkVectors)||saved.chunks.length!==saved.chunkVectors.length||saved.chunks.length>8||saved.cases.length!==12||
  !Array.isArray(saved.queryVectors)||saved.queryVectors.length!==saved.cases.length)throw Error('Invalid verified embedding report.');
for(const vector of [...saved.chunkVectors,...saved.queryVectors])validateEmbedding(vector,1536);
const supabase=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!supabase||new URL(supabase).hostname!=='jwnywfwcuhheyjfxmzbv.supabase.co'||!process.env.DATABASE_URL)throw Error('Explicit LearnlyAI database configuration required.');
const reader=new LocalReviewedKnowledgeReader(runtimeRoot),passage=await reader.readPilot();
if(!passage||reviewedProvenanceHash(passage)!==saved.passage.provenanceHash||JSON.stringify(chunkReviewedPassage(passage))!==JSON.stringify(saved.chunks))throw Error('Reviewed passage differs from paid evaluation input.');
if(saved.embeddingTemplate!=='reviewed-title-concept-content-v1'||JSON.stringify(saved.embeddingInputs)!==JSON.stringify(saved.chunks.map(chunk=>reviewedChunkEmbeddingInput(passage,chunk))))throw Error('Reviewed embedding input identity changed.');
const report={category:'REAL_EMBEDDING_PGVECTOR_VERIFICATION',startedAt:new Date().toISOString(),model:saved.model,dimensions:1536,
  scope:'Saved actual embeddings + pg execution of captured Prisma adapter SQL/TEMP RLS, not actual Auth/Prisma runtime or production migration',additionalPaidCalls:0,records:[],completed:false};
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:3000,options:'-c statement_timeout=10000'});
let connection,phase='CONNECT';
try{
  connection=await pool.connect();await connection.query('BEGIN');
  phase='VERIFY_CAPABILITIES';
  const privileges=(await connection.query("SELECT has_database_privilege(current_database(),'TEMP') AS temp, pg_has_role(current_user,'authenticated','SET') AS can_set_authenticated")).rows[0];
  if(!privileges.temp||!privileges.can_set_authenticated)throw Error('Required TEMP/role privileges unavailable');
  report.capabilities=(await connection.query("SELECT has_schema_privilege(current_user,'extensions','USAGE') AS connection_extensions_usage, has_schema_privilege('authenticated','extensions','USAGE') AS authenticated_extensions_usage")).rows[0];
  // Match the API's existing role binding; do not grant permanent privileges to its connection role.
  await connection.query('SET LOCAL ROLE authenticated');
  if((await connection.query(`SELECT to_regclass('pg_temp."KnowledgeChunk"') IS NOT NULL AS exists`)).rows[0].exists)throw Error('Temporary fixture collision');
  phase='CREATE_TEMP_TABLE';
  await connection.query(`CREATE TEMP TABLE "KnowledgeChunk" (
    "id" text PRIMARY KEY,"passageId" text NOT NULL,"passageHash" text NOT NULL,"contentHash" text NOT NULL,"embeddingInputHash" text NOT NULL,
    "provenanceHash" text NOT NULL,"embeddingModel" text NOT NULL,"dimensions" int NOT NULL,"subject" text NOT NULL,"language" text NOT NULL,
    "embedding" extensions.vector(1536) NOT NULL,"reviewed" boolean NOT NULL) ON COMMIT DROP`);
  phase='INSERT_REVIEWED_VECTORS';
  for(const [index,chunk] of saved.chunks.entries())await connection.query(`INSERT INTO pg_temp."KnowledgeChunk" VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::extensions.vector,$12)`,
    [chunk.id,chunk.passageId,chunk.passageHash,chunk.contentHash,saved.embeddingInputs[index].hash,saved.passage.provenanceHash,saved.model,1536,chunk.subject,chunk.language,JSON.stringify(saved.chunkVectors[index]),true]);
  await connection.query(`INSERT INTO pg_temp."KnowledgeChunk" SELECT 'unreviewed-fixture',"passageId","passageHash","contentHash","embeddingInputHash","provenanceHash","embeddingModel","dimensions","subject","language","embedding",false FROM pg_temp."KnowledgeChunk" LIMIT 1`);
  phase='SET_READ_POLICIES';
  await connection.query('ALTER TABLE pg_temp."KnowledgeChunk" ENABLE ROW LEVEL SECURITY');
  // The authenticated test role owns its TEMP table; force policies instead of owner exemption.
  await connection.query('ALTER TABLE pg_temp."KnowledgeChunk" FORCE ROW LEVEL SECURITY');
  await connection.query('CREATE POLICY reviewed_read ON pg_temp."KnowledgeChunk" FOR SELECT TO authenticated USING ("reviewed")');
  await connection.query('GRANT SELECT ON pg_temp."KnowledgeChunk" TO authenticated');
  await connection.query('SET LOCAL ROLE authenticated');
  phase='VERIFY_FORCED_RLS';
  if((await connection.query(`SELECT count(*)::int AS n FROM pg_temp."KnowledgeChunk" WHERE "id"='unreviewed-fixture'`)).rows[0].n!==0)throw Error('Unreviewed temporary row bypasses RLS');
  await connection.query('SAVEPOINT verify_no_student_publish');
  let writeDenied=false;
  try{await connection.query(`INSERT INTO pg_temp."KnowledgeChunk" SELECT 'student-publish-fixture',"passageId","passageHash","contentHash","embeddingInputHash","provenanceHash","embeddingModel","dimensions","subject","language","embedding",true FROM pg_temp."KnowledgeChunk" LIMIT 1`);}
  catch(error){if(error?.code==='42501')writeDenied=true;else throw error;}
  await connection.query('ROLLBACK TO SAVEPOINT verify_no_student_publish');
  if(!writeDenied)throw Error('Authenticated reader can publish Knowledge');
  report.rls={forced:true,unreviewedRowHidden:true,authenticatedPublishDenied:true};
  // The SQL is generated by the real read adapter. Only the fixed test table reference is remapped.
  const client={raw:{sql:(strings,...values)=>({returnsRow:()=>({build:()=>({strings,values})})})},query:plan=>({toArray:async()=>{
    const sql=plan.strings.reduce((sql,part,index)=>sql+part+(index<plan.values.length?'$'+(index+1):''),'').replaceAll('public."KnowledgeChunk"','pg_temp."KnowledgeChunk"');
    return(await connection.query(sql,plan.values)).rows;
  }})};
  phase='QUERY_VECTOR_SCORES';
  const store=new PrismaVectorSearch(client),scores=[];
  for(const [index,item] of saved.cases.entries()){
    const rows=await store.search({vector:saved.queryVectors[index],model:saved.model,dimensions:1536,subject:passage.subject,language:passage.language,topK:3,minSimilarity:0});
    scores.push({id:item.id,partition:item.partition,expected:item.expected,similarity:rows[0]?.similarity??-1});
  }
  report.scores=scores;
  const calibration=scores.filter(item=>item.partition==='calibration');
  const positiveMin=Math.min(...calibration.filter(item=>item.expected).map(item=>item.similarity)),negativeMax=Math.max(...calibration.filter(item=>!item.expected).map(item=>item.similarity));
  report.calibration={positiveMin,negativeMax,separable:positiveMin>negativeMax,threshold:positiveMin>negativeMax?Math.max(0,(positiveMin+negativeMax)/2):null};
  report.rawVectorOnlyRegression=scores.filter(item=>item.partition==='holdout').map(item=>({id:item.id,expected:item.expected,
    retrieved:report.calibration.threshold!==null&&item.similarity>=report.calibration.threshold,
    matchesExpectation:report.calibration.threshold!==null&&(item.similarity>=report.calibration.threshold)===item.expected}));
  if(report.calibration.threshold!==null){
    const vectors=new Map(saved.cases.map((item,index)=>[item.searchText,saved.queryVectors[index]]));
    const cachedActualEmbeddings={model:saved.model,dimensions:1536,embed:async inputs=>inputs.map(text=>{const vector=vectors.get(text);if(!vector)throw Error('No saved actual query embedding');return vector;})};
    phase='RETRIEVE_REVIEWED_HOLDOUT';
    const retriever=new VectorKnowledgeRetriever(reader,cachedActualEmbeddings,store,{topK:3,minSimilarity:report.calibration.threshold});
    for(const item of saved.cases.filter(item=>item.partition==='holdout')){
      const found=await retriever.retrieve(item);
      report.records.push({id:item.id,expected:item.expected,retrieved:found.length>0,matchesExpectation:(found.length>0)===item.expected,
        currentReviewedIdentity:found.every(result=>result.passageId===passage.passageId&&reviewedProvenanceHash(result)===saved.passage.provenanceHash)});
    }
    report.holdoutPassed=report.records.every(item=>item.matchesExpectation&&item.currentReviewedIdentity);
  }else report.holdoutPassed=false;
  report.completed=true;
}catch(error){
  report.runnerFailure='POSTGRES_EMBEDDING_VERIFICATION_FAILED';
  report.failurePhase=phase;
  if(typeof error?.code==='string'&&/^[A-Z0-9_]{1,30}$/u.test(error.code))report.safeErrorCode=error.code;
  process.exitCode=1;
}finally{
  if(connection){
    try{await connection.query('ROLLBACK');report.fixtureRemoved=(await connection.query(`SELECT to_regclass('pg_temp."KnowledgeChunk"') IS NULL AS removed`)).rows[0].removed;}
    catch{report.cleanupVerificationFailed=true;process.exitCode=1;}
    connection.release();
  }
  await pool.end();report.finishedAt=new Date().toISOString();writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({completed:report.completed,calibration:report.calibration,holdoutPassed:report.holdoutPassed,fixtureRemoved:report.fixtureRemoved,error:report.runnerFailure,code:report.safeErrorCode,phase:report.failurePhase,capabilities:report.capabilities}));
}
