import type { RetrievedKnowledge } from "./knowledge-retriever.js";
import { chunkReviewedPassage, reviewedChunkEmbeddingInput } from "./reviewed-chunks.js";
import { reviewedProvenanceHash } from "./vector-knowledge-retriever.js";

export interface ReviewedIndexIdentity {
  readonly chunkId: string;
  readonly passageId: string;
  readonly passageHash: string;
  readonly contentHash: string;
  readonly embeddingInputHash: string;
  readonly provenanceHash: string;
  readonly dimensions: number;
  readonly nonzero: boolean;
}

/** Index coverage/identity only: not relevance calibration or provider availability. */
export function assertReviewedIndexReady(passage: RetrievedKnowledge, rows: readonly ReviewedIndexIdentity[]): void {
  const chunks = chunkReviewedPassage(passage);
  if (!Array.isArray(rows) || rows.length !== chunks.length || new Set(rows.map(row => row?.chunkId)).size !== rows.length) {
    throw new Error("Reviewed vector index is incomplete.");
  }
  const expected = new Map(chunks.map(chunk => [chunk.id, chunk]));
  for (const row of rows) {
    const chunk = expected.get(row?.chunkId);
    if (!chunk || row.dimensions !== 1536 || row.nonzero !== true || row.passageId !== chunk.passageId ||
      row.passageHash !== chunk.passageHash || row.contentHash !== chunk.contentHash ||
      row.embeddingInputHash !== reviewedChunkEmbeddingInput(passage, chunk).hash ||
      row.provenanceHash !== reviewedProvenanceHash(passage)) throw new Error("Reviewed vector index is stale or invalid.");
  }
}
