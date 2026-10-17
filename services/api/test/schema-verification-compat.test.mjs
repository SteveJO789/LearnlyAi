import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  installCompatibility,
  PATCHED_FUNCTION,
  PATCH_MARKER,
  ORIGINAL_FUNCTION,
  ORIGINAL_CALL,
  PATCHED_CALL,
  patchRuntimeBundle,
  ORIGINAL_BUNDLE_SHA256,
  PATCHED_BUNDLE_SHA256,
} from '../scripts/install-schema-verification-compat.mjs';

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_BUNDLE = path.join(API_ROOT, 'node_modules/@prisma/orm-toolchain/dist/aggregate-CZyUi3Gt.mjs');
const INTERMEDIATE_BUNDLE_SHA256 = '42b7addf855a0d5cfa6aae87cf39d3793e63132822d6c5d85642dda90e7ae376';
const INTERMEDIATE_FUNCTION = `function stripExtraFindings(result, classify) {
\tconst droppedTablePaths = result.schema.issues.filter((issue) => issueOutcome(issue) === "not-expected" && isWholeEntityIssue(issue, classify)).map((issue) => issue.path);
\tconst issues = result.schema.issues.filter((issue) => {
\t\tif (issueOutcome(issue) !== "not-expected") return true;
\t\t// Ownership projection must run before structural classification: a policy below an unowned, dropped entity is unowned too.
\t\tif (droppedTablePaths.some((prefix) => pathIsUnder(issue.path, prefix))) return false;
\t\tif (classify?.(issue) === "structural") return true;
\t\treturn true;
\t});
\tif (issues.length === result.schema.issues.length) return result;
\tconst ok = issues.length === 0;
\tconst { code: staleCode, ...envelope } = result;
\treturn {
\t\t...envelope,
\t\tok,
\t\t...ok ? {} : { code: result.code ?? "CONTRACT.MARKER_REQUIRED" },
\t\tsummary: ok ? "Database schema satisfies contract" : result.summary,
\t\tschema: {
\t\t\tissues,
\t\t\t...result.schema.warnings !== void 0 ? { warnings: result.schema.warnings } : {}
\t\t}
\t};
}`;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function originalRuntimeSource() {
  const source = await readFile(RUNTIME_BUNDLE, 'utf8');
  if (sha256(source) === ORIGINAL_BUNDLE_SHA256) return source;
  const patchedFragment = `${PATCHED_FUNCTION}\n// ${PATCH_MARKER}`;
  if (sha256(source) === PATCHED_BUNDLE_SHA256 && source.split(patchedFragment).length === 2) {
    const original = source.replace(patchedFragment, ORIGINAL_FUNCTION).replace(PATCHED_CALL, ORIGINAL_CALL);
    assert.equal(sha256(original), ORIGINAL_BUNDLE_SHA256);
    return original;
  }
  throw new Error('Installed Prisma aggregate bundle is not one of the pinned compatibility versions.');
}

async function loadPatchedStripper() {
  const helpers = `
function issueOutcome(issue) { return issue.outcome; }
function isWholeEntityIssue(issue, classify) { return classify?.(issue) === 'entity'; }
function pathIsUnder(path, prefix) { return prefix.every((segment, index) => path[index] === segment); }
`;
  const source = `${helpers}\n${PATCHED_FUNCTION}\nexport { stripExtraFindings };`;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function issue(path, outcome, kind) {
  return { path, outcome, kind };
}

function classify(issue) {
  return issue.kind;
}

test('policy extras are suppressed only in a sibling space that does not own their table', async () => {
  const { stripExtraFindings } = await loadPatchedStripper();
  const policy = {
    ...issue(['database', 'public', 'AIRequest', 'ai_request_select_own_5424dd11'], 'not-expected', 'structural'),
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'AIRequest' },
  };
  const result = { ok: false, summary: 'schema drift', schema: { issues: [policy] } };
  const aggregate = ownerSpaces => ({ declaringSpaces: coordinate => {
    assert.deepEqual(coordinate, { namespaceId: 'public', entityKind: 'table', entityName: 'AIRequest' });
    return ownerSpaces;
  } });

  assert.deepEqual(stripExtraFindings(result, classify, aggregate(['app']), 'pgvector').schema.issues, []);
  assert.deepEqual(stripExtraFindings(result, classify, aggregate(['app']), 'app').schema.issues, [policy]);
  assert.deepEqual(stripExtraFindings(result, classify, aggregate([]), 'pgvector').schema.issues, [policy]);
  assert.deepEqual(stripExtraFindings(result, classify, aggregate(['app', 'pgvector']), 'pgvector').schema.issues, [policy]);
});

test('unknown policy coordinates, mismatched paths, and role findings stay visible', async () => {
  const { stripExtraFindings } = await loadPatchedStripper();
  const mismatchedPolicy = {
    ...issue(['database', 'public', 'OtherTable', 'policy:extra'], 'not-expected', 'structural'),
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
  };
  const malformedPathPolicy = {
    ...issue(['database', 'public', 'User'], 'not-expected', 'structural'),
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
  };
  const role = {
    ...issue(['database', 'reader_role'], 'not-expected', 'structural'),
    actual: { nodeKind: 'postgres-role' },
  };
  const nonActualOnlyPolicy = {
    ...issue(['database', 'public', 'User', 'policy:expected'], 'not-expected', 'structural'),
    expected: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
  };
  const result = { ok: false, summary: 'schema drift', schema: { issues: [mismatchedPolicy, malformedPathPolicy, role, nonActualOnlyPolicy] } };
  const aggregate = { declaringSpaces: () => { throw new Error('unexpected owner lookup'); } };

  assert.deepEqual(stripExtraFindings(result, classify, aggregate, 'pgvector').schema.issues, [mismatchedPolicy, malformedPathPolicy, role, nonActualOnlyPolicy]);
});

