import type { SourceMaterial } from "../ai/tutor-context.js";
import type { RetrievedKnowledge } from "../knowledge/knowledge-retriever.js";

const MAX_REFERENCES = 3;
const MAX_PASSAGE_CHARS = 4000;

function bounded(value: string, limit: number): boolean {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

/** Application context budget applies to every retriever implementation. */
export function knowledgeSourceMaterials(references: ReadonlyArray<RetrievedKnowledge>): ReadonlyArray<SourceMaterial> {
  if (references.length > MAX_REFERENCES) throw new Error("Knowledge context exceeds its reference budget.");
  const ids = new Set<string>();
  return Object.freeze(references.map((reference) => {
    if (reference.sourceType !== "TRUSTED_KNOWLEDGE_BASE" || !bounded(reference.content, MAX_PASSAGE_CHARS)
      || !bounded(reference.passageId, 256) || ids.has(reference.passageId)
      || !bounded(reference.title, 200) || !bounded(reference.conceptId, 200)
      || !bounded(reference.conceptVersion, 32) || !bounded(reference.schemaVersion, 32)
      || !bounded(reference.language, 32) || reference.sources.length === 0 || reference.sources.length > 4) {
      throw new Error("Retrieved Knowledge violates the application context contract.");
    }
    ids.add(reference.passageId);
    const sources = Object.freeze(reference.sources.map((source) => {
      if (!bounded(source.sourceId, 200) || !bounded(source.title, 200)
        || !bounded(source.url, 2048) || !bounded(source.license, 512)) {
        throw new Error("Retrieved Knowledge source metadata exceeds its context budget.");
      }
      const url = new URL(source.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Retrieved Knowledge source URL must be public HTTP(S).");
      }
      return Object.freeze({ sourceId: source.sourceId, title: source.title, url: source.url, license: source.license });
    }));
    return Object.freeze({
      citation: Object.freeze({ id: reference.passageId, title: reference.title, sourceType: reference.sourceType }),
      content: reference.content,
      knowledge: Object.freeze({
        conceptId: reference.conceptId, conceptVersion: reference.conceptVersion,
        schemaVersion: reference.schemaVersion, passageId: reference.passageId,
        language: reference.language, sources,
      }),
    });
  }));
}
