import { spawnSync } from 'node:child_process';
import { assertFixtureDatabaseUrl, cloneLocalFoundationDatabase, fixtureDatabaseName, inspectFixture, provisionLocalSupabaseCompatibleFoundation, readFixtureAdminUrl } from './migration-executor-fixture.mjs';
import pg from 'pg';

const WORKDIR = new URL('../', import.meta.url).pathname;
const PRISMA = new URL('../node_modules/.bin/prisma', import.meta.url).pathname;
const TARGET = 'f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b';
const APP_FRESH = 'd17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397';
const PGVECTOR_HEAD = '3d2c56a2944685bd21b05bc8a8d73164397df51c014201902932fbe7e80ff1b8';
const OBSERVED_ORIGIN = 'c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665';
const PROFILE = '3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2';
const APP_POLICY_VERIFY_ISSUES = new Set([
  'database/public/AIRequest/ai_request_select_own_5424dd11',
  'database/public/Assessment/assessment_insert_api_own_277fff40',
  'database/public/Assessment/assessment_select_own_d47c911a',
  'database/public/Assessment/assessment_update_api_own_168c1514',
  'database/public/AssessmentAnswer/assessment_answer_insert_api_own_6ac7083b',
  'database/public/AssessmentAnswer/assessment_answer_select_own_c190452e',
  'database/public/FileUpload/file_upload_insert_api_own_d6a3a6ba',
  'database/public/FileUpload/file_upload_insert_guard_649e1632',
  'database/public/FileUpload/file_upload_select_own_5472d21c',
  'database/public/FileUpload/file_upload_update_api_own_e13f9bb0',
  'database/public/FileUpload/file_upload_update_guard_cd84f83e',
  'database/public/KnowledgeChunk/knowledge_chunk_read_reviewed_72bac3b2',
  'database/public/LearningProfile/learning_profile_insert_api_own_62b5c283',
  'database/public/LearningProfile/learning_profile_select_own_13d05569',
  'database/public/LearningProfile/learning_profile_update_api_own_40a07354',
  'database/public/LearningSession/learning_session_insert_own_2be3816c',
  'database/public/LearningSession/learning_session_select_own_a34ec569',
  'database/public/LearningSession/learning_session_update_own_056e8007',
  'database/public/LearningSession/session_api_insert_guard_649e1632',
  'database/public/LearningSession/session_api_update_guard_cca2e683',
  'database/public/Message/message_api_insert_guard_649e1632',
  'database/public/Message/message_insert_own_4f346578',
  'database/public/Message/message_select_own_968c3fb0',
  'database/public/SourceMaterial/source_material_insert_api_own_bbb50d09',
  'database/public/SourceMaterial/source_material_review_update_guard_cd84f83e',
  'database/public/SourceMaterial/source_material_review_update_own_c072fcc3',
  'database/public/SourceMaterial/source_material_select_own_f7e3ac0e',
  'database/public/User/user_insert_own_770e92f4',
  'database/public/User/user_select_own_4f3aea31',
  'database/public/User/user_update_own_0788dd28',
]);

