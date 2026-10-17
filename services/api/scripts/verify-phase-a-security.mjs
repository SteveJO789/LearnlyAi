import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import contract from '../src/prisma/contract.json' with { type: 'json' };
import { verifyFullDatabase } from './verify-full-database.mjs';

const FIXTURE = 'learnly_activation_executor_phase_a_security_20261017';
const CONFIRM = 'ALTER_ISOLATED_PHASE_A_SECURITY_FIXTURE';
const CATALOG_PROFILE = 'gotrue-pop6-v6.1.1';
const identifier = value => `"${String(value).replaceAll('"', '""')}"`;

export function requireSecurityFixture(env) {
  let url;
  try { url = new URL(env.DATABASE_URL ?? ''); } catch { throw new Error('SECURITY_FIXTURE_URL_REQUIRED'); }
  if (env.PHASE_A_SECURITY_CONFIRM !== CONFIRM || env.LEARNLY_SUPABASE_CATALOG_PROFILE !== CATALOG_PROFILE ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.port !== '55434' ||
    decodeURIComponent(url.pathname.slice(1)) !== FIXTURE || url.search || url.hash ||
    decodeURIComponent(url.username) !== 'postgres') throw new Error('SECURITY_FIXTURE_TARGET_REFUSED');
  return url;
}

