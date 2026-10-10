// Inspect this output before executing. One rollback-only scratch schema; no production DDL/data/role changes.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const schema='learnly_history_verify';
const quoteSchema='"'+schema+'"';
const root=new URL('../migrations/app/',import.meta.url);
const tip='0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620';
const mode=process.argv.find(arg=>arg.startsWith('--path='))?.slice(7)??'legacy';
if(!['legacy','fresh'].includes(mode)) throw new Error('Choose legacy or fresh explicitly.');
const migrations=readdirSync(root).filter(name=>!['refs','snapshots'].includes(name)&&
  (mode==='fresh'?['20261010T0331_fresh_supabase_mvp_baseline','20261010T0752_private_material_storage','20261010T1119_durable_file_uploads','20261010T1154_journal_storage_gate','20261010T1653_file_material_review'].includes(name):!name.endsWith('_fresh_supabase_mvp_baseline'))).sort().map(name=>({name,
  manifest:JSON.parse(readFileSync(new URL(name+'/migration.json',root),'utf8')),
  operations:JSON.parse(readFileSync(new URL(name+'/ops.json',root),'utf8'))}));
let previous=null;
for(const migration of migrations){
  if(migration.manifest.from!==previous) throw new Error('Migration chain is not contiguous.');
  previous=migration.manifest.to;
}
if(previous!==tip) throw new Error('Review the new migration tip before updating this verifier.');
const literal=value=>value===null?'NULL':typeof value==='boolean'?(value?'TRUE':'FALSE'):
  typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='string'?"'"+value.replaceAll("'","''")+"'":(()=>{throw new Error('Unexpected migration parameter');})();
