// Render adapter SQL + canonical policies into rollback-only empty table clones.
// Does not execute SQL or copy production rows. No real decoder/OCR or Storage proof.
import { writeFileSync } from 'node:fs';
import { PrismaFileMaterials } from '../dist/modules/input/prisma-file-materials.js';
import { normalizeFileExtraction } from '../dist/modules/input/file-ingestion.js';
import { inspectFileEnvelope } from '../dist/modules/input/file-envelope.js';
import contract from '../src/prisma/contract.json' with {type:'json'};
import materialOps from '../migrations/app/20261009T1524_text_material_pipeline/ops.json' with {type:'json'};
import storageOps from '../migrations/app/20261010T0752_private_material_storage/ops.json' with {type:'json'};
import uploadOps from '../migrations/app/20261010T1119_durable_file_uploads/ops.json' with {type:'json'};
const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9);
if(!output)throw Error('Explicit --output= is required; this command only renders SQL.');
const schema='learnly_file_material_verify',tables=['User','LearningSession','SourceMaterial','FileUpload'];
const auth='11111111-1111-4111-8111-11111111ab01',peer='11111111-1111-4111-8111-11111111ab02',owner='legacy-fixture-owner';
const q=name=>'"'+name.replaceAll('"','""')+'"';
const literal=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
// Only the three fixture table references are remapped; built-in/auth types/functions stay intact.
const rewrite=sql=>tables.reduce((text,table)=>text.replaceAll(`public.${q(table)}`,`${q(schema)}.${q(table)}`)
  .replaceAll(`${q('public')}.${q(table)}`,`${q(schema)}.${q(table)}`),sql);
let captured=[];
const raw={sql:(strings,...values)=>({returnsRow:()=>({build:()=>({strings,values})}),affectedCount:()=>({build:()=>({strings,values})})})};
const query=plan=>{captured.push(plan);return{toArray:async()=>plan.strings.join('').includes('transaction_isolation')?
  [{level:'read committed'}]:plan.strings.join('').includes('CASE WHEN')?[]:[{id:'capture-only',outcome:'SAVED'}]};};
const tx={query,execute:async plan=>{captured.push(plan);return{affectedRows:1};}};
const client={raw,query,transaction:async work=>work(tx)};
const render=plan=>rewrite(plan.strings.reduce((sql,part,index)=>sql+part+(index<plan.values.length?literal(plan.values[index]):''),''));
const store=new PrismaFileMaterials(client,owner);
function preparedFile(sessionId,id,type){
  const bytes=Buffer.from('%PDF-1.7\nfixture-only\n%%EOF\n'),file=inspectFileEnvelope(bytes,'application/pdf','fixture.pdf');
  const actualFile=type==='PDF'?file:{...file,type:'IMAGE',mimeType:'image/png',extension:'png',filename:'fixture.png'};
  const extracted=normalizeFileExtraction(type==='PDF'?{method:'PDF_TEXT',confidence:null,pages:[{page:1,text:'สูตร x²\nV = IR'},{page:2,text:''}]}:
    {method:'OCR',confidence:85,pages:[{page:null,text:'โจทย์ x²'}]},actualFile);
  return {id,storageKey:`${auth}/${sessionId}/${id}.${actualFile.extension}`,storageBucket:'learnly-materials',file:actualFile,...extracted};
}
async function saveQueries(sessionId,id,type){
  captured=[];
  await store.reserve(sessionId,preparedFile(sessionId,id,type));
  await store.save(sessionId,preparedFile(sessionId,id,type));
  return captured.map(render);
}
async function cancelQueries(sessionId,id){
  captured=[];await store.cancel(sessionId,preparedFile(sessionId,id,'PDF'));return captured.map(render);
}
async function receiptQueries(sessionId,id,changes={}){
  captured=[];
  await store.resolveSave(sessionId,{...preparedFile(sessionId,id,'PDF'),...changes});
  return captured.map(render);
}
await store.assertActiveOwnedSession('file-fixture');const activeQuery=render(captured[0]);
captured=[];await store.assertActiveOwnedSession('closed-fixture');const closedQuery=render(captured[0]);
const pdf=await saveQueries('file-fixture','pdf-material','PDF'),image=await saveQueries('file-fixture','image-material','IMAGE');
const rollback=await saveQueries('rollback-fixture','rollback-material','PDF');
const reservationEnd=rollback.findIndex(sql=>sql.startsWith('INSERT INTO')&&sql.includes('"FileUpload"'))+1;
if(!reservationEnd)throw Error('Durable reservation SQL not captured');
captured=[];await store.reserve('file-fixture',preparedFile('file-fixture','cancel-material','PDF'));
const cancelIntent=captured.map(render),cancel=await cancelQueries('file-fixture','cancel-material');
const receipt=await receiptQueries('file-fixture','pdf-material');
const conflict=await receiptQueries('file-fixture','pdf-material',{storageBucket:'different-private-bucket'});
const absent=await receiptQueries('file-fixture','absent-material');
const lock=receipt.find(sql=>sql.includes('FOR UPDATE'));
const read=queries=>queries.find(sql=>sql.includes('CASE WHEN'));
const readyInsert=pdf.find(sql=>sql.startsWith('INSERT')&&sql.includes('"SourceMaterial"'));
const intentInsert=pdf.find(sql=>sql.startsWith('INSERT')&&sql.includes('"FileUpload"'));
const statements=['BEGIN;',"SET LOCAL statement_timeout='10s';",
  `DO $$ BEGIN IF to_regnamespace('${schema}') IS NOT NULL THEN RAISE EXCEPTION 'Fixture already exists'; END IF; END $$;`,
  `CREATE SCHEMA ${q(schema)};`,`SET LOCAL search_path=${q(schema)},public;`,`GRANT USAGE ON SCHEMA ${q(schema)} TO authenticated;`];
