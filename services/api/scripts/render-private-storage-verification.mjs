// Render canonical migration operations against empty clones. No actual bucket/object creation.
import { writeFileSync } from 'node:fs';
import operations from '../migrations/app/20261010T0752_private_material_storage/ops.json' with {type:'json'};
import contract from '../src/prisma/contract.json' with {type:'json'};
const output=process.argv.find(value=>value.startsWith('--output='))?.slice(9);
if(!output)throw Error('Explicit --output= required. This command only renders rollback SQL.');
const schema='learnly_storage_policy_verify',auth='11111111-1111-4111-8111-11111111ab01',peer='11111111-1111-4111-8111-11111111ab02';
const owner='legacy-app-owner',bucket='learnly-materials';
const q=value=>'"'+value.replaceAll('"','""')+'"';
const literal=value=>typeof value==='number'?String(value):"'"+String(value).replaceAll("'","''")+"'";
const rewrite=sql=>sql.replaceAll('"public".',q(schema)+'.').replaceAll('public.',q(schema)+'.')
 .replaceAll('storage.objects',q(schema)+'."objects"').replaceAll('storage.buckets',q(schema)+'."buckets"');
function bind(sql,params=[]){return sql.replace(/\$(\d+)/gu,(_,number)=>literal(['storage','public'].includes(params[Number(number)-1])?schema:params[Number(number)-1]));}
const out=['BEGIN;',"SET LOCAL statement_timeout='10s';",`DO $$ BEGIN IF to_regnamespace('${schema}') IS NOT NULL THEN RAISE EXCEPTION 'Fixture already exists'; END IF; END $$;`,
 `CREATE SCHEMA ${q(schema)};`,`SET LOCAL search_path=${q(schema)},public;`,`GRANT USAGE ON SCHEMA ${q(schema)} TO authenticated,anon;`];
for(const table of ['User','LearningSession','SourceMaterial'])out.push(`CREATE TABLE ${q(schema)}.${q(table)} (LIKE public.${q(table)} INCLUDING ALL);`,`ALTER TABLE ${q(schema)}.${q(table)} ENABLE ROW LEVEL SECURITY;`,`GRANT SELECT ON ${q(schema)}.${q(table)} TO authenticated;`);
for(const table of ['buckets','objects'])out.push(`CREATE TABLE ${q(schema)}.${q(table)} (LIKE storage.${q(table)} INCLUDING ALL);`);
out.push(`ALTER TABLE ${q(schema)}."objects" ENABLE ROW LEVEL SECURITY;`,
 `ALTER TABLE ${q(schema)}."objects" ADD FOREIGN KEY (bucket_id) REFERENCES ${q(schema)}."buckets"(id);`,
 `GRANT SELECT,INSERT,UPDATE,DELETE ON ${q(schema)}."objects" TO authenticated,anon;`);