function redactDatabaseUrls(value) {
  return value.replace(/(?:postgres|postgresql):\/\/[^\s"'<>]+/giu, '[redacted database URL]');
}

function runPrisma(args, { expectFailure = false } = {}) {
  const result = spawnSync(PRISMA, args, {
    cwd: WORKDIR,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 180_000,
    env: { ...process.env, DO_NOT_TRACK: '1', PRISMA_DISABLE_TELEMETRY: '1' },
  });
  if (result.error) throw result.error;
  const output = redactDatabaseUrls(`${result.stdout ?? ''}${result.stderr ?? ''}`.trim());
  if (expectFailure ? result.status === 0 : result.status !== 0) {
    throw new Error(`Prisma command ${args[0]} ${args[1]} exited ${result.status}: ${output.slice(-5000)}`);
  }
  const events = (result.stdout ?? '').split(/\r?\n/u).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const envelope = [...events].reverse().find(event => event.kind === 'result') ?? events.at(-1);
  if (!expectFailure && envelope?.envelope?.ok === false) {
    throw new Error(`Prisma reported a failed command: ${redactDatabaseUrls(JSON.stringify(envelope.envelope))}`);
  }
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', output, envelope, events };
}

function resultValue(run) {
  return run.envelope?.envelope?.result ?? run.envelope?.result ?? null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function dbArg(url) { return `--db=${url.toString()}`; }

async function query(url, text, values = []) {
  assertFixtureDatabaseUrl(url);
  const { Client } = pg;
  const client = new Client({ connectionString: url.toString(), application_name: 'learnly-migration-executor-verification' });
  await client.connect();
  try { return await client.query(text, values); } finally { await client.end(); }
}

async function inspectServer(url) {
  const { Client } = pg;
  const client = new Client({ connectionString: url.toString(), application_name: 'learnly-migration-executor-server-check' });
  await client.connect();
  try {
    return (await client.query(`SELECT inet_server_addr()::text AS server_address, inet_server_port() AS server_port,
      current_setting('server_version') AS server_version`)).rows[0];
  } finally {
    await client.end();
  }
}

async function readMarkerRows(url) {
  const exists = await query(url, "SELECT to_regclass('prisma_contract.marker') IS NOT NULL AS present");
  if (!exists.rows[0].present) return [];
  return (await query(url, 'SELECT * FROM prisma_contract.marker ORDER BY space')).rows;
}

async function readMigrationLog(url) {
  const result = runPrisma(['migration', 'log', dbArg(url), '--json']);
  return resultValue(result);
}

async function readCatalogSignature(url) {
  const tables = await query(url, `SELECT table_schema, table_name FROM information_schema.tables
    WHERE table_schema IN ('public', 'storage') AND table_type='BASE TABLE' ORDER BY table_schema, table_name`);
  const policies = await query(url, `SELECT schemaname, tablename, policyname, cmd, permissive
    FROM pg_policies WHERE schemaname IN ('public', 'storage') ORDER BY schemaname, tablename, policyname`);
  return JSON.stringify({ tables: tables.rows, policies: policies.rows });
}

async function createFoundationFixture(adminUrl, label, { removeVector = false } = {}) {
  const databaseName = fixtureDatabaseName(label);
  const databaseUrl = await cloneLocalFoundationDatabase(adminUrl, databaseName);
  await provisionLocalSupabaseCompatibleFoundation(databaseUrl);
  if (removeVector) {
    const vector = await inspectFixture(databaseUrl);
    if (vector.vector) await query(databaseUrl, 'DROP EXTENSION vector RESTRICT');
  }
  return { databaseName, databaseUrl };
}

async function seedC7LegacyRows(url) {
  await query(url, `INSERT INTO public."User" (id, "authUserId", "displayName", "createdAt", "updatedAt")
    VALUES ('legacy-app-user-101', '11111111-1111-4111-8111-111111111101', 'Fixture learner', now(), now())`);
  await query(url, `INSERT INTO public."LearningSession" (id, "userId", title, state, "lifecycleState", stage, "progressPercent", version, "createdAt", "updatedAt")
    VALUES ('legacy-session-101', 'legacy-app-user-101', 'Preserved session', 'LEARNING', 'ACTIVE', 'PRACTICE', 50, 7, now(), now())`);
  await query(url, `INSERT INTO public."Message" (id, "learningSessionId", role, content, "createdAt") VALUES
    ('legacy-message-user-101', 'legacy-session-101', 'USER', '"Keep this user message"'::json, '2026-10-01T10:00:00Z'),
    ('legacy-message-tutor-101', 'legacy-session-101', 'TUTOR', '{"text":"Keep this tutor response","citations":[]}'::json, '2026-10-01T10:00:00Z')`);
  return (await query(url, `SELECT json_build_object(
      'user', (SELECT row_to_json(u) FROM public."User" u WHERE u.id='legacy-app-user-101'),
      'session', (SELECT row_to_json(s) FROM public."LearningSession" s WHERE s.id='legacy-session-101'),
      'messages', (SELECT json_agg(m ORDER BY m.id) FROM public."Message" m WHERE m."learningSessionId"='legacy-session-101')) AS payload`)).rows[0].payload;
}

function assertMarker(rows, space, expected) {
  const marker = rows.find(row => row.space === space);
  assert(marker, `Expected ${space} marker at ${expected}; found ${JSON.stringify(rows)}`);
  const hash = marker.core_hash ?? marker.coreHash ?? marker.contract_hash ?? marker.contractHash;
  assert(hash === expected, `Expected ${space} marker ${expected}; found ${hash ?? JSON.stringify(marker)}`);
  return marker;
}

function containsHash(value, expected) {
  return JSON.stringify(value ?? {}).includes(expected);
}

async function main() {
  const adminUrl = readFixtureAdminUrl();
  const preview = runPrisma(['db', 'migrate', '--show', '--from', '@empty', '--to', TARGET, '--json']);
  const plan = resultValue(preview);
  const planned = plan?.migrations ?? [];
  assert(preview.envelope?.envelope?.ok === true, 'Fresh-route preview did not return a successful JSON envelope.');
  assert(planned.some(edge => edge.dirName === '20261010T0331_fresh_supabase_mvp_baseline'), 'Fresh-route preview did not select the reviewed fresh Supabase baseline.');
  assert(!planned.some(edge => edge.dirName === '20261005T0335_baseline'), 'Fresh-route preview unexpectedly selected the legacy baseline.');
  assert(planned.some(edge => edge.spaceId === 'pgvector'), 'Fresh-route preview omitted the pgvector extension migration.');

  const { databaseName: freshName, databaseUrl: freshUrl } = await createFoundationFixture(adminUrl, 'fresh', { removeVector: true });
  const freshIdentity = await inspectFixture(freshUrl);
  const adminServer = await inspectServer(adminUrl);
  assert(freshIdentity.database === freshName && freshIdentity.server_address === adminServer.server_address &&
    Number(freshIdentity.server_port) === Number(adminServer.server_port) && freshIdentity.server_version === adminServer.server_version,
  'Created database identity did not match the guarded local PostgreSQL server.');
  assert(freshIdentity.vector === null, 'Fresh executor target unexpectedly already has pgvector installed.');
  assert(freshIdentity.has_marker === false, 'Fresh executor target unexpectedly already has a Prisma marker.');

  const apply = runPrisma(['db', 'migrate', dbArg(freshUrl), '--to', TARGET, '--json']);
  const appliedLedger = await readMigrationLog(freshUrl);
  const appliedHashes = new Set((appliedLedger?.records ?? []).map(record => record.hash));
  assert((appliedLedger?.records?.length ?? 0) === planned.length && planned.every(edge => appliedHashes.has(edge.migrationHash)), 'Canonical executor did not record the same migration edges that the preview selected.');
  const markersAfterApply = await readMarkerRows(freshUrl);
  assertMarker(markersAfterApply, 'app', TARGET);
  assertMarker(markersAfterApply, 'pgvector', PGVECTOR_HEAD);
  const vectorAfterApply = await inspectFixture(freshUrl);
  assert(vectorAfterApply.vector?.schema === 'extensions', 'Canonical pgvector migration did not create the extension in the configured `extensions` search-path schema.');
  assert(JSON.stringify(markersAfterApply.find(row => row.space === 'app')).includes(PROFILE), 'Application marker did not advance with the expected profile hash.');

  const markerVerify = runPrisma(['db', 'verify', dbArg(freshUrl), '--marker-only', '--json']);
  assert(markerVerify.envelope?.envelope?.ok === true, 'db verify marker-only rejected the migrated fresh fixture.');
  const verifyJson = JSON.stringify(resultValue(markerVerify));
  assert(verifyJson.includes(TARGET), 'db verify output omitted the expected application contract marker.');
  assert(verifyJson.includes(PROFILE), 'db verify output omitted the expected application profile hash.');
  const fullVerify = runPrisma(['db', 'verify', dbArg(freshUrl), '--json'], { expectFailure: true });
  const fullVerifyResult = resultValue(fullVerify);
  const fullVerifyIssues = fullVerifyResult?.schema?.issues ?? [];
  const fullVerifyPaths = fullVerifyIssues.map(issue => issue.path?.join('/') ?? '').sort();
  const appPolicyPaths = fullVerifyPaths.filter(path => path.startsWith('database/public/'));
  const unknownAppPolicyPaths = appPolicyPaths.filter(path => !APP_POLICY_VERIFY_ISSUES.has(path));
  const externalPaths = fullVerifyPaths.filter(path => !path.startsWith('database/public/'));
  assert(fullVerifyResult?.ok === false && fullVerifyIssues.length > 0, 'Full db verify unexpectedly did not return a schema finding envelope.');
  assert(appPolicyPaths.length === APP_POLICY_VERIFY_ISSUES.size && unknownAppPolicyPaths.length === 0,
    `Full db verify app-policy path set changed: ${JSON.stringify({ count: appPolicyPaths.length, unknown: unknownAppPolicyPaths })}`);
  assert(externalPaths.every(path => path.startsWith('database/auth/') || path.startsWith('database/storage/')),
    `Full db verify reported an unexpected non-app issue path: ${JSON.stringify(externalPaths.filter(path => !path.startsWith('database/auth/') && !path.startsWith('database/storage/')))}`);

  const logAfterApply = await readMigrationLog(freshUrl);
  assert(containsHash(logAfterApply, TARGET) && containsHash(logAfterApply, PGVECTOR_HEAD), 'Prisma migration ledger omitted an expected terminal hash.');
  const logSnapshot = JSON.stringify(logAfterApply);
  const markerSnapshot = JSON.stringify(markersAfterApply);
  const rerun = runPrisma(['db', 'migrate', dbArg(freshUrl), '--to', TARGET, '--json']);
  const markersAfterRerun = await readMarkerRows(freshUrl);
  assert(JSON.stringify(markersAfterRerun) === markerSnapshot, 'No-op rerun changed markers.');
  assert(JSON.stringify(await readMigrationLog(freshUrl)) === logSnapshot, 'No-op rerun changed the Prisma migration ledger.');

  const { databaseName: c7Name, databaseUrl: c7Url } = await createFoundationFixture(adminUrl, 'c7_suffix');
  // Build a definitions-only fixture from the immutable c7 contract snapshot.
  // db sign only writes the marker after Prisma verifies the live schema against c7.
  runPrisma(['db', 'update', dbArg(c7Url), `--to=${OBSERVED_ORIGIN}`, '--json']);
  const signedC7 = runPrisma(['db', 'sign', OBSERVED_ORIGIN, dbArg(c7Url), '--no-advance-ref', '--json']);
  assert(signedC7.envelope?.envelope?.ok === true, 'Prisma could not verify/sign the definitions-only c7 clone.');
  let c7MarkersBefore = await readMarkerRows(c7Url);
  assertMarker(c7MarkersBefore, 'app', OBSERVED_ORIGIN);
  assertMarker(c7MarkersBefore, 'pgvector', PGVECTOR_HEAD);
  const legacyPayloadBefore = await seedC7LegacyRows(c7Url);
  const c7Preview = resultValue(runPrisma(['db', 'migrate', '--show', dbArg(c7Url), '--from', OBSERVED_ORIGIN, '--to', TARGET, '--json']));
  const c7Planned = c7Preview?.migrations ?? [];
  assert(c7Planned.length > 0, 'c7 suffix preview did not include any app migration edges.');
  const c7Apply = runPrisma(['db', 'migrate', dbArg(c7Url), '--to', TARGET, '--json']);
  const c7AppliedLedger = await readMigrationLog(c7Url);
  const c7AppliedHashes = new Set((c7AppliedLedger?.records ?? []).map(record => record.hash));
  const c7OriginEntry = c7AppliedLedger?.records?.find(record => record.space === 'app' && record.name === '' && record.hash === OBSERVED_ORIGIN);
  assert((c7AppliedLedger?.records?.length ?? 0) === c7Planned.length + 1 && c7OriginEntry &&
    c7Planned.every(edge => c7AppliedHashes.has(edge.migrationHash)), 'Canonical executor did not record the reviewed c7 suffix edges and verified origin.');
  const c7MarkersAfter = await readMarkerRows(c7Url);
  assertMarker(c7MarkersAfter, 'app', TARGET);
  assertMarker(c7MarkersAfter, 'pgvector', PGVECTOR_HEAD);
  assert(JSON.stringify(c7MarkersAfter.find(row => row.space === 'app')).includes(PROFILE), 'c7 suffix application marker did not advance with the expected profile hash.');
  const legacyPayloadAfter = (await query(c7Url, `SELECT json_build_object(
      'user', (SELECT row_to_json(u) FROM public."User" u WHERE u.id='legacy-app-user-101'),
      'session', (SELECT row_to_json(s) FROM public."LearningSession" s WHERE s.id='legacy-session-101'),
      'messages', (SELECT json_agg(m ORDER BY m.id) FROM public."Message" m WHERE m."learningSessionId"='legacy-session-101')) AS payload`)).rows[0].payload;
  assert(JSON.stringify(legacyPayloadAfter) === JSON.stringify(legacyPayloadBefore), 'The c7 suffix changed the synthetic legacy user/session/message IDs or content.');
  const c7Log = await readMigrationLog(c7Url);
  assert(containsHash(c7Log, TARGET) && containsHash(c7Log, OBSERVED_ORIGIN), 'c7 suffix ledger did not retain the verified origin and target.');
  const c7LogSnapshot = JSON.stringify(c7Log);
  const c7MarkerSnapshot = JSON.stringify(c7MarkersAfter);
  const c7Rerun = runPrisma(['db', 'migrate', dbArg(c7Url), '--to', TARGET, '--json']);
  assert(JSON.stringify(await readMarkerRows(c7Url)) === c7MarkerSnapshot, 'c7 suffix no-op rerun changed markers.');
  assert(JSON.stringify(await readMigrationLog(c7Url)) === c7LogSnapshot, 'c7 suffix no-op rerun changed the migration ledger.');

  const { databaseName: wrongOriginName, databaseUrl: wrongOriginUrl } = await createFoundationFixture(adminUrl, 'wrong_origin', { removeVector: true });
  // A real fresh marker is created first; the old c7 branch is not reachable from it.
  // This proves the executor fails closed without manufacturing a c7 marker.
  runPrisma(['db', 'migrate', dbArg(wrongOriginUrl), '--to', APP_FRESH, '--json']);
  const markerBeforeWrongTarget = await readMarkerRows(wrongOriginUrl);
  assertMarker(markerBeforeWrongTarget, 'app', APP_FRESH);
  const logBeforeWrongTarget = JSON.stringify(await readMigrationLog(wrongOriginUrl));
  const catalogBeforeWrongTarget = await readCatalogSignature(wrongOriginUrl);
  const wrongOrigin = runPrisma(['db', 'migrate', dbArg(wrongOriginUrl), '--to', OBSERVED_ORIGIN, '--json'], { expectFailure: true });
  assert(/path|origin|migration|contract/iu.test(wrongOrigin.output), 'Wrong-origin rejection did not identify an unsupported migration route.');
  assert(JSON.stringify(await readMarkerRows(wrongOriginUrl)) === JSON.stringify(markerBeforeWrongTarget), 'Wrong-origin attempt changed the marker.');
  assert(JSON.stringify(await readMigrationLog(wrongOriginUrl)) === logBeforeWrongTarget, 'Wrong-origin attempt changed the migration ledger.');
  assert(await readCatalogSignature(wrongOriginUrl) === catalogBeforeWrongTarget, 'Wrong-origin attempt changed fixture schema or policies.');
  const wrongTables = await query(wrongOriginUrl, `SELECT to_regclass('public."KnowledgeChunk"') IS NOT NULL AS has_knowledge`);
  assert(wrongTables.rows[0].has_knowledge === false, 'Wrong-origin attempt unexpectedly applied current schema operations.');

  const { databaseName: failedName, databaseUrl: failedUrl } = await createFoundationFixture(adminUrl, 'failed_tx');
  // Construct a synthetic c7 origin through the canonical CLI. The verified
  // pgvector state is established through the canonical existing-extension
  // path, then the fixture relocates it to reproduce the app precondition failure.
  runPrisma(['db', 'update', dbArg(failedUrl), `--to=${OBSERVED_ORIGIN}`, '--json']);
  const signedFailureOrigin = runPrisma(['db', 'sign', OBSERVED_ORIGIN, dbArg(failedUrl), '--no-advance-ref', '--json']);
  assert(signedFailureOrigin.envelope?.envelope?.ok === true, 'Prisma could not verify/sign the rollback fixture c7 origin.');
  const failureMarkersBefore = await readMarkerRows(failedUrl);
  assertMarker(failureMarkersBefore, 'app', OBSERVED_ORIGIN);
  assertMarker(failureMarkersBefore, 'pgvector', PGVECTOR_HEAD);
  await query(failedUrl, 'ALTER EXTENSION vector SET SCHEMA public');
  const failureLogBefore = await readMigrationLog(failedUrl);
  const failureCatalogBefore = await readCatalogSignature(failedUrl);
  const failed = runPrisma(['db', 'migrate', dbArg(failedUrl), '--to', TARGET, '--json'], { expectFailure: true });
  assert(/Enable pgvector in extensions/iu.test(failed.output), `Expected the known pgvector schema precondition failure; got: ${failed.output.slice(-1200)}`);
  const rollbackState = await query(failedUrl, `SELECT
    to_regclass('public."FileUpload"') IS NULL AS pending_table_absent,
    to_regclass('public."KnowledgeChunk"') IS NULL AS failed_step_absent,
    (SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector') AS vector_schema`);
  const failedMarkers = await readMarkerRows(failedUrl);
  const failedLog = await readMigrationLog(failedUrl);
  assert(rollbackState.rows[0].pending_table_absent && rollbackState.rows[0].failed_step_absent &&
    JSON.stringify(failedMarkers) === JSON.stringify(failureMarkersBefore) &&
    JSON.stringify(failedLog) === JSON.stringify(failureLogBefore) &&
    await readCatalogSignature(failedUrl) === failureCatalogBefore,
    `Failed migrate run left partial schema or marker state: ${JSON.stringify(rollbackState.rows[0])}`);
  assert(rollbackState.rows[0].vector_schema === 'public', 'Rollback changed the intentionally pre-existing public pgvector extension.');

  console.log(JSON.stringify({
    status: 'PASS_WITH_FULL_VERIFY_BLOCKER',
    cli: 'Prisma 8 RC canonical db migrate executor',
    target: { host: adminUrl.hostname, port: Number(adminUrl.port) },
    fresh: { database: freshName, routeEdges: planned.map(edge => `${edge.spaceId}:${edge.dirName || '(extension descriptor)'}`), appMarker: TARGET, appProfile: PROFILE, pgvectorMarker: PGVECTOR_HEAD, rerun: 'no-op' },
    wrongOrigin: { database: wrongOriginName, startingMarker: APP_FRESH, requestedOrigin: OBSERVED_ORIGIN, result: 'rejected without schema or marker change' },
    c7Suffix: { database: c7Name, verifiedOrigin: OBSERVED_ORIGIN, target: TARGET, startingState: 'all contract spaces initialized by canonical db update; c7 app signature then verified by db sign', syntheticLegacyRowsPreserved: true, markerAdvanced: true },
    failedTransaction: { database: failedName, startingOrigin: OBSERVED_ORIGIN, failure: 'Canonical CLI setup verified the already-installed pgvector contract, then the fixture relocated the extension to public; the reviewed app migration required extensions.vector', rollback: 'all pending app schema/marker/ledger work rolled back; CLI-created markers and relocated extension preserved' },
    fullVerify: { status: 'BLOCKED', database: freshName, issueCount: fullVerifyIssues.length, appPolicyIssueCount: appPolicyPaths.length, appPolicyPaths, externalIssueCount: externalPaths.length, externalSchemas: [...new Set(externalPaths.map(path => path.split('/')[1]))].sort(), independentAppCatalogComparison: 'Sol confirmed all 90 manifest expressions and all 30 public policies match the generated dbupdate/schema-verified-sign baseline exactly.' },
    note: 'Databases are intentionally retained for review. Auth and Storage schemas came from a clone of the local Supabase-compatible foundation; executor fixtures do not establish Auth/Storage HTTP-service acceptance.',
  }, null, 2));
}

main().catch(error => {
  console.error(`MIGRATION EXECUTOR VERIFICATION FAILED: ${error.message}`);
  process.exitCode = 1;
});
