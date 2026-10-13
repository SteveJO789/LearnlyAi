import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { LocalReviewedKnowledgeReader } from '../dist/modules/knowledge/reviewed-knowledge-reader.js';
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from '../dist/modules/knowledge/reviewed-chunks.js';
import { reviewedProvenanceHash } from '../dist/modules/knowledge/vector-knowledge-retriever.js';

test('actual operator CLI prepares/validates without network, refuses overwrite and redacts invalid input/target', async t => {
  const root = resolve(import.meta.dirname, '..');
  const scratch = mkdtempSync(join(tmpdir(), 'learnly-vector-cli-'));
  t.after(() => {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(resolve(scratch).startsWith(join(resolve(tmpdir()), 'learnly-vector-cli-')));
    rmSync(scratch, { recursive: true, force: true });
  });
  const guard = join(scratch, 'network-guard.mjs');
  writeFileSync(guard, `import net from 'node:net'; net.Socket.prototype.connect = function(){ throw Error('Unexpected network'); }; globalThis.fetch = () => { throw Error('Unexpected provider'); };`);
  const passage = await new LocalReviewedKnowledgeReader(resolve(root, 'runtime-knowledge')).readPilot();
  const chunks = chunkReviewedPassage(passage);
  const report = join(scratch, 'report.json'), index = join(scratch, 'index.json');
  writeFileSync(report, JSON.stringify({ completed: true, model: 'openai/text-embedding-3-small', dimensions: 1536,
    passage: { id: passage.passageId, conceptId: passage.conceptId, version: passage.conceptVersion, provenanceHash: reviewedProvenanceHash(passage) },
    chunks, embeddingInputs: chunks.map(chunk => reviewedChunkEmbeddingInput(passage, chunk)), chunkVectors: chunks.map(() => [1, ...Array(1535).fill(0)]) }));
  const run = args => spawnSync(process.execPath, ['--import=' + pathToFileURL(guard).href, 'scripts/knowledge-vectors.mjs', ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000, env: { ...process.env, KNOWLEDGE_ROOT: resolve(root, 'runtime-knowledge'),
      DATABASE_URL: 'postgres://secret@unexpected.invalid/database', KNOWLEDGE_PUBLISH_DATABASE_URL: 'postgres://secret@unexpected.invalid/database' },
  });
  const prepared = run(['prepare', '--report=' + report, '--output=' + index]);
  assert.equal(prepared.status, 0, prepared.stderr); assert.equal(JSON.parse(prepared.stdout).status, 'PREPARED');
  const bytes = readFileSync(index, 'utf8');
  assert.equal(run(['prepare', '--report=' + report, '--output=' + index]).status, 1);
  assert.equal(readFileSync(index, 'utf8'), bytes);
  const dry = run(['publish', '--index=' + index]);
  assert.equal(dry.status, 0, dry.stderr); assert.equal(JSON.parse(dry.stdout).status, 'VALIDATED');
  const wrong = run(['publish', '--index=' + index, '--apply', '--target=wrong.invalid:5432/database']);
  assert.equal(wrong.status, 1); assert.doesNotMatch(wrong.stderr + wrong.stdout, /secret|unexpected\.invalid|wrong\.invalid|Unexpected network|report\.json/);
  writeFileSync(index, '{"secret":"do-not-print"}');
  const invalid = run(['publish', '--index=' + index]);
  assert.equal(invalid.status, 1); assert.doesNotMatch(invalid.stderr + invalid.stdout, /do-not-print|secret/);
});

test('actual Prisma publication composition builds bound plans with installed Supabase/pgvector codecs and explicit marker checking', async () => {
  const { default: postgres } = await import('@prisma/orm-postgres/runtime');
  const { default: vector } = await import('@prisma/orm-extension-pgvector/runtime');
  const { default: supabase } = await import('@prisma/orm-extension-supabase/runtime');
  const { default: contractJson } = await import('../dist/prisma/contract.json', { with: { type: 'json' } });
  const client = postgres({ contractJson, url: 'postgres://unused.invalid/test', extensions: [supabase, vector], verifyMarker: 'onFirstUse' });
  try {
    const plan = client.raw.sql`DELETE FROM public."KnowledgeChunk" WHERE "documentId" = ${"fixture/' hostile"}`.affectedCount().build();
    assert.ok(plan); // Construction/codec compatibility only; no database execution.
  } finally { await client.close(); }
});
