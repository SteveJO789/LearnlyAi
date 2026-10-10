import type { UserDb } from "./db.js";
import { validateEmbedding } from "../modules/knowledge/embedding-port.js";
import type { ReviewedVectorSearchStore, VectorSearch } from "../modules/knowledge/vector-knowledge-retriever.js";

/** Read through JWT-bound Prisma/RLS. Requires the canonical KnowledgeChunk migration before wiring. */
export class PrismaVectorSearch implements ReviewedVectorSearchStore {
  constructor(private readonly client: UserDb) {}
  async search(query: VectorSearch) {
    if (!Number.isInteger(query.dimensions) || query.dimensions < 1 || query.dimensions > 2000 ||
      !Number.isInteger(query.topK) || query.topK < 1 || query.topK > 8 || !Number.isFinite(query.minSimilarity) ||
      query.minSimilarity < 0 || query.minSimilarity > 1 || typeof query.model !== "string" || !query.model.trim() || query.model.length > 200 ||
      typeof query.subject !== "string" || !query.subject || query.subject.length > 100 ||
      typeof query.language !== "string" || !query.language || query.language.length > 20) throw new RangeError("Invalid vector search configuration.");
    const vector = JSON.stringify(validateEmbedding(query.vector, query.dimensions));
    // Qualify pgvector's operator: do not rely on an application/connection search_path.
    // Cast the parameter, never interpolate SQL literals or an identifier from student input.
    const plan = this.client.raw.sql`SELECT "id" AS "chunkId", "passageId", "passageHash", "contentHash", "provenanceHash",
      (1 - ("embedding" OPERATOR(extensions.<=>) ${vector}::extensions.vector))::float8 AS "similarity"
      FROM public."KnowledgeChunk"
      WHERE "embeddingModel" = ${query.model} AND "dimensions" = ${query.dimensions}
        AND "subject" = ${query.subject} AND "language" = ${query.language}
        AND (1 - ("embedding" OPERATOR(extensions.<=>) ${vector}::extensions.vector)) >= ${query.minSimilarity}
      ORDER BY "embedding" OPERATOR(extensions.<=>) ${vector}::extensions.vector, "id"
      LIMIT ${query.topK}`.returnsRow({ chunkId: "pg/text@1", passageId: "pg/text@1", passageHash: "pg/text@1",
        contentHash: "pg/text@1", provenanceHash: "pg/text@1", similarity: "pg/float8@1" }).build();
    return this.client.query(plan).toArray();
  }
}
