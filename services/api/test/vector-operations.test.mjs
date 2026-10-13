import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createKnowledgeHarness } from './knowledge-test-helpers.mjs';
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from '../dist/modules/knowledge/reviewed-chunks.js';
import { reviewedProvenanceHash } from '../dist/modules/knowledge/vector-knowledge-retriever.js';
import { prepareReviewedVectorsFromReport, validatePreparedReviewedVectors } from '../dist/modules/knowledge/prepared-reviewed-vectors.js';
import { runKnowledgeVectorCommand } from '../dist/operations/knowledge-vector-command.js';
import { assertReviewedIndexReady } from '../dist/modules/knowledge/reviewed-index-readiness.js';
import { checkVectorIndexReadiness } from '../dist/shared/vector-index-readiness.js';

async function fixture(t) {
  const passage = (await createKnowledgeHarness(t).retriever.retrieve({ studentInput: 'Ohm' }))[0];
  const chunks = chunkReviewedPassage(passage), inputs = chunks.map(chunk => reviewedChunkEmbeddingInput(passage, chunk));
  const report = { completed: true, model: 'openai/text-embedding-3-small', dimensions: 1536,
    passage: { id: passage.passageId, conceptId: passage.conceptId, version: passage.conceptVersion, provenanceHash: reviewedProvenanceHash(passage) },
    chunks, embeddingInputs: inputs, chunkVectors: chunks.map(() => [1, ...Array(1535).fill(0)]),
    queryVectors: ['synthetic-private-question-must-not-be-exported'] };
  const prepared = prepareReviewedVectorsFromReport(report, passage);
  return { passage, report, prepared, rows: chunks.map((chunk, i) => ({ chunkId: chunk.id, passageId: chunk.passageId,
    passageHash: chunk.passageHash, contentHash: chunk.contentHash, embeddingInputHash: inputs[i].hash,
    provenanceHash: reviewedProvenanceHash(passage), dimensions: 1536, nonzero: true })) };
}

test('prepared embedding import keeps exact current identities and omits report queries/cost/credentials', async t => {
  const { passage, report, prepared } = await fixture(t);
  assert.deepEqual(validatePreparedReviewedVectors(JSON.parse(JSON.stringify(prepared)), passage), prepared);
  assert.doesNotMatch(JSON.stringify(prepared), /queryVectors|private-question|pricing|credential/);
  for (const change of [{ model: 'other/model' }, { dimensions: 3 }, { completed: false }, { embeddingInputs: [] },
    { passage: { ...report.passage, provenanceHash: 'stale' } }, { chunkVectors: [Array(1536).fill(0)] },
    { chunkVectors: [[1e300, ...Array(1535).fill(0)]] }, { chunkVectors: [Array(1536).fill(1e-100)] }]) {
    assert.throws(() => prepareReviewedVectorsFromReport({ ...report, ...change }, passage));
  }
  for (const change of [{ passageHash: 'stale' }, { sourceOverride: [] }, { chunks: [] }, { dimensions: 3 }]) {
    assert.throws(() => validatePreparedReviewedVectors({ ...prepared, ...change }, passage));
  }
  assert.throws(() => validatePreparedReviewedVectors(prepared, { ...passage, title: passage.title + ' revised' }));
});

test('operator prepare and default validation never connect, publish or spend money', async t => {
  const { passage, report, prepared } = await fixture(t); let written;
  const dependencies = { reader: { readPilot: async () => passage }, readJson: async () => report,
    writeNewJson: async (path, value) => { written = { path, value }; }, connect: async () => assert.fail('no DB in prepare/dry run') };
  const result = await runKnowledgeVectorCommand(['prepare', '--report=report.json', '--output=new.json'], dependencies, {});
  assert.equal(result.status, 'PREPARED'); assert.equal(written.path, 'new.json'); assert.deepEqual(written.value, prepared);
  const dry = await runKnowledgeVectorCommand(['publish', '--index=index.json'], { ...dependencies, readJson: async () => prepared },
    { DATABASE_URL: 'postgres://must-not-connect.invalid/database', OPENROUTER_API_KEY: 'must-not-contact-provider' });
  assert.equal(dry.status, 'VALIDATED'); assert.equal(dry.chunks, prepared.chunks.length);
  await assert.rejects(runKnowledgeVectorCommand(['publish', '--index=a', '--index=b'], dependencies, {}), /duplicate/);
  await assert.rejects(runKnowledgeVectorCommand(['publish', '--index=a', '--model=other'], dependencies, {}), /option/);
});

