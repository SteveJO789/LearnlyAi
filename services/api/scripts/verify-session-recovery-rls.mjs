// Render isolated, rollback-only PostgreSQL checks. Never apply public migrations.
import contract from '../src/prisma/contract.json' with { type: 'json' };
const schema = 'learnly_recovery_verify';
const tables = ['User', 'LearningSession', 'Message'];
const out = ['BEGIN;', "SET LOCAL statement_timeout='10s';", `CREATE SCHEMA "${schema}";`,
  `SET LOCAL search_path="${schema}",public;`, `GRANT USAGE ON SCHEMA "${schema}" TO authenticated;`];
for (const table of tables) out.push(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL);`,
  `ALTER TABLE "${schema}"."${table}" ENABLE ROW LEVEL SECURITY;`, `GRANT SELECT ON "${schema}"."${table}" TO authenticated;`);
out.push(`GRANT UPDATE ON "${schema}"."LearningSession" TO authenticated;`,
  `GRANT INSERT ON "${schema}"."Message" TO authenticated;`,
  `ALTER TABLE "${schema}"."Message" ADD CONSTRAINT fixture_message_session_fk FOREIGN KEY ("learningSessionId") REFERENCES "${schema}"."LearningSession"(id);`);
for (const policy of Object.values(contract.storage.namespaces.public.entries.policy)) {
  if (!tables.includes(policy.tableName)) continue;
  out.push(`CREATE POLICY "${policy.name}" ON "${schema}"."${policy.tableName}" AS ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${policy.operation.toUpperCase()} TO authenticated${policy.using ? ` USING (${policy.using})` : ''}${policy.withCheck ? ` WITH CHECK (${policy.withCheck})` : ''};`);
}
out.push(`INSERT INTO "User" (id,"authUserId","displayName","updatedAt") VALUES
('11111111-1111-4111-8111-11111111ac01','11111111-1111-4111-8111-11111111ac01','Synthetic learner',now()),
('11111111-1111-4111-8111-11111111ac02','11111111-1111-4111-8111-11111111ac02','Synthetic learner',now());
INSERT INTO "LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt")
VALUES ('recovery-fixture','11111111-1111-4111-8111-11111111ac01','Recovery fixture','LEARNING','FAILED','PRACTICE',50,3,now(),now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ac01","role":"authenticated"}',true);
DO $verify$
BEGIN
BEGIN
UPDATE "LearningSession" SET "lifecycleState"='ACTIVE' WHERE id='recovery-fixture';
RAISE EXCEPTION 'unmarked recovery allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
SELECT set_config('learnly.api_write','1',true);
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ac02","role":"authenticated"}',true);
DO $verify$
DECLARE n integer;
BEGIN
UPDATE "LearningSession" SET "lifecycleState"='ACTIVE' WHERE id='recovery-fixture';
GET DIAGNOSTICS n = ROW_COUNT;
IF n <> 0 THEN RAISE EXCEPTION 'foreign recovery allowed'; END IF;
BEGIN
INSERT INTO "Message" (id,"learningSessionId",role,content,"createdAt") VALUES ('foreign-event','recovery-fixture','SYSTEM','{}',now());
RAISE EXCEPTION 'foreign event allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ac01","role":"authenticated"}',true);
DO $verify$
DECLARE n integer;
BEGIN
UPDATE "LearningSession" SET "lifecycleState"='ACTIVE',version=version+1,"updatedAt"=now()
WHERE id='recovery-fixture' AND "userId"='11111111-1111-4111-8111-11111111ac01' AND "lifecycleState"='FAILED' AND version=3;
GET DIAGNOSTICS n = ROW_COUNT;
IF n <> 1 THEN RAISE EXCEPTION 'owned recovery failed'; END IF;
INSERT INTO "Message" (id,"learningSessionId",role,content,"createdAt") VALUES ('recovery-event','recovery-fixture','SYSTEM','{"event":"SESSION_RECOVERED"}',now());
IF NOT EXISTS (SELECT 1 FROM "LearningSession" WHERE id='recovery-fixture' AND stage='PRACTICE' AND "progressPercent"=50 AND version=4 AND "lifecycleState"='ACTIVE') THEN RAISE EXCEPTION 'recovery changed engine authority'; END IF;
UPDATE "LearningSession" SET "lifecycleState"='ACTIVE',version=version+1 WHERE id='recovery-fixture' AND "lifecycleState"='FAILED' AND version=3;
GET DIAGNOSTICS n = ROW_COUNT;
IF n <> 0 THEN RAISE EXCEPTION 'stale recovery succeeded'; END IF;
UPDATE "LearningSession" SET "lifecycleState"='FAILED' WHERE id='recovery-fixture';
BEGIN
UPDATE "LearningSession" SET "lifecycleState"='ACTIVE',version=version+1 WHERE id='recovery-fixture' AND "lifecycleState"='FAILED' AND version=4;
INSERT INTO "Message" (id,"learningSessionId",role,content,"createdAt") VALUES ('recovery-event','recovery-fixture','SYSTEM','{}',now());
RAISE EXCEPTION 'duplicate event unexpectedly succeeded';
EXCEPTION WHEN unique_violation THEN NULL; END;
IF NOT EXISTS (SELECT 1 FROM "LearningSession" WHERE id='recovery-fixture' AND "lifecycleState"='FAILED' AND version=4) THEN RAISE EXCEPTION 'event failure did not roll back recovery'; END IF;
IF (SELECT count(*) FROM "Message") <> 1 THEN RAISE EXCEPTION 'unexpected event persistence'; END IF;
END $verify$;
RESET ROLE;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed,
'owned recovery, API guard, foreign isolation, stale version, stage preservation and atomic rollback passed' AS verification;`);
console.log(out.join('\n'));