function scoped(step){
  let sql=step.sql.replaceAll('"auth"."users"',quoteSchema+'."FixtureAuthUsers"').replaceAll('"public"',quoteSchema).replace(/\bpublic\./gu,quoteSchema+'.')
    .replaceAll('storage.objects',quoteSchema+'."FixtureStorageObjects"').replaceAll('storage.buckets',quoteSchema+'."FixtureStorageBuckets"');
  sql=sql.replace(/\$(\d+)/g,(_,number)=>{
    const index=Number(number)-1;if(!step.params||index>=step.params.length) throw new Error('Missing SQL parameter');
    const value=step.params[index];
    return literal(['public','storage'].includes(value)?schema:value==='objects'?'FixtureStorageObjects':value==='buckets'?'FixtureStorageBuckets':typeof value==='string'?value.replaceAll('"public"',quoteSchema).replaceAll('"auth"."users"',quoteSchema+'."FixtureAuthUsers"'):value);
  });
  if(/(?:"public"\.|\bpublic\.|"auth"\."users"|\bauth\.users|\bstorage\.(?:objects|buckets)|\b(?:CREATE|ALTER|DROP)\s+ROLE\b|\bGRANT\s+authenticated\s+TO\b)/iu.test(sql)) throw new Error('Unscoped migration statement: '+sql.slice(0,200));
  return sql.trim().replace(/;$/u,'');
}
function assertion(query,label){
  if(!/^SELECT\b/iu.test(query)) throw new Error('Unexpected check query');
  return `DO $check$ BEGIN IF NOT COALESCE((${query}),FALSE) THEN RAISE EXCEPTION ${literal(label)}; END IF; END $check$;`;
}
const out=['BEGIN;',"SET LOCAL statement_timeout='10s';",assertion(`SELECT to_regnamespace('${schema}') IS NULL`,'Scratch schema already exists; no changes permitted'),`SET LOCAL search_path=${quoteSchema},public;`];
let steps=0,checks=0,externalRoleDependencies=0;
for(const migration of migrations){
  out.push('-- '+migration.name);
  if(migration.name==='20261010T0752_private_material_storage') out.push(`
CREATE TABLE ${quoteSchema}."FixtureStorageBuckets" (LIKE storage.buckets INCLUDING ALL);
CREATE TABLE ${quoteSchema}."FixtureStorageObjects" (LIKE storage.objects INCLUDING ALL);
ALTER TABLE ${quoteSchema}."FixtureStorageObjects" ENABLE ROW LEVEL SECURITY;`);
  if(migration.name==='20261007T0529_auth_user_foundation') out.push(`
CREATE TABLE ${quoteSchema}."FixtureAuthUsers" (id uuid PRIMARY KEY,email text);
INSERT INTO ${quoteSchema}."FixtureAuthUsers" VALUES
('11111111-1111-4111-8111-11111111ad01','a@example.invalid'),
('11111111-1111-4111-8111-11111111ad02','b@example.invalid');
INSERT INTO ${quoteSchema}."User" (id,email,"displayName","updatedAt") VALUES
('11111111-1111-4111-8111-11111111ad01','a@example.invalid','Synthetic canonical learner',now()),
('legacy-safe-duplicate','a@example.invalid','Synthetic duplicate without dependencies',now()),
('legacy-preserved-user','b@example.invalid','Synthetic legacy learner',now());`);
  for(const operation of migration.operations){
    if(operation.id==='security.grant-authenticated-to-learnly-dev'){
      // The existing API role membership is a shared dependency, not scratch schema state.
      // Read its canonical postcondition; never grant/revoke/alter live roles in a verifier.
      for(const check of operation.postcheck??[]) {out.push(assertion(scoped(check),'Existing API role dependency unavailable'));checks++;}
      externalRoleDependencies++;continue;
    }
    for(const check of operation.precheck??[]) {out.push(assertion(scoped(check),migration.name+' / '+operation.id+' precheck'));checks++;}
    for(const step of operation.execute??[]) {out.push(scoped(step)+';');steps++;}
    for(const check of operation.postcheck??[]) {out.push(assertion(scoped(check),migration.name+' / '+operation.id+' postcheck'));checks++;}
  }
}
out.push(`
GRANT USAGE ON SCHEMA ${quoteSchema} TO authenticated;
${mode==='fresh'?`INSERT INTO ${quoteSchema}."User" (id,"authUserId",email,"displayName","updatedAt") VALUES
('11111111-1111-4111-8111-11111111ad01','11111111-1111-4111-8111-11111111ad01','a@example.invalid','Synthetic canonical learner',now()),
('legacy-preserved-user','11111111-1111-4111-8111-11111111ad02','b@example.invalid','Synthetic legacy identity learner',now());`:''}
DO $verify$ BEGIN
IF EXISTS (SELECT 1 FROM ${quoteSchema}."User" WHERE id='legacy-safe-duplicate') THEN RAISE EXCEPTION 'Safe duplicate cleanup failed'; END IF;
IF NOT EXISTS (SELECT 1 FROM ${quoteSchema}."User" WHERE id='legacy-preserved-user' AND "authUserId"='11111111-1111-4111-8111-11111111ad02') THEN RAISE EXCEPTION 'Legacy user identity/backfill changed'; END IF;
IF to_regclass('${schema}."AppSession"') IS NOT NULL OR to_regclass('${schema}."OAuthAccount"') IS NOT NULL THEN RAISE EXCEPTION 'Legacy custom auth tables remain'; END IF;
END $verify$;
INSERT INTO ${quoteSchema}."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt")
VALUES ('history-fixture','legacy-preserved-user','Historical migration fixture','LEARNING','ACTIVE','PRACTICE',50,1,now(),now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ad02","role":"authenticated"}',true);
DO $verify$ BEGIN
IF (SELECT count(*) FROM ${quoteSchema}."LearningSession" WHERE id='history-fixture') <> 1 THEN RAISE EXCEPTION 'Legacy owner cannot read migrated session through RLS'; END IF;
END $verify$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ad01","role":"authenticated"}',true);
DO $verify$ BEGIN
IF EXISTS (SELECT 1 FROM ${quoteSchema}."LearningSession" WHERE id='history-fixture') THEN RAISE EXCEPTION 'Foreign user sees migrated session'; END IF;
END $verify$;
RESET ROLE;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed,
${migrations.length} AS migrations, ${steps} AS executed_app_sql_steps, ${checks} AS canonical_checks,
${externalRoleDependencies} AS preexisting_role_dependencies_verified,
'Canonical ${mode} app SQL/RLS passed; Prisma marker/executor and production data not verified' AS verification;`);
const sql=out.join('\n');
const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice(9);
if(output){writeFileSync(resolve(output),sql);console.log(JSON.stringify({mode,schema,migrations:migrations.length,steps,checks,externalRoleDependencies,bytes:Buffer.byteLength(sql),output:resolve(output)}));}
else console.log(sql);