test('operator apply checks dedicated target and source before connection, publishes once and closes on failure', async t => {
  const { passage, prepared } = await fixture(t); let connected = 0, closed = 0, replaced = 0;
  const dependencies = { reader: { readPilot: async () => passage }, readJson: async () => prepared,
    writeNewJson: async () => assert.fail('must not write'), connect: async url => {
      connected++; assert.equal(url, 'postgres://operator:synthetic-secret@fixture.invalid:5432/test');
      return { close: async () => { closed++; }, publisher: { replace: async (id, rows) => {
        replaced++; assert.equal(id, passage.conceptId); assert.equal(rows.length, prepared.chunks.length); throw Error('synthetic database failure');
      } } };
    } };
  const args = ['publish', '--index=index.json', '--apply', '--target=fixture.invalid:5432/test'];
  await assert.rejects(runKnowledgeVectorCommand(args, dependencies, { DATABASE_URL: 'postgres://fallback.invalid/test' }), /dedicated/);
  await assert.rejects(runKnowledgeVectorCommand(args, dependencies, { KNOWLEDGE_PUBLISH_DATABASE_URL: 'postgres://other.invalid/test' }), /target/);
  await assert.rejects(runKnowledgeVectorCommand(args, dependencies, { KNOWLEDGE_PUBLISH_DATABASE_URL: 'postgres://fixture.invalid/test?host=other.invalid' }), /target/);
  assert.equal(connected, 0);
  await assert.rejects(runKnowledgeVectorCommand(args, dependencies, { KNOWLEDGE_PUBLISH_DATABASE_URL: 'postgres://operator:synthetic-secret@fixture.invalid:5432/test' }), /failure/);
  assert.deepEqual([connected, replaced, closed], [1, 1, 1]);
});

test('index readiness rejects missing/duplicate/stale/current-source-mismatched and zero/dimension-invalid rows', async t => {
  const { passage, rows } = await fixture(t);
  assert.doesNotThrow(() => assertReviewedIndexReady(passage, rows));
  for (const altered of [[], [...rows, rows[0]], [{ ...rows[0], dimensions: 3 }], [{ ...rows[0], nonzero: false }],
    [{ ...rows[0], embeddingInputHash: 'stale' }], [{ ...rows[0], provenanceHash: 'stale' }], [{ ...rows[0], chunkId: 'unknown' }]]) {
    assert.throws(() => assertReviewedIndexReady(passage, altered));
  }
  assert.throws(() => assertReviewedIndexReady({ ...passage, title: passage.title + ' revised' }, rows));
});

test('index readiness uses fixed authenticated read-only role/bound current identities and closes without learner/provider access', async t => {
  const { passage, rows } = await fixture(t); const sql = []; let closed = 0;
  const env = { KNOWLEDGE_RETRIEVAL_MODE: 'vector', KNOWLEDGE_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    KNOWLEDGE_VECTOR_MIN_SIMILARITY: '0.8', OPENROUTER_API_KEY: 'offline-placeholder', DATABASE_URL: 'postgres://fixture.invalid/test' };
  const connect = () => ({ on: () => {}, connect: async () => {}, end: async () => { closed++; }, query: async (text, params) => {
    sql.push({ text, params }); return { rows };
  } });
  await checkVectorIndexReadiness({ readPilot: async () => passage }, new AbortController().signal, env, connect);
  assert.equal(sql[0].text, 'BEGIN READ ONLY'); assert.equal(sql[1].text, 'SET LOCAL ROLE authenticated');
  assert.deepEqual(sql[2].params, [passage.conceptId, env.KNOWLEDGE_EMBEDDING_MODEL, passage.subject, passage.language]);
  assert.doesNotMatch(sql[2].text, /User|LearningSession|Message|INSERT|UPDATE|DELETE/); assert.equal(closed, 1);
  await assert.rejects(checkVectorIndexReadiness({ readPilot: async () => passage }, new AbortController().signal, { ...env, OPENROUTER_API_KEY: '' },
    () => assert.fail('bad config before IO')));
});

test('index readiness abort closes the active client once and revoked review cannot return ready', async t => {
  const { passage, rows } = await fixture(t); let closes = 0, reads = 0;
  const env = { KNOWLEDGE_RETRIEVAL_MODE: 'vector', KNOWLEDGE_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    KNOWLEDGE_VECTOR_MIN_SIMILARITY: '0.8', OPENROUTER_API_KEY: 'offline-placeholder', DATABASE_URL: 'postgres://fixture.invalid/test' };
  const connect = () => ({ on: () => {}, connect: async () => {}, end: async () => { closes++; }, query: async () => ({ rows }) });
  await assert.rejects(checkVectorIndexReadiness({ readPilot: async () => ++reads === 1 ? passage : null }, new AbortController().signal, env, connect), /changed/);
  assert.equal(closes, 1);
  const activeAbort = new AbortController(); let rejectQuery;
  const stalled = () => ({ on: () => {}, connect: async () => {}, end: async () => { closes++; rejectQuery?.(Error('closed')); },
    query: async text => {
      if (!text.includes('FROM public.')) return { rows: [] };
      return new Promise((_resolve, reject) => { rejectQuery = reject; queueMicrotask(() => activeAbort.abort()); });
    } });
  await assert.rejects(checkVectorIndexReadiness({ readPilot: async () => passage }, activeAbort.signal, env, stalled));
  assert.equal(closes, 2); assert.equal(activeAbort.signal.aborted, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(checkVectorIndexReadiness({ readPilot: async () => passage }, controller.signal, env, () => assert.fail('no aborted connection')));
});
