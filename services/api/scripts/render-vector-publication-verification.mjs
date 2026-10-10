// Render only: execute reviewed output in rollback-only empty fixtures, never production tables.
import { readFileSync, writeFileSync } from 'node:fs';
import { LocalReviewedKnowledgeReader } from '../dist/modules/knowledge/reviewed-knowledge-reader.js';
import { publishReviewedKnowledge } from '../dist/modules/knowledge/reviewed-vector-publication.js';
import { PrismaVectorPublication } from '../dist/prisma/prisma-vector-publication.js';
import { PrismaVectorSearch } from '../dist/prisma/prisma-vector-search.js';
import { reviewedChunkEmbeddingInput, chunkReviewedPassage } from '../dist/modules/knowledge/reviewed-chunks.js';
import { reviewedProvenanceHash } from '../dist/modules/knowledge/vector-knowledge-retriever.js';
import { fileURLToPath } from 'node:url';
const schema = 'learnly_vector_publication_verify';
const scopedName = '"' + schema + '"';
const ops = JSON.parse(readFileSync(new URL('../migrations/app/20261010T1750_reviewed_knowledge_vectors/ops.json', import.meta.url), 'utf8'));
const literal = value => value === null ? 'NULL' : typeof value === 'number' && Number.isFinite(value) ? String(value) :
  typeof value === 'boolean' ? String(value) : typeof value === 'string' ? "'" + value.replaceAll("'", "''") + "'" : (() => { throw Error('Unexpected SQL parameter'); })();
function scoped({ sql, params = [] }) {
  const result = sql.replaceAll('"public".', scopedName + '.').replaceAll('public.', scopedName + '.')
    .replace(/\$(\d+)/gu, (_, n) => {
      const value = params[Number(n) - 1];
      return literal(value === 'public' ? schema : typeof value === 'string' ? value.replaceAll('"public".', scopedName + '.').replaceAll('public.', scopedName + '.') : value);
    });
  if (/\bpublic\.|"public"\.|\b(?:CREATE|ALTER|DROP)\s+ROLE\b/iu.test(result)) throw Error('Unscoped SQL');
  return result;
}
const check = (sql, label) => `DO $assert$ BEGIN IF NOT COALESCE((${sql}), false) THEN RAISE EXCEPTION '${label}'; END IF; END $assert$;`;
const out = ['BEGIN;', `SET LOCAL statement_timeout = '20s';`, `DO $$ BEGIN IF to_regnamespace('${schema}') IS NOT NULL THEN RAISE EXCEPTION 'Fixture already exists'; END IF; END $$;`,
  `CREATE SCHEMA ${scopedName};`, `SET LOCAL search_path = ${scopedName},extensions,public;`];
let canonicalChecks = 0;
for (const op of ops) {
  for (const step of op.execute ?? []) out.push(scoped(step) + ';');
  for (const step of op.postcheck ?? []) { out.push(check(scoped(step), 'Canonical Knowledge migration postcondition failed')); canonicalChecks++; }
}
out.push(`GRANT USAGE ON SCHEMA ${scopedName} TO authenticated, anon;`);
const plans = [];
const client = { raw: { sql: (parts, ...params) => {
  const sql = parts.map((part, i) => part + (i < params.length ? '$' + (i + 1) : '')).join('');
  return { affectedCount: () => ({ build: () => ({ sql, params }) }), returnsRow: () => ({ build: () => ({ sql, params }) }) };
}}, transaction: async work => work({ execute: async plan => { plans.push(plan); return { affectedRows: 1 }; } }),
  query: plan => ({ toArray: async () => { plans.push(plan); return []; } }) };
