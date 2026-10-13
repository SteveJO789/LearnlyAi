import type { EmbeddingProvider } from "./embedding-port.js";
import { validateEmbedding } from "./embedding-port.js";
import type { RetrievedKnowledge } from "./knowledge-retriever.js";
import { chunkReviewedPassage, reviewedChunkEmbeddingInput, sha256 } from "./reviewed-chunks.js";
import { reviewedProvenanceHash } from "./vector-knowledge-retriever.js";

export interface PreparedReviewedVectors {
  readonly schemaVersion: 1;
  readonly documentId: string;
  readonly documentVersion: string;
  readonly passageHash: string;
  readonly provenanceHash: string;
  readonly model: "openai/text-embedding-3-small";
  readonly dimensions: 1536;
  readonly chunks: readonly { readonly id: string; readonly embeddingInputHash: string; readonly embedding: readonly number[] }[];
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const invalid = () => new Error("Prepared reviewed embeddings are invalid or stale.");

/** Validates identity/shape, not a cryptographic provider attestation or retrieval quality. */
export function validatePreparedReviewedVectors(value: unknown, passage: RetrievedKnowledge): PreparedReviewedVectors {
  const expected = chunkReviewedPassage(passage);
  if (!record(value) || Object.keys(value).sort().join(",") !== "chunks,dimensions,documentId,documentVersion,model,passageHash,provenanceHash,schemaVersion" ||
    value.schemaVersion !== 1 || value.documentId !== passage.conceptId || value.documentVersion !== passage.conceptVersion ||
    value.passageHash !== sha256(passage.content) || value.provenanceHash !== reviewedProvenanceHash(passage) ||
    value.model !== "openai/text-embedding-3-small" || value.dimensions !== 1536 ||
    !Array.isArray(value.chunks) || value.chunks.length !== expected.length || expected.length < 1 || expected.length > 8) throw invalid();
  const chunks = value.chunks.map((entry: unknown, i) => {
    const chunk = expected[i]!;
    if (!record(entry) || Object.keys(entry).sort().join(",") !== "embedding,embeddingInputHash,id" ||
      entry.id !== chunk.id || entry.embeddingInputHash !== reviewedChunkEmbeddingInput(passage, chunk).hash) throw invalid();
    return Object.freeze({ id: chunk.id, embeddingInputHash: entry.embeddingInputHash as string,
      embedding: validateEmbedding(entry.embedding, 1536) });
  });
  return Object.freeze({ schemaVersion: 1, documentId: passage.conceptId, documentVersion: passage.conceptVersion,
    passageHash: value.passageHash as string, provenanceHash: value.provenanceHash as string,
    model: value.model, dimensions: 1536, chunks: Object.freeze(chunks) });
}

/** Imports the existing budgeted evaluation report without another paid request. */
export function prepareReviewedVectorsFromReport(value: unknown, passage: RetrievedKnowledge): PreparedReviewedVectors {
  const chunks = chunkReviewedPassage(passage);
  if (!record(value) || value.completed !== true || !record(value.passage) || value.passage.id !== passage.passageId ||
    value.passage.conceptId !== passage.conceptId || value.passage.version !== passage.conceptVersion ||
    value.passage.provenanceHash !== reviewedProvenanceHash(passage) || !Array.isArray(value.chunks) ||
    !Array.isArray(value.embeddingInputs) || !Array.isArray(value.chunkVectors) ||
    value.chunks.length !== chunks.length || value.embeddingInputs.length !== chunks.length || value.chunkVectors.length !== chunks.length) throw invalid();
  const prepared = chunks.map((chunk, i) => {
    const stored = (value.chunks as unknown[])[i], input = (value.embeddingInputs as unknown[])[i];
    const currentInput = reviewedChunkEmbeddingInput(passage, chunk);
    if (!record(stored) || !record(input) || stored.id !== chunk.id || stored.passageHash !== chunk.passageHash ||
      stored.contentHash !== chunk.contentHash || stored.documentVersion !== chunk.documentVersion ||
      input.hash !== currentInput.hash || input.text !== currentInput.text) throw invalid();
    return { id: chunk.id, embeddingInputHash: currentInput.hash, embedding: (value.chunkVectors as unknown[])[i] };
  });
  return validatePreparedReviewedVectors({ schemaVersion: 1, documentId: passage.conceptId, documentVersion: passage.conceptVersion,
    passageHash: sha256(passage.content), provenanceHash: reviewedProvenanceHash(passage), model: value.model,
    dimensions: value.dimensions, chunks: prepared }, passage);
}

export function preparedReviewedEmbeddingProvider(index: PreparedReviewedVectors): EmbeddingProvider {
  return { model: index.model, dimensions: index.dimensions, embed: async inputs => {
    if (inputs.length !== index.chunks.length || inputs.some((text, i) => sha256(text) !== index.chunks[i]!.embeddingInputHash)) throw invalid();
    return Object.freeze(index.chunks.map(chunk => chunk.embedding));
  } };
}
