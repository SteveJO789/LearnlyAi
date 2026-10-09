// Render rollback-only ownership checks from canonical material policies/operations.
import contract from '../src/prisma/contract.json' with { type: 'json' };
import operations from '../migrations/app/20261009T1524_text_material_pipeline/ops.json' with { type: 'json' };
const schema = 'learnly_text_material_verify';
const tables = ['User', 'LearningSession', 'SourceMaterial'];
const out = ['BEGIN;', "SET LOCAL statement_timeout='10s';", `CREATE SCHEMA "${schema}";`,
  `SET LOCAL search_path="${schema}",public;`, `GRANT USAGE ON SCHEMA "${schema}" TO authenticated;`];
for (const table of tables) out.push(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL);`,
  `ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;`, `GRANT SELECT ON "${schema}"."${table}" TO authenticated;`);
for (const policy of Object.values(contract.storage.namespaces.public.entries.policy)) {
  if (!tables.includes(policy.tableName) || policy.prefix === 'source_material_insert_api_own') continue;
  out.push(`CREATE POLICY "${policy.name}" ON "${schema}"."${policy.tableName}" AS ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${policy.operation.toUpperCase()} TO authenticated${policy.using ? ` USING (${policy.using})` : ''}${policy.withCheck ? ` WITH CHECK (${policy.withCheck})` : ''};`);
}
for (const op of operations) for (const step of op.execute) out.push(step.sql.replaceAll('"public".', `"${schema}".`).replaceAll('public.', `"${schema}".`) + ';');
out.push(`INSERT INTO "${schema}"."User" (id,"authUserId","displayName","updatedAt") VALUES
('11111111-1111-4111-8111-11111111ab01','11111111-1111-4111-8111-11111111ab01','Synthetic learner',now()),
('11111111-1111-4111-8111-11111111ab02','11111111-1111-4111-8111-11111111ab02','Synthetic learner',now());
INSERT INTO "${schema}"."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt")
VALUES ('text-fixture','11111111-1111-4111-8111-11111111ab01','Text fixture','INPUT','ACTIVE','EXPLAIN',0,0,now(),now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ab01","role":"authenticated"}',true);
SELECT set_config('learnly.api_write','1',true);
INSERT INTO "${schema}"."SourceMaterial" (id,"learningSessionId",type,status,"normalizedText","contentHash","mimeType","sizeBytes",metadata)
VALUES ('text-material','text-fixture','TEXT','READY','x² + 4 = 10','synthetic-hash','text/plain',12,'{"origin":"LEARNER_INPUT","reviewed":false}');
DO $verify$
DECLARE value text;
BEGIN
SELECT "normalizedText" INTO value FROM "${schema}"."SourceMaterial" WHERE id='text-material';
IF value <> 'x² + 4 = 10' THEN RAISE EXCEPTION 'math text changed in storage'; END IF;
END $verify$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ab02","role":"authenticated"}',true);
DO $verify$
DECLARE n integer;
BEGIN
SELECT count(*) INTO n FROM "${schema}"."SourceMaterial" WHERE id='text-material';
IF n <> 0 THEN RAISE EXCEPTION 'foreign material visible'; END IF;
BEGIN
INSERT INTO "${schema}"."SourceMaterial" (id,"learningSessionId",type,status,"normalizedText","contentHash","mimeType","sizeBytes")
VALUES ('foreign-material','text-fixture','TEXT','READY','foreign','hash','text/plain',7);
RAISE EXCEPTION 'foreign material write allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
RESET ROLE;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed, 'owned text/math preservation and cross-user material isolation passed' AS verification;`);
console.log(out.join('\n'));
