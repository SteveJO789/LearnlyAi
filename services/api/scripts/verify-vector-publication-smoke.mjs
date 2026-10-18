// Rollback-only local pgvector publication and retrieval plumbing check.
// Prisma publication/search adapters generate the SQL; execution uses authenticated RLS in an isolated schema.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { activationTargetError } from '../dist/shared/activation-schema-readiness.js';

const run = promisify(execFile);
const fixtureDatabase = process.argv.find(value => value.startsWith('--fixture-database='))?.slice('--fixture-database='.length);
if (!fixtureDatabase || !/^learnly_activation_executor_catalog_[a-zA-Z0-9_]{1,48}$/u.test(fixtureDatabase)) {
  report('INVALID_FIXTURE_DATABASE');
}
const sourceUrl = process.env.LEARNLY_VECTOR_SMOKE_DATABASE_URL ?? process.env.DATABASE_URL;
if (activationTargetError({ connectionString: sourceUrl, target: 'local', expectedDatabase: 'postgres' })) {
  report('LOCAL_DATABASE_TARGET_REQUIRED');
}
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${fixtureDatabase}`;
const tempDir = await mkdtemp(join(tmpdir(), 'learnly-vector-smoke-'));
const sqlPath = join(tempDir, 'vector-smoke.sql');
const rendererPath = fileURLToPath(new URL('./render-vector-publication-verification.mjs', import.meta.url));
const client = new pg.Client({ connectionString: databaseUrl.toString(), connectionTimeoutMillis: 3000,
  query_timeout: 30000, statement_timeout: 25000 });
client.on('error', () => {});
let phase = 'RENDER';
try {
  const rendered = await run(process.execPath, [rendererPath, `--output=${sqlPath}`], { cwd: process.cwd(), timeout: 30000 });
  const renderInfo = JSON.parse(rendered.stdout.trim());
  phase = 'CONNECT';
  await client.connect();
  const target = await client.query('SELECT current_database() AS name');
  if (target.rows[0]?.name !== fixtureDatabase) report('DATABASE_TARGET_MISMATCH');
  const priorExtensionUsage = await client.query(`SELECT has_schema_privilege('authenticated', 'extensions', 'USAGE') AS allowed`);
  const sql = await readFile(sqlPath, 'utf8');
  phase = 'TRANSACTIONAL_PUBLICATION_RETRIEVAL';
  const fixtureSql = sql.replace(/^BEGIN\s*;/u, "BEGIN;\nGRANT USAGE ON SCHEMA extensions TO authenticated;");
  if (fixtureSql === sql) report('ROLLBACK_FIXTURE_TRANSACTION_MISSING');
  const results = await client.query(fixtureSql);
  const final = Array.isArray(results) ? results.at(-1) : results;
  if (final?.rows?.[0]?.fixture_removed !== true) report('FIXTURE_CLEANUP_NOT_VERIFIED');
  const restoredExtensionUsage = await client.query(`SELECT has_schema_privilege('authenticated', 'extensions', 'USAGE') AS allowed`);
  if (restoredExtensionUsage.rows[0]?.allowed !== priorExtensionUsage.rows[0]?.allowed) report('FIXTURE_GRANT_NOT_ROLLED_BACK');
  process.stdout.write(JSON.stringify({ status: 'PASS', fixture: fixtureDatabase,
    publishedReviewedChunks: renderInfo.chunks, vectorDimensions: 1536, syntheticVectors: true,
    providerCalls: 0, authenticatedReviewedSearch: true, anonymousAndStudentWritesDenied: true,
    fixtureOnlyExtensionUsageGrant: true, extensionGrantRestoredAfterRollback: true,
    transactionRolledBack: true, fixtureRemoved: true, scope: 'database plumbing only; no provider or retrieval-quality evidence' }) + '\n');
} catch (error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,32}$/u.test(error.code) ? error.code : 'FAILED';
  const sql = phase === 'TRANSACTIONAL_PUBLICATION_RETRIEVAL' ? await readFile(sqlPath, 'utf8').catch(() => '') : '';
  const failure = locateStatement(sql, Number(error?.position));
  const message = String(error?.message ?? '');
  const reason = /permission denied for schema/iu.test(message) ? 'SCHEMA_USAGE_DENIED' :
    /permission denied for table|permission denied for relation/iu.test(message) ? 'TABLE_ACCESS_DENIED' :
    /must be member of role|permission denied to set role/iu.test(message) ? 'ROLE_SET_DENIED' : 'OTHER';
  process.stdout.write(JSON.stringify({ status: 'BLOCKED', code: 'VECTOR_SMOKE_FAILED', phase, databaseCode: code,
    databaseReason: reason, ...(failure ? { statementNumber: failure.number, statementKind: failure.kind } : {}) }) + '\n');
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch { /* keep sanitized status */ }
  await rm(tempDir, { recursive: true, force: true });
}
function report(code) {
  process.stdout.write(JSON.stringify({ status: 'BLOCKED', code }) + '\n');
  process.exit(2);
}
function locateStatement(sql, position) {
  if (!sql || !Number.isInteger(position) || position < 1) return undefined;
  let single = false, double = false, dollar = '', start = 0, number = 1;
  for (let i = 0; i < Math.min(sql.length, position - 1); i += 1) {
    const char = sql[i] ?? '';
    if (dollar) { if (sql.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ''; } continue; }
    if (single) { if (char === "'" && sql[i + 1] === "'") i += 1; else if (char === "'") single = false; continue; }
    if (double) { if (char === '"' && sql[i + 1] === '"') i += 1; else if (char === '"') double = false; continue; }
    if (char === "'") { single = true; continue; }
    if (char === '"') { double = true; continue; }
    if (char === '$') {
      const tag = /^\$[a-zA-Z_0-9]*\$/u.exec(sql.slice(i))?.[0];
      if (tag) { dollar = tag; i += tag.length - 1; continue; }
    }
    if (char === ';') { start = i + 1; number += 1; }
  }
  const kind = /^\s*([a-zA-Z]+)/u.exec(sql.slice(start))?.[1]?.toUpperCase();
  return kind ? { number, kind } : undefined;
}
