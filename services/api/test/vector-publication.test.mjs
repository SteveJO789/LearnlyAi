import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publishReviewedKnowledge } from '../dist/modules/knowledge/reviewed-vector-publication.js';
import { PrismaVectorPublication } from '../dist/prisma/prisma-vector-publication.js';
import { createKnowledgeHarness } from './knowledge-test-helpers.mjs';
import { createPersistentKnowledgeRetriever } from '../dist/modules/learning/create-persistent-knowledge-retriever.js';
import { LocalKnowledgeRetriever } from '../dist/modules/knowledge/local-knowledge-retriever.js';
import { VectorKnowledgeRetriever } from '../dist/modules/knowledge/vector-knowledge-retriever.js';
const vector = () => [1, ...Array(1535).fill(0)];
const embedding = { model: 'fixture/offline', dimensions: 1536, embed: async inputs => inputs.map(vector) };

test('reviewed publication uses exact source metadata, complete chunk text and 1536-dimensional vectors', async t => {
  const harness = createKnowledgeHarness(t), passage = (await harness.retriever.retrieve({ studentInput: 'Ohm' }))[0];
  let stored, inputs;
  const result = await publishReviewedKnowledge({ readPilot: async () => passage },
    { ...embedding, embed: async values => { inputs = values; return values.map(vector); } },
    { replace: async (id, rows) => { stored = { id, rows }; } });
  assert.equal(result.documentId, passage.conceptId); assert.equal(result.chunks, stored.rows.length);
  assert.ok(inputs.every(input => input.includes(passage.title)));
  for (const row of stored.rows) {
    assert.deepEqual(row.sources, passage.sources); assert.equal(row.page, null);
    assert.equal(row.reviewed, true); assert.equal(row.dimensions, 1536); assert.equal(row.embedding.length, 1536);
    assert.match(row.embeddingInputHash, /^[a-f0-9]{64}$/); assert.match(row.provenanceHash, /^[a-f0-9]{64}$/);
  }
});

test('unreviewed, revoked or changed source and malformed embeddings never publish or replace an existing index', async t => {
  const harness = createKnowledgeHarness(t), passage = (await harness.retriever.retrieve({ studentInput: 'Ohm' }))[0];
  const publisher = { replace: async () => assert.fail('must leave existing index unchanged') };
  await assert.rejects(publishReviewedKnowledge({ readPilot: async () => null },
    { ...embedding, embed: async () => assert.fail('must not embed') }, publisher), /unavailable/);
  for (const current of [null, { ...passage, title: passage.title + ' revised' },
    { ...passage, sources: passage.sources.map(source => ({ ...source, url: 'https://wrong.invalid/' })) }]) {
    let reads = 0;
    await assert.rejects(publishReviewedKnowledge({ readPilot: async () => ++reads === 1 ? passage : current }, embedding, publisher), /changed/);
  }
  for (const invalid of [[], [[0, 0]], [Array(1536).fill(0)], [[NaN, ...Array(1535).fill(0)]]]) {
    await assert.rejects(publishReviewedKnowledge({ readPilot: async () => passage }, { ...embedding, embed: async () => invalid }, publisher));
  }
  await assert.rejects(publishReviewedKnowledge({ readPilot: async () => passage }, { ...embedding, dimensions: 3 }, publisher), /1536/);
});

test('Prisma publisher binds content/source/vector and performs scoped replacement inside one serialized transaction', async t => {
  const harness = createKnowledgeHarness(t), passage = (await harness.retriever.retrieve({ studentInput: 'Ohm' }))[0];
  const plans = []; let transactions = 0;
  const client = { raw: { sql: (strings, ...values) => ({ affectedCount: () => ({ build: () => ({ sql: strings.join('?'), values }) }) }) },
    transaction: async work => { transactions++; return work({ execute: async plan => { plans.push(plan); return { affectedRows: 1 }; } }); } };
  const publisher = new PrismaVectorPublication(client);
  await publishReviewedKnowledge({ readPilot: async () => passage }, embedding, publisher);
  assert.equal(transactions, 1);
  assert.ok(plans[2].sql.includes('pg_advisory_xact_lock'));
  assert.ok(plans[3].sql.includes('DELETE')); assert.deepEqual(plans[3].values, [passage.conceptId]);
  const inserts = plans.filter(plan => plan.sql.startsWith('INSERT'));
  assert.ok(inserts.length > 0);
  assert.ok(inserts.every(plan => plan.sql.includes('::extensions.vector') && !plan.sql.includes(passage.content)));
  assert.ok(inserts[0].values.includes(JSON.stringify(passage.sources)));
  await assert.rejects(publisher.replace(passage.conceptId, [])); assert.equal(transactions, 1);
});

test('publication failure propagates for transaction rollback; no retry or lexical substitution', async t => {
  const harness = createKnowledgeHarness(t), passage = (await harness.retriever.retrieve({ studentInput: 'Ohm' }))[0];
  let attempts = 0;
  await assert.rejects(publishReviewedKnowledge({ readPilot: async () => passage }, embedding,
    { replace: async () => { attempts++; throw new Error('database failure'); } }), /database failure/);
  assert.equal(attempts, 1);
});

test('persistent route composition stays lexical by default and requires explicit bounded vector configuration', () => {
  const client = new Proxy({}, { get: () => assert.fail('construction must not connect to DB') });
  assert.ok(createPersistentKnowledgeRetriever(client, undefined, {}) instanceof LocalKnowledgeRetriever);
  const good = { KNOWLEDGE_RETRIEVAL_MODE: 'vector', KNOWLEDGE_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
    KNOWLEDGE_VECTOR_MIN_SIMILARITY: '0.8', KNOWLEDGE_VECTOR_TOP_K: '3', OPENROUTER_API_KEY: 'offline-fixture' };
  assert.ok(createPersistentKnowledgeRetriever(client, undefined, good) instanceof VectorKnowledgeRetriever);
  for (const invalid of [{ KNOWLEDGE_RETRIEVAL_MODE: 'mock-vector' }, { KNOWLEDGE_VECTOR_MIN_SIMILARITY: undefined },
    { KNOWLEDGE_VECTOR_MIN_SIMILARITY: '1.01' }, { KNOWLEDGE_VECTOR_MIN_SIMILARITY: 'NaN' }, { KNOWLEDGE_VECTOR_TOP_K: '9' },
    { KNOWLEDGE_EMBEDDING_MODEL: 'unknown/other' }, { OPENROUTER_API_KEY: '' }]) {
    assert.throws(() => createPersistentKnowledgeRetriever(client, undefined, { ...good, ...invalid }), /configuration|requires/);
  }
});