const reader = new LocalReviewedKnowledgeReader(fileURLToPath(new URL('../runtime-knowledge/', import.meta.url)));
const cachePath = process.argv.find(arg => arg.startsWith('--embedding-cache='))?.slice(18);
let vector = [1, ...Array(1535).fill(0)], model = 'fixture/offline';
let embed = async inputs => inputs.map(() => vector);
if (cachePath) {
  const cache = JSON.parse(readFileSync(cachePath, 'utf8')), passage = await reader.readPilot();
  if (!passage || cache.completed !== true || cache.model !== 'openai/text-embedding-3-small' || cache.dimensions !== 1536 ||
    cache.passage?.provenanceHash !== reviewedProvenanceHash(passage)) throw Error('Cached reviewed embedding identity mismatch');
  const chunks = chunkReviewedPassage(passage), inputs = chunks.map(chunk => reviewedChunkEmbeddingInput(passage, chunk));
  if (cache.chunks?.length !== chunks.length || cache.chunkVectors?.length !== chunks.length || cache.embeddingInputs?.length !== inputs.length ||
    chunks.some((chunk, i) => cache.chunks[i].id !== chunk.id || cache.chunks[i].passageHash !== chunk.passageHash ||
      cache.chunks[i].documentVersion !== chunk.documentVersion || cache.embeddingInputs[i].hash !== inputs[i].hash || cache.embeddingInputs[i].text !== inputs[i].text)) {
    throw Error('Cached reviewed embedding input mismatch');
  }
  model = cache.model; vector = cache.chunkVectors[0];
  embed = async requested => {
    if (JSON.stringify(requested) !== JSON.stringify(inputs.map(input => input.text))) throw Error('Cached embedding request mismatch');
    return cache.chunkVectors;
  };
}
const result = await publishReviewedKnowledge(reader, { model, dimensions: 1536, embed }, new PrismaVectorPublication(client));
for (const plan of plans) out.push(scoped(plan) + ';');
out.push(check(`SELECT count(*) = ${result.chunks} FROM ${scopedName}."KnowledgeChunk"`, 'Publication row count failed'));
out.push(`INSERT INTO ${scopedName}."KnowledgeChunk" SELECT content,"contentHash",dimensions,"documentId","documentVersion",embedding,"embeddingInputHash","embeddingModel",repeat('f',64),language,ordinal,page,"passageHash","passageId","provenanceHash",false,sources,subject FROM ${scopedName}."KnowledgeChunk" LIMIT 1;`);
out.push(`DO $$ BEGIN
  BEGIN UPDATE ${scopedName}."KnowledgeChunk" SET dimensions = 3; RAISE EXCEPTION 'Wrong dimension was accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE ${scopedName}."KnowledgeChunk" SET "contentHash" = 'fake'; RAISE EXCEPTION 'Invalid hash was accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
END $$;`);
// Execute the actual publisher again: old rows (including the unreviewed fixture) are replaced atomically.
for (const plan of plans) out.push(scoped(plan) + ';');
out.push(check(`SELECT count(*) = ${result.chunks} FROM ${scopedName}."KnowledgeChunk"`, 'Idempotent document replacement failed'));
out.push(`INSERT INTO ${scopedName}."KnowledgeChunk" SELECT content,"contentHash",dimensions,"documentId","documentVersion",embedding,"embeddingInputHash","embeddingModel",repeat('f',64),language,ordinal,page,"passageHash","passageId","provenanceHash",false,sources,subject FROM ${scopedName}."KnowledgeChunk" LIMIT 1;`);
out.push('SET LOCAL ROLE authenticated;');
out.push(check(`SELECT count(*) = ${result.chunks} FROM ${scopedName}."KnowledgeChunk"`, 'Reviewed RLS read failed'));
const start = plans.length;
await new PrismaVectorSearch(client).search({ vector, model, dimensions: 1536, subject: 'physics', language: 'th', topK: 3, minSimilarity: .8 });
const search = scoped(plans[start]);
out.push(check(`SELECT count(*) = ${result.chunks} AND bool_and(abs(similarity - 1) < 0.00001) FROM (${search}) ranked`, 'Canonical vector search failed'));
out.push(`DO $$ BEGIN
  BEGIN UPDATE ${scopedName}."KnowledgeChunk" SET reviewed = true; RAISE EXCEPTION 'Student publication allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM ${scopedName}."KnowledgeChunk"; RAISE EXCEPTION 'Student deletion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;`);
out.push('RESET ROLE;', 'SET LOCAL ROLE anon;');
out.push(`DO $$ BEGIN BEGIN PERFORM id FROM ${scopedName}."KnowledgeChunk"; RAISE EXCEPTION 'Anonymous Knowledge read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;`);
out.push('RESET ROLE;', 'ROLLBACK;', `SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed, ${result.chunks} AS published_reviewed_chunks, ${canonicalChecks} AS canonical_checks, 'canonical migration + actual publisher SQL + vector search + RLS' AS scope;`);
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (!output) throw Error('An explicit scratch --output path is required.');
writeFileSync(output, out.join('\n'));
console.log(JSON.stringify({ output, schema, chunks: result.chunks, canonicalChecks, paidCalls: 0, publicTablesChanged: false,
  embeddingScope: cachePath ? 'reuse previously verified actual embedding; no fresh call or broad retrieval-quality proof' : 'synthetic vectors' }));