/** Mutations are committed only in the explicitly named empty QA clone so the real CLI can inspect them. */
export async function verifyPhaseASecurity({ env = process.env, output } = {}) {
  const url = requireSecurityFixture(env);
  const client = new pg.Client({ connectionString: url.toString(), application_name: 'learnly-phase-a-security-fixture' });
  const report = { fixture: FIXTURE, catalogProfile: CATALOG_PROFILE, timestamp: new Date().toISOString(),
    method: 'Actual strict full Prisma CLI plus exact catalog gates; sequential committed mutations on an exclusive empty clone, restored in finally.',
    status: 'RUNNING', cases: [] };
  const save = async () => { if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n'); };
  const gate = async () => verifyFullDatabase({ argv: ['--target=local', `--expect-database=${FIXTURE}`],
    env: { ...env, DATABASE_URL: url.toString() } });
  const summarize = result => ({ status: result.status, catalogProfile: result.catalogProfile, canonical: result.canonical,
    blocked: result.findings.filter(item => item.status !== 'PASS'), findingCount: result.findings.length });
  const constraint = async (table, type) => {
    const result = await client.query(`SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = to_regclass($1) AND contype = $2 ORDER BY conname`, [table, type]);
    if (result.rows.length !== 1) throw new Error('EXPECTED_SINGLE_FIXTURE_CONSTRAINT');
    return result.rows[0];
  };
  const policy = async (schema, table, name) => {
    const result = await client.query(`SELECT qual, with_check AS "withCheck" FROM pg_policies
      WHERE schemaname = $1 AND tablename = $2 AND policyname = $3`, [schema, table, name]);
    if (result.rows.length !== 1) throw new Error('EXPECTED_FIXTURE_POLICY');
    return result.rows[0];
  };
  const empty = async () => {
    const rows = {};
    for (const table of Object.keys(contract.storage.namespaces.public.entries.table)) {
      rows[`public.${table}`] = (await client.query(`SELECT count(*)::integer AS count FROM public.${identifier(table)}`)).rows[0].count;
    }
    for (const table of ['auth.users', 'storage.objects']) {
      rows[table] = (await client.query(`SELECT count(*)::integer AS count FROM ${table}`)).rows[0].count;
    }
    if (Object.values(rows).some(count => count !== 0)) throw new Error('SECURITY_FIXTURE_NOT_EMPTY');
    return rows;
  };
  try {
    await client.connect();
    if ((await client.query('SELECT current_database() AS name')).rows[0]?.name !== FIXTURE) throw new Error('SECURITY_FIXTURE_IDENTITY_MISMATCH');
    const active = (await client.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()')).rows[0].count;
    if (active !== 0) throw new Error('SECURITY_FIXTURE_HAS_OTHER_CONNECTIONS');
    report.emptyBefore = await empty();
    report.baseline = summarize(await gate());
    await save();
    if (report.baseline.status !== 'PASS') throw new Error('SECURITY_FIXTURE_BASELINE_BLOCKED');

    const fk = await constraint('auth.webauthn_credentials', 'f');
    const check = await constraint('auth.webauthn_challenges', 'c');
    const ai = await policy('public', 'AIRequest', 'ai_request_select_own_5424dd11');
    const storage = await policy('storage', 'objects', 'learnly_materials_insert_guard');
    report.restorationDefinitions = { credentialForeignKey: fk, challengeCheck: check, aiUsing: ai.qual, storageWithCheck: storage.withCheck };
    const width = (await client.query(`SELECT character_maximum_length AS width FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'schema_migrations' AND column_name = 'version'`)).rows[0]?.width;
    if (width !== 14 || !ai.qual || !storage.withCheck) throw new Error('SECURITY_FIXTURE_UNEXPECTED_BASELINE');
    report.versionColumn = { baselineWidth: width, profileExpectedWidth: 14, mutationWidth: 15,
      interpretation: 'Official GoTrue Pop 6.1.1 runtime catalog width; the mutation tests an explicit-profile mismatch, not a real database defect.' };
    const cases = [
      { id: 'auth-version-width-profile-mismatch-15', mutate: 'ALTER TABLE auth.schema_migrations ALTER COLUMN version TYPE varchar(15)',
        restore: 'ALTER TABLE auth.schema_migrations ALTER COLUMN version TYPE varchar(14)' },
      { id: 'auth-credential-table-missing', mutate: 'ALTER TABLE auth.webauthn_credentials RENAME TO phase_a_hidden_credentials',
        restore: 'ALTER TABLE auth.phase_a_hidden_credentials RENAME TO webauthn_credentials' },
      { id: 'auth-credential-column-missing', mutate: 'ALTER TABLE auth.webauthn_credentials RENAME COLUMN credential_id TO phase_a_bad_credential_id',
        restore: 'ALTER TABLE auth.webauthn_credentials RENAME COLUMN phase_a_bad_credential_id TO credential_id' },
      { id: 'auth-credential-foreign-key-missing', mutate: `ALTER TABLE auth.webauthn_credentials DROP CONSTRAINT ${identifier(fk.name)}`,
        restore: `ALTER TABLE auth.webauthn_credentials ADD CONSTRAINT ${identifier(fk.name)} ${fk.definition}` },
      { id: 'auth-challenge-check-missing', mutate: `ALTER TABLE auth.webauthn_challenges DROP CONSTRAINT ${identifier(check.name)}`,
        restore: `ALTER TABLE auth.webauthn_challenges ADD CONSTRAINT ${identifier(check.name)} ${check.definition}` },
      { id: 'auth-challenge-same-name-check-true', mutate: `ALTER TABLE auth.webauthn_challenges DROP CONSTRAINT ${identifier(check.name)}; ALTER TABLE auth.webauthn_challenges ADD CONSTRAINT ${identifier(check.name)} CHECK (true)`,
        restore: `ALTER TABLE auth.webauthn_challenges DROP CONSTRAINT ${identifier(check.name)}; ALTER TABLE auth.webauthn_challenges ADD CONSTRAINT ${identifier(check.name)} ${check.definition}` },
      { id: 'storage-multipart-metadata-missing', mutate: 'ALTER TABLE storage.s3_multipart_uploads RENAME COLUMN metadata TO phase_a_hidden_metadata',
        restore: 'ALTER TABLE storage.s3_multipart_uploads RENAME COLUMN phase_a_hidden_metadata TO metadata' },
      { id: 'ai-request-same-name-owner-policy-true', mutate: 'ALTER POLICY ai_request_select_own_5424dd11 ON public."AIRequest" USING (true)',
        restore: `ALTER POLICY ai_request_select_own_5424dd11 ON public."AIRequest" USING (${ai.qual})` },
      { id: 'ai-request-same-name-roles-public', mutate: 'ALTER POLICY ai_request_select_own_5424dd11 ON public."AIRequest" TO public',
        restore: 'ALTER POLICY ai_request_select_own_5424dd11 ON public."AIRequest" TO authenticated' },
      { id: 'owned-table-extra-policy', mutate: 'CREATE POLICY phase_a_extra_owned_read ON public."AIRequest" FOR SELECT TO authenticated USING (true)',
        restore: 'DROP POLICY phase_a_extra_owned_read ON public."AIRequest"' },
      { id: 'unknown-table-extra-policy', mutate: 'CREATE TABLE public.phase_a_unknown_table (id text); ALTER TABLE public.phase_a_unknown_table ENABLE ROW LEVEL SECURITY; CREATE POLICY phase_a_unknown_read ON public.phase_a_unknown_table FOR SELECT TO authenticated USING (true)',
        restore: 'DROP TABLE public.phase_a_unknown_table' },
      { id: 'knowledge-chunk-rls-disabled', mutate: 'ALTER TABLE public."KnowledgeChunk" DISABLE ROW LEVEL SECURITY',
        restore: 'ALTER TABLE public."KnowledgeChunk" ENABLE ROW LEVEL SECURITY' },
      { id: 'storage-same-name-insert-guard-true', mutate: 'ALTER POLICY learnly_materials_insert_guard ON storage.objects WITH CHECK (true)',
        restore: `ALTER POLICY learnly_materials_insert_guard ON storage.objects WITH CHECK (${storage.withCheck})` },
    ];
    for (const schema of ['storage', 'extensions']) {
      const grants = (await client.query(`SELECT a.is_grantable AS "grantOption" FROM pg_namespace n
        CROSS JOIN LATERAL aclexplode(n.nspacl) a JOIN pg_roles r ON r.oid = a.grantee
        WHERE n.nspname = $1 AND r.rolname = 'authenticated' AND a.privilege_type = 'USAGE'`, [schema])).rows;
      if (grants.length !== 1) throw new Error('EXPECTED_EXPLICIT_FIXTURE_SCHEMA_USAGE');
      cases.push({ id: `${schema}-schema-usage-revoked`, mutate: `REVOKE USAGE ON SCHEMA ${identifier(schema)} FROM authenticated`,
        restore: `GRANT USAGE ON SCHEMA ${identifier(schema)} TO authenticated${grants[0].grantOption ? ' WITH GRANT OPTION' : ''}` });
    }
    for (const test of cases) {
      let mutated = false;
      const result = { id: test.id, mutation: test.mutate, restoration: test.restore };
      report.cases.push(result);
      try {
        await client.query(test.mutate);
        mutated = true;
        result.gate = summarize(await gate());
        result.detected = result.gate.status === 'BLOCKED';
      } finally {
        if (mutated) await client.query(test.restore);
        result.restored = true;
        await save();
      }
    }
    report.restored = summarize(await gate());
    report.versionColumn.restoredWidth = (await client.query(`SELECT character_maximum_length AS width
      FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'schema_migrations' AND column_name = 'version'`)).rows[0]?.width;
    report.emptyAfter = await empty();
    report.status = report.restored.status === 'PASS' && report.versionColumn.restoredWidth === 14 &&
      report.cases.every(test => test.detected && test.restored) ? 'PASS' : 'BLOCKED';
    await save();
    return report;
  } catch (error) {
    report.status = 'BLOCKED';
    report.error = /^[A-Z0-9_]+$/u.test(error.message ?? '') ? error.message : 'SECURITY_FIXTURE_EXECUTION_FAILED';
    await save();
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0].startsWith('--output=')) throw new Error('EXPECTED_OUTPUT_ARGUMENT');
  verifyPhaseASecurity({ output: args[0].slice('--output='.length) }).then(report => {
    console.log(JSON.stringify({ fixture: report.fixture, status: report.status,
      baseline: report.baseline.status, restored: report.restored?.status,
      cases: report.cases.map(test => ({ id: test.id, detected: test.detected, restored: test.restored })) }));
    if (report.status !== 'PASS') process.exitCode = 1;
  }).catch(() => { console.error('Phase A isolated security verification failed; inspect the sanitized report.'); process.exitCode = 1; });
}