for(const table of tables.filter(table=>table!=='FileUpload'))statements.push(`CREATE TABLE ${q(schema)}.${q(table)} (LIKE public.${q(table)} INCLUDING ALL);`,
  `ALTER TABLE ${q(schema)}.${q(table)} ENABLE ROW LEVEL SECURITY;`,`GRANT SELECT ON ${q(schema)}.${q(table)} TO authenticated;`);
for(const op of storageOps.filter(op=>op.id==='column.public.SourceMaterial.storageBucket'))for(const step of op.execute)statements.push(rewrite(step.sql)+';');
statements.push(`ALTER TABLE ${q(schema)}."LearningSession" ADD FOREIGN KEY ("userId") REFERENCES ${q(schema)}."User"("id");`,
  `ALTER TABLE ${q(schema)}."SourceMaterial" ADD FOREIGN KEY ("learningSessionId") REFERENCES ${q(schema)}."LearningSession"("id");`,
  `GRANT UPDATE ON ${q(schema)}."LearningSession" TO authenticated;`);
const addedPolicies=new Set(materialOps.filter(op=>op.target?.details?.objectType==='rlsPolicy').map(op=>op.target.details.name));
for(const policy of Object.values(contract.storage.namespaces.public.entries.policy)){
  if(!tables.includes(policy.tableName)||policy.tableName==='FileUpload'||addedPolicies.has(policy.name))continue;
  statements.push(`CREATE POLICY ${q(policy.name)} ON ${q(schema)}.${q(policy.tableName)} AS ${policy.permissive?'PERMISSIVE':'RESTRICTIVE'} FOR ${policy.operation.toUpperCase()} TO ${policy.roles.map(q).join(', ')}${policy.using?` USING (${policy.using})`:''}${policy.withCheck?` WITH CHECK (${policy.withCheck})`:''};`);
}
for(const operation of materialOps){
  if(!['additive','widening'].includes(operation.operationClass))throw Error('Unsafe migration operation');
  for(const step of operation.execute){if(step.params?.length)throw Error('Unexpected parameterized operation');statements.push(rewrite(step.sql)+';');}
}
for(const operation of uploadOps){
  if(operation.operationClass!=='additive')throw Error('Unexpected upload migration operation');
  for(const step of operation.execute){if(step.params?.length)throw Error('Unexpected upload parameter');statements.push(rewrite(step.sql)+';');}
}
statements.push(`INSERT INTO ${q(schema)}."User" (id,"authUserId","displayName","updatedAt") VALUES
('${owner}','${auth}','Synthetic learner',now()),('peer-fixture-owner','${peer}','Synthetic learner',now());
INSERT INTO ${q(schema)}."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt") VALUES
('file-fixture','${owner}','File fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now()),
('rollback-fixture','${owner}','Rollback fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now()),
('closed-fixture','${owner}','Closed fixture','COMPLETED','COMPLETED','REVIEW',100,1,now(),now());
CREATE FUNCTION ${q(schema)}.reject_fixture_gate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN IF NEW.id='rollback-fixture' THEN RAISE EXCEPTION 'synthetic gate failure'; END IF; RETURN NEW; END $$;
CREATE TRIGGER fail_fixture_gate BEFORE UPDATE ON ${q(schema)}."LearningSession" FOR EACH ROW EXECUTE FUNCTION ${q(schema)}.reject_fixture_gate();
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"${auth}","role":"authenticated"}',true);
SELECT set_config('learnly.api_write','0',true);
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM (${activeQuery}) active_owned;
 IF n<>1 THEN RAISE EXCEPTION 'Legacy identity ownership failed'; END IF;
 SELECT count(*) INTO n FROM (${closedQuery}) closed_owned;
 IF n<>0 THEN RAISE EXCEPTION 'Completed session treated as active'; END IF;
 BEGIN ${readyInsert}; RAISE EXCEPTION 'Direct browser material insert was allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN ${intentInsert}; RAISE EXCEPTION 'Direct browser intent insert was allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;`);