for(const policy of Object.values(contract.storage.namespaces.public.entries.policy)){
 if(!['User','LearningSession'].includes(policy.tableName)||policy.operation!=='select')continue;
 out.push(`CREATE POLICY ${q(policy.name)} ON ${q(schema)}.${q(policy.tableName)} FOR SELECT TO authenticated USING (${rewrite(policy.using)});`);
}
// Deliberately broad existing policies: new restrictive guards must stop OR bypasses.
for(const operation of ['SELECT','INSERT','UPDATE','DELETE'])out.push(`CREATE POLICY broad_${operation.toLowerCase()} ON ${q(schema)}."objects" FOR ${operation} TO authenticated,anon${operation==='INSERT'?' WITH CHECK (true)':operation==='UPDATE'?' USING (true) WITH CHECK (true)':' USING (true)'};`);
let assertions=0;
for(const operation of operations){
 if(!['additive','widening'].includes(operation.operationClass))throw Error('Unexpected unsafe migration operation');
 for(const step of operation.precheck??[]){
  const sql=rewrite(bind(step.sql,step.params));out.push(`DO $$ DECLARE result boolean; BEGIN SELECT checked.result INTO result FROM (${sql}) checked; IF result IS DISTINCT FROM true THEN RAISE EXCEPTION 'Migration precheck failed: ${operation.id}'; END IF; END $$;`);assertions++;
 }
 for(const step of operation.execute)out.push(rewrite(bind(step.sql,step.params))+';');
 for(const step of operation.postcheck??[]){
  const sql=rewrite(bind(step.sql,step.params));out.push(`DO $$ DECLARE result boolean; BEGIN SELECT checked.result INTO result FROM (${sql}) checked; IF result IS DISTINCT FROM true THEN RAISE EXCEPTION 'Migration postcheck failed: ${operation.id}'; END IF; END $$;`);assertions++;
 }
}
out.push(`INSERT INTO ${q(schema)}."buckets" (id,name,public) VALUES ('other-bucket','Other fixture',true);
INSERT INTO ${q(schema)}."User" (id,"authUserId","displayName","updatedAt") VALUES
 ('${owner}','${auth}','Synthetic learner',now()),('peer-app-owner','${peer}','Synthetic learner',now());
INSERT INTO ${q(schema)}."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt") VALUES
 ('owned-session','${owner}','Owned fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now()),
 ('peer-session','peer-app-owner','Peer fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"${auth}","role":"authenticated"}',true);
INSERT INTO ${q(schema)}."objects" (id,bucket_id,name,owner_id) VALUES
 ('22222222-2222-4222-8222-22222222ab01','${bucket}','${auth}/owned-session/file.pdf','${auth}');
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."objects" WHERE id='22222222-2222-4222-8222-22222222ab01';
 IF n<>1 THEN RAISE EXCEPTION 'Legacy owned file not readable'; END IF;
 UPDATE ${q(schema)}."objects" SET name='${auth}/owned-session/changed.pdf' WHERE id='22222222-2222-4222-8222-22222222ab01';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Immutable file update allowed'; END IF;
 BEGIN INSERT INTO ${q(schema)}."objects" (id,bucket_id,name,owner_id) VALUES
 ('22222222-2222-4222-8222-22222222ab01','${bucket}','${auth}/owned-session/file.pdf','${auth}')
 ON CONFLICT (id) DO UPDATE SET name=excluded.name;
 RAISE EXCEPTION 'Private upsert allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${auth}/peer-session/foreign.pdf','${auth}');
 RAISE EXCEPTION 'Foreign session upload allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${peer}/owned-session/forged.pdf','${auth}');
 RAISE EXCEPTION 'Forged prefix allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${auth}/owned-session/extra/file.pdf','${auth}');
 RAISE EXCEPTION 'Malformed key allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${auth}/owned-session/file.svg','${auth}');
 RAISE EXCEPTION 'Unsupported extension allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"${peer}","role":"authenticated"}',true);
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."objects" WHERE bucket_id='${bucket}';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-user file read allowed'; END IF;
 DELETE FROM ${q(schema)}."objects" WHERE bucket_id='${bucket}';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-user file delete allowed'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."objects" WHERE bucket_id='${bucket}';
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous private read allowed'; END IF;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${auth}/owned-session/anonymous.pdf','${auth}');
 RAISE EXCEPTION 'Anonymous upload allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE ${q(schema)}."LearningSession" SET "lifecycleState"='COMPLETED' WHERE id='owned-session';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"${auth}","role":"authenticated"}',true);
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM ${q(schema)}."objects" WHERE bucket_id='${bucket}';
 IF n<>1 THEN RAISE EXCEPTION 'Completed history file not readable'; END IF;
 BEGIN INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('${bucket}','${auth}/owned-session/closed.pdf','${auth}');
 RAISE EXCEPTION 'Completed-session upload allowed' USING ERRCODE='XX000'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM ${q(schema)}."objects" WHERE bucket_id='${bucket}';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Post-completion compensation delete denied'; END IF;
END $$;
INSERT INTO ${q(schema)}."objects" (bucket_id,name,owner_id) VALUES ('other-bucket','other.svg','different-owner');
UPDATE ${q(schema)}."objects" SET name='other-changed.svg' WHERE bucket_id='other-bucket';
DELETE FROM ${q(schema)}."objects" WHERE bucket_id='other-bucket';
RESET ROLE;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed,'PASS: bucket metadata/migration checks/legacy ownership/anon and cross-user isolation/immutability/cleanup/other buckets' AS verification;`);
writeFileSync(output,out.join('\n'),'utf8');console.log(JSON.stringify({schema,output,canonicalAssertions:assertions,transaction:'BEGIN/ROLLBACK',actualStorageUploaded:false,publicSchemaChanged:false}));
