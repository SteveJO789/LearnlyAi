import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyPrecheckSteps, operationFingerprint, patchRuntimeBundle, LEGACY_PRECHECK_ARTIFACTS } from '../scripts/install-migration-precheck-compat.mjs';

const appPlan = { targetId: 'postgres', spaceId: 'app', destination: { storageHash: 'f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b' } };
const legacyOperationId = 'security.fresh-app-grants.User';
const legacyOperation = {
  id: legacyOperationId,
  label: 'Grant API access to User',
  operationClass: 'additive',
  target: { id: 'postgres', details: { schema: 'public', objectType: 'table', name: 'User' } },
  execute: [{ sql: 'GRANT SELECT ON TABLE public."User" TO authenticated' }],
  postcheck: [{ sql: 'SELECT true AS result' }],
};
const knownOperations = new Map([[appPlan.destination.storageHash, new Map([[legacyOperationId, operationFingerprint(legacyOperation)]])]]);

test('compatibility supplies an empty list only for manifest-bound omitted prechecks', () => {
  assert.deepEqual(legacyPrecheckSteps(appPlan, legacyOperation, knownOperations), []);

  const declared = [{ sql: 'SELECT true', params: [] }];
  assert.equal(legacyPrecheckSteps(appPlan, { ...legacyOperation, precheck: declared }, knownOperations), declared);
  assert.throws(() => legacyPrecheckSteps(appPlan, { ...legacyOperation, precheck: null }, knownOperations), /malformed precheck/u);
  assert.throws(() => legacyPrecheckSteps(appPlan, { ...legacyOperation, id: 'unlisted.operation' }, knownOperations), /unmanifested missing precheck/u);
  assert.throws(() => legacyPrecheckSteps({ ...appPlan, destination: { storageHash: 'unknown' } }, legacyOperation, knownOperations), /unmanifested missing precheck/u);
  assert.throws(() => legacyPrecheckSteps(appPlan, { ...legacyOperation, execute: [{ sql: 'DROP TABLE public."User"' }] }, knownOperations), /unmanifested missing precheck/u);
  assert.throws(() => legacyPrecheckSteps({ ...appPlan, spaceId: 'pgvector' }, legacyOperation, knownOperations), /unmanifested missing precheck/u);
});

test('patched runtime preserves dollar-quoted SQL payload bytes in its manifest', () => {
  const sourceOperation = {
    ...legacyOperation,
    id: 'knowledge.require-extensions-vector',
    execute: [{ sql: "DO $$ BEGIN IF to_regtype('extensions.vector') IS NULL THEN RAISE EXCEPTION 'Enable pgvector in extensions'; END $$", params: [] }],
    postcheck: [{ sql: 'SELECT to_regtype(\'extensions.vector\') IS NOT NULL AS result', params: [] }],
  };
  const operations = new Map([[appPlan.destination.storageHash, new Map([[sourceOperation.id, operationFingerprint(sourceOperation)]])]]);
  assert.deepEqual(legacyPrecheckSteps(appPlan, sourceOperation, operations), []);
  assert.throws(() => legacyPrecheckSteps(appPlan, { ...sourceOperation, execute: [{ sql: 'DROP EXTENSION vector' }] }, operations), /unmanifested missing precheck/u);
  const original = 'var PostgresMigrationRunner = class { const precheckResult = await this.runExpectationSteps(driver, operation.precheck, operation, "precheck"); };';
  assert.ok(patchRuntimeBundle(original, operations).includes('DO $$ BEGIN'));
});

test('runtime patch is surgical and idempotent', () => {
  const original = 'const LOCK_DOMAIN = "prisma_8.contract.marker";\nvar PostgresMigrationRunner = class {\n  const precheckResult = await this.runExpectationSteps(driver, operation.precheck, operation, "precheck");\n};';
  const patched = patchRuntimeBundle(original, knownOperations);
  assert.match(patched, /LEARNLY_PRECHECK_COMPAT_RC12_V1/u);
  assert.match(patched, /legacyPrecheckSteps\(options\.plan, operation\)/u);
  assert.equal(patchRuntimeBundle(patched, knownOperations), patched);
  assert.throws(() => patchRuntimeBundle(`${original}\n${original}`, knownOperations), /one .*Postgres precheck callsite/u);
  assert.throws(() => patchRuntimeBundle('different bundle', knownOperations), /one .*Postgres precheck callsite/u);
});

test('legacy manifest remains limited to the twelve reviewed operation IDs', () => {
  assert.deepEqual(LEGACY_PRECHECK_ARTIFACTS.map(artifact => artifact.operationIds.length), [8, 1, 1, 2]);
  assert.equal(LEGACY_PRECHECK_ARTIFACTS.reduce((count, artifact) => count + artifact.operationIds.length, 0), 12);
});
