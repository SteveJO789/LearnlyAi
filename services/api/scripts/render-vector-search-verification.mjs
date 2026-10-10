import { writeFileSync } from 'node:fs';
import { PrismaVectorSearch } from '../dist/prisma/prisma-vector-search.js';

const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9);
if(!output) throw Error('An explicit --output= path is required. This script only renders SQL.');
const schema='learnly_vector_verify';
const literal=value=>typeof value==='number' ? String(value) : "'"+String(value).replaceAll("'","''")+"'";
let captured;
const client={raw:{sql:(strings,...values)=>({returnsRow:()=>({build:()=>({strings,values})})})},
  query:plan=>{captured=plan;return {toArray:async()=>[]};}};
const store=new PrismaVectorSearch(client);
async function querySql(query){
  await store.search(query);
  return captured.strings.reduce((sql,part,index)=>sql+part+(index<captured.values.length?literal(captured.values[index]):''),'')
    .replaceAll('public."KnowledgeChunk"',schema+'."KnowledgeChunk"');
}
const query={vector:[1,0,0],model:'fixture/offline',dimensions:3,subject:'physics',language:'th',topK:2,minSimilarity:.8};
const normal=await querySql(query), injection=await querySql({...query,model:"fixture/' OR true --"});
const sql=`BEGIN;
DO $$ BEGIN IF to_regnamespace('${schema}') IS NOT NULL THEN RAISE EXCEPTION 'Fixture schema already exists'; END IF; END $$;
CREATE SCHEMA ${schema};
CREATE TABLE ${schema}."KnowledgeChunk" (
 "id" text PRIMARY KEY, "passageId" text NOT NULL, "passageHash" text NOT NULL, "contentHash" text NOT NULL,
 "provenanceHash" text NOT NULL, "embeddingModel" text NOT NULL, "dimensions" int NOT NULL,
 "subject" text NOT NULL, "language" text NOT NULL, "embedding" extensions.vector(3) NOT NULL,
 "approved" boolean NOT NULL);
INSERT INTO ${schema}."KnowledgeChunk" VALUES
 ('a','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','th','[1,0,0]',true),
 ('b','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','th','[1,0,0]',true),
 ('c','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','th','[1,0,0]',true),
 ('distant','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','th','[0,1,0]',true),
 ('wrong-model','synthetic-passage','fixture','fixture','fixture','another-model',3,'physics','th','[1,0,0]',true),
 ('wrong-language','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','en','[1,0,0]',true),
 ('wrong-subject','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'mathematics','th','[1,0,0]',true),
 ('not-approved','synthetic-passage','fixture','fixture','fixture','fixture/offline',3,'physics','th','[1,0,0]',false);
ALTER TABLE ${schema}."KnowledgeChunk" ENABLE ROW LEVEL SECURITY;
CREATE POLICY approved_read ON ${schema}."KnowledgeChunk" FOR SELECT TO authenticated USING ("approved");
GRANT USAGE ON SCHEMA ${schema} TO authenticated;
GRANT SELECT ON ${schema}."KnowledgeChunk" TO authenticated;
SET LOCAL ROLE authenticated;
DO $$ DECLARE ids text[]; scores float8[]; n int; BEGIN
 SELECT array_agg("chunkId" ORDER BY "chunkId"), array_agg("similarity") INTO ids,scores FROM (${normal}) ranked;
 IF ids IS DISTINCT FROM ARRAY['a','b'] OR scores IS DISTINCT FROM ARRAY[1.0,1.0]::float8[] THEN RAISE EXCEPTION 'Top-K ordering/filter/threshold failed'; END IF;
 SELECT count(*) INTO n FROM (${injection}) bound_model;
 IF n<>0 THEN RAISE EXCEPTION 'Bound model escaped filter'; END IF;
 SELECT count(*) INTO n FROM ${schema}."KnowledgeChunk" WHERE "id"='not-approved';
 IF n<>0 THEN RAISE EXCEPTION 'RLS read gate failed'; END IF;
 IF has_table_privilege(current_user,'${schema}."KnowledgeChunk"','INSERT') THEN RAISE EXCEPTION 'Reader can insert Knowledge'; END IF;
 IF has_table_privilege(current_user,'${schema}."KnowledgeChunk"','UPDATE') THEN RAISE EXCEPTION 'Reader can overwrite Knowledge'; END IF;
END $$;
RESET ROLE;
SELECT 'PASS' AS result, 'synthetic_vectors_only' AS scope, 5 AS verification_groups;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed;
`;
writeFileSync(output,sql,'utf8');
process.stdout.write(JSON.stringify({output,schema,productionTablesChanged:false,paidCalls:0,transaction:'BEGIN/ROLLBACK'}));
