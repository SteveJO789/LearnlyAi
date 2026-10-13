// Clone definitions, policies and privileges only. No live rows or marker writes.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const schema = 'learnly_current_verify';
const result = spawnSync(process.execPath, ['scripts/render-historical-migration-verification.mjs', '--path=legacy'],
  { cwd: new URL('../', import.meta.url), encoding: 'utf8', maxBuffer: 250000, timeout: 10000 });
if (result.status !== 0) throw new Error(result.stderr);
const start = result.stdout.indexOf('-- 20261009T1032_session_ownership_contract');
const end = result.stdout.indexOf('\nGRANT USAGE ON SCHEMA', start);
if (start < 0 || end < start) throw new Error('Review forward migration boundary.');
const suffix = result.stdout.slice(start, end).replaceAll('learnly_history_verify', schema);
const sql = `BEGIN;
SET LOCAL statement_timeout='10s';
DO $guard$ BEGIN
IF to_regnamespace('${schema}') IS NOT NULL THEN RAISE EXCEPTION 'Fixture collision'; END IF;
IF NOT EXISTS (SELECT 1 FROM prisma_contract.marker WHERE space='app' AND core_hash='c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665') THEN RAISE EXCEPTION 'Live origin changed; re-audit required'; END IF;
END $guard$;
CREATE SCHEMA ${schema};
SET LOCAL search_path=${schema},public;
DO $clone$ DECLARE t text; p record; k record; r text; privilege text; q text; w text; definition text;
tables text[] := ARRAY['User','LearningSession','Message','SourceMaterial','Assessment','AssessmentAnswer','LearningProfile'];
BEGIN
FOREACH t IN ARRAY tables LOOP
  EXECUTE format('CREATE TABLE ${schema}.%I (LIKE public.%I INCLUDING ALL)',t,t);
  EXECUTE format('ALTER TABLE ${schema}.%I ENABLE ROW LEVEL SECURITY',t);
  FOREACH r IN ARRAY ARRAY['authenticated','anon'] LOOP
    FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege(r,format('public.%I',t),privilege) THEN
        EXECUTE format('GRANT %s ON ${schema}.%I TO %I',privilege,t,r);
      END IF;
    END LOOP;
  END LOOP;
END LOOP;
FOR k IN SELECT c.relname,ck.conname,pg_get_constraintdef(ck.oid) AS def FROM pg_constraint ck JOIN pg_class c ON c.oid=ck.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(tables) AND ck.contype='f' LOOP
  definition := k.def;
  FOREACH t IN ARRAY tables LOOP
    definition := replace(definition,'REFERENCES public.'||quote_ident(t),'REFERENCES ${schema}.'||quote_ident(t));
    definition := replace(definition,'REFERENCES '||quote_ident(t),'REFERENCES ${schema}.'||quote_ident(t));
  END LOOP;
  EXECUTE format('ALTER TABLE ${schema}.%I ADD CONSTRAINT %I %s',k.relname,k.conname,definition);
END LOOP;
FOR p IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename=ANY(tables) LOOP
  q := p.qual; w := p.with_check;
  FOREACH t IN ARRAY tables LOOP
    q := replace(q,'public.'||quote_ident(t),quote_ident(t)); w := replace(w,'public.'||quote_ident(t),quote_ident(t));
    q := replace(q,quote_ident(t),'${schema}.'||quote_ident(t)); w := replace(w,quote_ident(t),'${schema}.'||quote_ident(t));
  END LOOP;
  EXECUTE format('CREATE POLICY %I ON ${schema}.%I AS %s FOR %s TO %s%s%s',p.policyname,p.tablename,p.permissive,p.cmd,array_to_string(p.roles,','),
    CASE WHEN q IS NULL THEN '' ELSE ' USING ('||q||')' END,CASE WHEN w IS NULL THEN '' ELSE ' WITH CHECK ('||w||')' END);
END LOOP;
END $clone$;
GRANT USAGE ON SCHEMA ${schema} TO authenticated;
INSERT INTO ${schema}."User" (id,"authUserId",email,"displayName","updatedAt") VALUES
('legacy-fixture','11111111-1111-4111-8111-11111111ad02','fixture@example.invalid','Fixture',now()),
('peer-fixture','11111111-1111-4111-8111-11111111ad01','peer@example.invalid','Peer',now());
INSERT INTO ${schema}."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt") VALUES
('existing-fixture','legacy-fixture','Existing session','LEARNING','ACTIVE','PRACTICE',50,7,now(),now());
${suffix}
DO $preserved$ BEGIN
IF NOT EXISTS (SELECT 1 FROM ${schema}."LearningSession" WHERE id='existing-fixture' AND "userId"='legacy-fixture' AND version=7 AND stage='PRACTICE') THEN RAISE EXCEPTION 'Existing session changed'; END IF;
IF NOT EXISTS (SELECT 1 FROM ${schema}."User" WHERE id='legacy-fixture' AND "authUserId"='11111111-1111-4111-8111-11111111ad02') THEN RAISE EXCEPTION 'Legacy identity changed'; END IF;
END $preserved$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ad02","role":"authenticated"}',true);
DO $owner$ BEGIN IF (SELECT count(*) FROM ${schema}."LearningSession" WHERE id='existing-fixture')<>1 THEN RAISE EXCEPTION 'Owner isolation failed'; END IF; END $owner$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ad01","role":"authenticated"}',true);
DO $peer$ BEGIN IF EXISTS (SELECT 1 FROM ${schema}."LearningSession" WHERE id='existing-fixture') THEN RAISE EXCEPTION 'Cross-user disclosure'; END IF; END $peer$;
RESET ROLE;
ROLLBACK;
SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed,'Forward SQL from observed c7 marker with cloned current definitions/policies; real Prisma executor not verified' AS verification;
`;
if (/\b(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE|DROP TABLE)\s+(?:"?public"?\.|storage\.)/iu.test(sql)) throw new Error('Unscoped mutation');
const output = process.argv.find(x => x.startsWith('--output='))?.slice(9);
if (output) { writeFileSync(output, sql); console.log(JSON.stringify({ schema, bytes: Buffer.byteLength(sql), rollbackOnly: true })); }
else process.stdout.write(sql);
