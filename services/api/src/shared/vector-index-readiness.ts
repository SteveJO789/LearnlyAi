import { Client } from "pg";
import type { ReviewedKnowledgeReader } from "../modules/knowledge/reviewed-knowledge-reader.js";
import { loadKnowledgeRetrievalConfig } from "../modules/learning/create-persistent-knowledge-retriever.js";
import { assertReviewedIndexReady, type ReviewedIndexIdentity } from "../modules/knowledge/reviewed-index-readiness.js";
import { sha256 } from "../modules/knowledge/reviewed-chunks.js";

export const VECTOR_INDEX_READINESS_SQL = `SELECT id AS "chunkId", "passageId", "passageHash", "contentHash", "embeddingInputHash", "provenanceHash",
  dimensions, (extensions.vector_dims(embedding) = 1536 AND extensions.vector_norm(embedding) > 0) AS nonzero
  FROM public."KnowledgeChunk" WHERE "documentId" = $1 AND "embeddingModel" = $2
  AND subject = $3 AND language = $4 AND reviewed = true LIMIT 9`;

export async function checkVectorIndexReadiness(
  reader: ReviewedKnowledgeReader, signal: AbortSignal, env: NodeJS.ProcessEnv = process.env,
  connect: (url: string) => Pick<Client, "connect" | "query" | "end" | "on"> = url => new Client({
    connectionString: url, connectionTimeoutMillis: 1500, query_timeout: 1500, statement_timeout: 1200,
  }),
  expectedDatabase?: string,
): Promise<void> {
  const config = loadKnowledgeRetrievalConfig(env);
  if (config.mode !== "vector" || !env.DATABASE_URL) throw new Error("Vector index configuration is unavailable.");
  const passage = await reader.readPilot();
  if (!passage) throw new Error("Reviewed Knowledge is unavailable.");
  signal.throwIfAborted();
  const client = connect(env.DATABASE_URL);
  client.on("error", () => {});
  let closing: Promise<void> | undefined;
  const close = () => closing ??= client.end();
  const cancel = () => { void close().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await client.connect(); signal.throwIfAborted();
    // Read-only, fixed role, no claims or learner tables. End closes transaction even on failure.
    await client.query("BEGIN READ ONLY");
    if (expectedDatabase) {
      const database = await client.query<{ name: string }>("SELECT current_database() AS name");
      if (database.rows[0]?.name !== expectedDatabase) throw new Error("Vector preflight target database mismatch.");
    }
    await client.query("SET LOCAL ROLE authenticated");
    const result = await client.query<ReviewedIndexIdentity>(VECTOR_INDEX_READINESS_SQL,
      [passage.conceptId, config.model, passage.subject, passage.language]);
    signal.throwIfAborted();
    const current = await reader.readPilot();
    if (!current || sha256(JSON.stringify(current)) !== sha256(JSON.stringify(passage))) throw new Error("Reviewed Knowledge changed during index verification.");
    assertReviewedIndexReady(current, result.rows);
  } finally {
    signal.removeEventListener("abort", cancel);
    await close();
  }
}
