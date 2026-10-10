import type { EmbeddingProvider } from "./embedding-port.js";
import { validateEmbedding } from "./embedding-port.js";
import type { RetrievedKnowledge } from "./knowledge-retriever.js";
import type { ReviewedKnowledgeReader } from "./reviewed-knowledge-reader.js";
import { chunkReviewedPassage, reviewedChunkEmbeddingInput, sha256, type ReviewedChunk } from "./reviewed-chunks.js";
import { reviewedProvenanceHash } from "./vector-knowledge-retriever.js";

export interface ReviewedVectorRow extends ReviewedChunk {
  readonly embeddingInputHash: string;
  readonly provenanceHash: string;
  readonly sources: RetrievedKnowledge["sources"];
  readonly embeddingModel: string;
  readonly dimensions: 1536;
  readonly embedding: readonly number[];
  readonly reviewed: true;
}
export interface ReviewedVectorPublisher {
  /** Atomically replaces one curated document. Never accepts learner-authored material. */
  replace(documentId: string, rows: readonly ReviewedVectorRow[]): Promise<void>;
}
function identity(passage: RetrievedKnowledge): string {
  return sha256(JSON.stringify({ passage, provenance: reviewedProvenanceHash(passage) }));
}

/** Operator-only composition; no HTTP endpoint and no automatic paid embedding call. */
export async function publishReviewedKnowledge(
  reader: ReviewedKnowledgeReader, embeddings: EmbeddingProvider, publisher: ReviewedVectorPublisher,
): Promise<{ documentId: string; chunks: number; model: string }> {
  if (embeddings.dimensions !== 1536 || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(embeddings.model)) {
    throw new Error("Canonical Knowledge embeddings require a named 1536-dimensional model.");
  }
  const passage = await reader.readPilot();
  if (!passage) throw new Error("Reviewed Knowledge is unavailable; publication was not changed.");
  const chunks = chunkReviewedPassage(passage);
  const inputs = chunks.map(chunk => reviewedChunkEmbeddingInput(passage, chunk));
  const vectors = await embeddings.embed(inputs.map(input => input.text));
  if (!Array.isArray(vectors) || vectors.length !== chunks.length) throw new Error("Knowledge embedding count is invalid.");
  const rows = chunks.map((chunk, i): ReviewedVectorRow => Object.freeze({ ...chunk,
    embeddingInputHash: inputs[i]!.hash, provenanceHash: reviewedProvenanceHash(passage), sources: passage.sources,
    embeddingModel: embeddings.model, dimensions: 1536, embedding: validateEmbedding(vectors[i], 1536), reviewed: true,
  }));
  // Review/source changes during the external request must never publish the old document.
  const current = await reader.readPilot();
  if (!current || identity(current) !== identity(passage)) throw new Error("Reviewed Knowledge changed during embedding; publication was not changed.");
  await publisher.replace(passage.conceptId, Object.freeze(rows));
  return { documentId: passage.conceptId, chunks: rows.length, model: embeddings.model };
}