for(const sql of [...pdf,...image])statements.push(sql+';');
for(const sql of rollback.slice(0,reservationEnd))statements.push(sql+';');
for(const sql of [...cancelIntent,...cancel])statements.push(sql+';');
statements.push(`DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."FileUpload" WHERE id='cancel-material' AND state='CANCELLED';
 IF n<>1 THEN RAISE EXCEPTION 'Durable cancellation missing'; END IF;
 SELECT count(*) INTO n FROM ${q(schema)}."FileUpload" WHERE id='pdf-material' AND state='PENDING'
   AND material->>'normalizedHash' IS NOT NULL AND material->>'storageBucket'='learnly-materials';
 IF n<>1 THEN RAISE EXCEPTION 'Durable intent metadata missing'; END IF;
 SELECT count(*) INTO n FROM (${pdf.find(sql=>sql.includes('FROM')&&sql.includes('"FileUpload"'))?.replaceAll("'pdf-material'","'cancel-material'")}) cancelled_finalize;
 IF n<>0 THEN RAISE EXCEPTION 'Cancelled upload can finalize'; END IF;
END $$;
SELECT set_config('learnly.api_write','0',true);
DO $$ DECLARE n int; BEGIN
 UPDATE ${q(schema)}."FileUpload" SET state='PENDING' WHERE id='cancel-material';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Browser can revive cancelled intent'; END IF;
END $$;
SELECT set_config('learnly.api_write','1',true);`);
// Execute the captured bounded lock and exact receipt query after the stored fixture exists.
for(const sql of receipt.filter(sql=>!sql.includes('CASE WHEN')))statements.push(sql+';');
statements.push(`DO $$ DECLARE result text; n int; BEGIN
 SELECT outcome INTO result FROM (${read(receipt)}) saved_receipt;
 IF result IS DISTINCT FROM 'SAVED' THEN RAISE EXCEPTION 'Committed file receipt not matched'; END IF;
 SELECT outcome INTO result FROM (${read(conflict)}) conflicting_receipt;
 IF result IS DISTINCT FROM 'UNKNOWN' THEN RAISE EXCEPTION 'Conflicting bucket receipt authorized cleanup'; END IF;
 SELECT count(*) INTO n FROM (${read(absent)}) absent_receipt;
 IF n<>0 THEN RAISE EXCEPTION 'Absent receipt was fabricated'; END IF;
END $$;`);
statements.push(`DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."SourceMaterial" WHERE status='READY' AND
   ((id='pdf-material' AND type='PDF' AND metadata->'extraction'->'pages'->1->>'page'='2') OR
    (id='image-material' AND type='IMAGE' AND (metadata->'extraction'->'pages'->0->'page')::jsonb='null'::jsonb))
   AND metadata->>'origin'='LEARNER_INPUT' AND metadata->>'reviewed'='false'
   AND "storageKey" LIKE '${auth}/file-fixture/%' AND "storageBucket"='learnly-materials' AND "contentHash"<>metadata->>'normalizedHash';
 IF n<>2 THEN RAISE EXCEPTION 'Binary/normalized hash or page/type/provenance metadata failed'; END IF;
 SELECT count(*) INTO n FROM ${q(schema)}."LearningSession" WHERE id='file-fixture' AND state='PRE_TEST' AND stage='EXPLAIN' AND version=0 AND "progressPercent"=0;
 IF n<>1 THEN RAISE EXCEPTION 'PRE gate changed engine-owned progress'; END IF;
 BEGIN ${rollback.slice(reservationEnd).map(sql=>sql.replace(/^SELECT /u,'PERFORM ')+';').join('\n')}
 RAISE EXCEPTION 'Expected gate failure was not raised' USING ERRCODE='XX000';
 EXCEPTION WHEN raise_exception THEN NULL; END;
 SELECT count(*) INTO n FROM ${q(schema)}."SourceMaterial" WHERE id='rollback-material';
 IF n<>0 THEN RAISE EXCEPTION 'Failed session gate did not roll back material'; END IF;
 SELECT count(*) INTO n FROM ${q(schema)}."FileUpload" WHERE id='rollback-material' AND state='PENDING';
 IF n<>1 THEN RAISE EXCEPTION 'Failed finalize lost durable intent'; END IF;
 SELECT count(*) INTO n FROM ${q(schema)}."LearningSession" WHERE id='rollback-fixture' AND state='INPUT';
 IF n<>1 THEN RAISE EXCEPTION 'Failed session gate changed state'; END IF;
END $$;
UPDATE ${q(schema)}."LearningSession" SET "lifecycleState"='COMPLETED' WHERE id='file-fixture';
DO $$ DECLARE n int; result text; BEGIN
 SELECT count(*) INTO n FROM (${lock}) completed_owned;
 IF n<>1 THEN RAISE EXCEPTION 'Completed owner receipt lock missing'; END IF;
 SELECT outcome INTO result FROM (${read(receipt)}) completed_receipt;
 IF result IS DISTINCT FROM 'SAVED' THEN RAISE EXCEPTION 'Completed session lost committed file receipt'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"${peer}","role":"authenticated"}',true);
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."SourceMaterial";
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user file read allowed'; END IF;
 SELECT count(*) INTO n FROM (${activeQuery}) foreign_owned;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user active session visible'; END IF;
 SELECT count(*) INTO n FROM (${lock}) hidden_owner;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user receipt parent lock allowed'; END IF;
 SELECT count(*) INTO n FROM (${read(receipt)}) hidden_receipt;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user file receipt read allowed'; END IF;
 SELECT count(*) INTO n FROM ${q(schema)}."FileUpload";
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user durable intent exposed'; END IF;
 UPDATE ${q(schema)}."FileUpload" SET state='PENDING';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user durable intent changed'; END IF;
 BEGIN ${readyInsert.replaceAll("'pdf-material'","'foreign-material'")}; RAISE EXCEPTION 'Cross-user file write allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN ${intentInsert.replaceAll("'pdf-material'","'foreign-intent'")}; RAISE EXCEPTION 'Cross-user intent write allowed' USING ERRCODE='XX000';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 BEGIN INSERT INTO ${q(schema)}."FileUpload" (id,"learningSessionId",state,material)
 VALUES ('missing-upload-session','does-not-exist','PENDING','{}'::json);
 RAISE EXCEPTION 'Upload journal missing-session FK allowed' USING ERRCODE='XX000'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."FileUpload" (id,"learningSessionId",state,material)
 VALUES ('invalid-upload-state','file-fixture','READY','{}'::json);
 RAISE EXCEPTION 'Upload journal invalid state allowed' USING ERRCODE='XX000'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."SourceMaterial" (id,"learningSessionId",type,status,"contentHash","mimeType","sizeBytes")
 VALUES ('missing-session-material','does-not-exist','PDF','READY','fixture','application/pdf',10);
 RAISE EXCEPTION 'Missing-session FK allowed' USING ERRCODE='XX000'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed,
 'PASS: durable intent/cancellation/failed-finalize retention, adapter SQL, canonical RLS, legacy owner, file metadata, PRE gate, atomic failure, exact/absent/conflicting/closed/cross-user receipts and FK checks' AS verification;`);
writeFileSync(output,statements.join('\n'),'utf8');
process.stdout.write(JSON.stringify({schema,output,scope:'adapter SQL + canonical fixture policies; injected decoder/Storage; not actual Prisma runtime',transaction:'BEGIN/ROLLBACK'}));
