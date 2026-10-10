import { fileURLToPath } from "node:url";
import type { UserDb } from "../../prisma/db.js";
import { PrismaVectorSearch } from "../../prisma/prisma-vector-search.js";
import { OpenRouterEmbeddingProvider } from "../ai/providers/openrouter-embedding-provider.js";
import type { KnowledgeRetriever } from "../knowledge/knowledge-retriever.js";
import { LocalKnowledgeRetriever } from "../knowledge/local-knowledge-retriever.js";
import { LocalReviewedKnowledgeReader } from "../knowledge/reviewed-knowledge-reader.js";
import { VectorKnowledgeRetriever } from "../knowledge/vector-knowledge-retriever.js";

/** Authenticated persistent route composition. No connection, embedding call or publication at construction. */
export function createPersistentKnowledgeRetriever(
  client: UserDb, knowledgeRoot?: string, env: NodeJS.ProcessEnv = process.env,
): KnowledgeRetriever {
  const reader = new LocalReviewedKnowledgeReader(knowledgeRoot ?? env.KNOWLEDGE_ROOT ??
    fileURLToPath(new URL("../../../runtime-knowledge/", import.meta.url)));
  const mode = env.KNOWLEDGE_RETRIEVAL_MODE ?? "lexical";
  if (mode === "lexical") return new LocalKnowledgeRetriever(reader);
  if (mode !== "vector") throw new Error("Knowledge retrieval configuration is invalid.");
  const threshold = env.KNOWLEDGE_VECTOR_MIN_SIMILARITY;
  const topK = env.KNOWLEDGE_VECTOR_TOP_K ?? "3";
  const model = env.KNOWLEDGE_EMBEDDING_MODEL;
  if (!threshold || !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/u.test(threshold) || !/^[1-8]$/u.test(topK) ||
    model !== "openai/text-embedding-3-small" || !env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("Vector Knowledge requires an explicit threshold, supported model and provider key.");
  }
  return new VectorKnowledgeRetriever(reader, new OpenRouterEmbeddingProvider({
    apiKey: env.OPENROUTER_API_KEY, model, dimensions: 1536, timeoutMs: 15000,
  }), new PrismaVectorSearch(client), { topK: Number(topK), minSimilarity: Number(threshold) });
}
