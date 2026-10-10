import type { KnowledgeQuery, KnowledgeRetriever, RetrievedKnowledge } from "./knowledge-retriever.js";
import type { ReviewedKnowledgeReader } from "./reviewed-knowledge-reader.js";
import type { EmbeddingProvider } from "./embedding-port.js";
import { validateEmbedding } from "./embedding-port.js";
import { chunkReviewedPassage, reviewedChunkEmbeddingInput, sha256 } from "./reviewed-chunks.js";
import { knowledgeSearchText, matchesOhmsLaw } from "./local-knowledge-retriever.js";

export interface VectorCandidate {
  readonly chunkId: string;
  readonly passageId: string;
  readonly passageHash: string;
  readonly contentHash: string;
  readonly embeddingInputHash: string;
  readonly provenanceHash: string;
  readonly similarity: number;
}
export interface VectorSearch {
  readonly vector: readonly number[];
  readonly model: string;
  readonly dimensions: number;
  readonly subject: string;
  readonly language: string;
  readonly topK: number;
  readonly minSimilarity: number;
}
export interface ReviewedVectorSearchStore {
  search(query: VectorSearch): Promise<readonly VectorCandidate[]>;
}

/** Includes the exact reviewed source identities/URLs/licences, not just source IDs. */
export function reviewedProvenanceHash(passage: RetrievedKnowledge): string {
  return sha256(JSON.stringify({ conceptId: passage.conceptId, version: passage.conceptVersion,
    schema: passage.schemaVersion, passageId: passage.passageId,
    sources: [...passage.sources].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map(source =>
      ({ id: source.sourceId, title: source.title, url: source.url, license: source.license })) }));
}

/** Vector rows rank candidates; only the current reviewed reader can authorize teaching content. */
export class VectorKnowledgeRetriever implements KnowledgeRetriever {
  constructor(private readonly reader: ReviewedKnowledgeReader, private readonly embeddings: EmbeddingProvider,
    private readonly store: ReviewedVectorSearchStore, private readonly options: { topK: number; minSimilarity: number }) {
    if (!Number.isInteger(options.topK) || options.topK < 1 || options.topK > 8 || !Number.isFinite(options.minSimilarity) ||
      options.minSimilarity < 0 || options.minSimilarity > 1) throw new RangeError("Invalid vector retrieval limits.");
  }

  async retrieve(query: KnowledgeQuery): Promise<readonly RetrievedKnowledge[]> {
    const text = knowledgeSearchText(query);
    // Cosine similarity alone ranks adjacent electrical topics above short Thai
    // Ohm queries. The current one-concept corpus must abstain outside its intent.
    if (!text || !matchesOhmsLaw(text)) return Object.freeze([]);
    // The current curated reader exposes one pilot; do not pretend unreviewed subjects are supported.
    const initial = await this.reader.readPilot();
    if (!initial || (query.subject !== undefined && query.subject.trim().toLowerCase() !== initial.subject) ||
      (query.language !== undefined && query.language.trim().toLowerCase().split("-")[0] !== initial.language)) return Object.freeze([]);
    const vectors = await this.embeddings.embed([text]);
    if (vectors.length !== 1) throw new Error("Knowledge query embedding count is invalid.");
    const vector = validateEmbedding(vectors[0], this.embeddings.dimensions);
    const candidates = await this.store.search({ vector, model: this.embeddings.model, dimensions: this.embeddings.dimensions,
      subject: initial.subject, language: initial.language, ...this.options });
    if (!Array.isArray(candidates) || candidates.length > this.options.topK) throw new Error("Knowledge vector result exceeds limits.");
    // Re-read after external IO: a review revoked/changed during embedding/search cannot be trusted.
    const current = await this.reader.readPilot();
    if (!current || current.subject !== initial.subject || current.language !== initial.language) return Object.freeze([]);
    const provenanceHash = reviewedProvenanceHash(current);
    const chunks = new Map(chunkReviewedPassage(current).map(chunk => [chunk.id, chunk]));
    for (const candidate of candidates) {
      if (!candidate || !Number.isFinite(candidate.similarity) || candidate.similarity < this.options.minSimilarity || candidate.similarity > 1) continue;
      const chunk = chunks.get(candidate.chunkId);
      if (chunk && candidate.passageId === chunk.passageId && candidate.passageHash === chunk.passageHash &&
        candidate.contentHash === chunk.contentHash && candidate.embeddingInputHash === reviewedChunkEmbeddingInput(current, chunk).hash && candidate.provenanceHash === provenanceHash) {
        // Return the complete current passage/formulas and its exact citations, never DB-authored content.
        return Object.freeze([current]);
      }
    }
    return Object.freeze([]);
  }
}