test('missing and mismatch findings are preserved without consulting ownership', async () => {
  const { stripExtraFindings } = await loadPatchedStripper();
  const missingPolicy = {
    ...issue(['database', 'public', 'User', 'policy:missing'], 'missing', 'structural'),
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
  };
  const mismatchPolicy = {
    ...issue(['database', 'public', 'User', 'policy:mismatch'], 'mismatch', 'structural'),
    actual: { nodeKind: 'postgres-policy', namespaceId: 'public', tableName: 'User' },
  };
  const result = { ok: false, summary: 'schema drift', schema: { issues: [missingPolicy, mismatchPolicy] } };
  const aggregate = { declaringSpaces: () => { throw new Error('unexpected owner lookup'); } };

  assert.deepEqual(stripExtraFindings(result, classify, aggregate, 'pgvector').schema.issues, [missingPolicy, mismatchPolicy]);
});

test('patcher applies exactly once and is idempotent', async () => {
  const original = await originalRuntimeSource();
  const patched = patchRuntimeBundle(original);
  assert.match(patched, new RegExp(PATCH_MARKER));
  assert.equal(patchRuntimeBundle(patched), patched);
  assert.throws(() => patchRuntimeBundle(`${original}\n${original}`), /unmodified aggregate projection/u);
  assert.throws(() => patchRuntimeBundle('unrecognized runtime'), /unmodified aggregate projection/u);
  assert.equal(patched.replace(`${PATCHED_FUNCTION}\n// ${PATCH_MARKER}`, ORIGINAL_FUNCTION).replace(PATCHED_CALL, ORIGINAL_CALL), original);
  assert.notEqual(ORIGINAL_BUNDLE_SHA256, PATCHED_BUNDLE_SHA256);
});

async function createFixtureRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'learnly-schema-compat-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = path.join(root, 'node_modules/@prisma/orm-toolchain');
  await mkdir(path.join(packageRoot, 'dist'), { recursive: true });
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ version: '8.0.0-rc.12' }));
  await writeFile(path.join(packageRoot, 'dist/aggregate-CZyUi3Gt.mjs'), await originalRuntimeSource());
  return root;
}

test('installer patches the pinned bundle and reports idempotent reinstallation', async t => {
  const root = await createFixtureRoot(t);
  assert.equal((await installCompatibility(root)).status, 'patched');
  assert.equal((await installCompatibility(root)).status, 'already-patched');
});

test('installer fails closed on missing bundle, wrong version, and bundle tampering', async t => {
  const root = await createFixtureRoot(t);
  const packageRoot = path.join(root, 'node_modules/@prisma/orm-toolchain');
  await rm(path.join(packageRoot, 'dist/aggregate-CZyUi3Gt.mjs'));
  await assert.rejects(installCompatibility(root), /ENOENT/u);

  await writeFile(path.join(packageRoot, 'dist/aggregate-CZyUi3Gt.mjs'), await originalRuntimeSource());
  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ version: '8.0.0-rc.13' }));
  await assert.rejects(installCompatibility(root), /Expected @prisma\/orm-toolchain@8\.0\.0-rc\.12/u);

  await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ version: '8.0.0-rc.12' }));
  await writeFile(path.join(packageRoot, 'dist/aggregate-CZyUi3Gt.mjs'), 'tampered bundle');
  await assert.rejects(installCompatibility(root), /Unexpected Prisma aggregate bundle hash/u);
});

test('installer rejects a patched-looking bundle with a changed digest', async t => {
  const root = await createFixtureRoot(t);
  await installCompatibility(root);
  const bundlePath = path.join(root, 'node_modules/@prisma/orm-toolchain/dist/aggregate-CZyUi3Gt.mjs');
  const source = await readFile(bundlePath, 'utf8');
  await writeFile(bundlePath, `${source}\n// tampered`);
  await assert.rejects(installCompatibility(root), /Unexpected Prisma aggregate bundle hash/u);
});

test('installer rejects a structurally compatible but unrecognized runtime digest', async t => {
  const root = await createFixtureRoot(t);
  const bundlePath = path.join(root, 'node_modules/@prisma/orm-toolchain/dist/aggregate-CZyUi3Gt.mjs');
  await writeFile(bundlePath, `${await readFile(bundlePath, 'utf8')}\n`);
  await assert.rejects(installCompatibility(root), /Unexpected Prisma aggregate bundle hash/u);
});

test('installer rejects the prior intermediate patch digest', async t => {
  const root = await createFixtureRoot(t);
  const bundlePath = path.join(root, 'node_modules/@prisma/orm-toolchain/dist/aggregate-CZyUi3Gt.mjs');
  const original = await originalRuntimeSource();
  const intermediate = original.replace(ORIGINAL_FUNCTION, `${INTERMEDIATE_FUNCTION}\n// LEARNLY_SCHEMA_OWNERSHIP_COMPAT_RC12_V1`);
  assert.equal(sha256(intermediate), INTERMEDIATE_BUNDLE_SHA256);
  await writeFile(bundlePath, intermediate);
  await assert.rejects(installCompatibility(root), /Unexpected Prisma aggregate bundle hash/u);
});
