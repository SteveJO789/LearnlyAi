import { createHash } from "node:crypto";
import type { RetrievedKnowledge } from "./knowledge-retriever.js";

export interface ReviewedChunk {
  readonly id: string;
  readonly passageId: string;
  readonly documentId: string;
  readonly documentVersion: string;
  readonly passageHash: string;
  readonly contentHash: string;
  readonly ordinal: number;
  readonly content: string;
  readonly subject: string;
  readonly language: string;
  readonly sourceIds: readonly string[];
  /** Curated Markdown has no PDF page; do not invent one. */
  readonly page: null;
}

export const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/** Only accepts reader-validated reviewed passages. Keeps complete paragraphs/formulas. */
export function chunkReviewedPassage(passage: RetrievedKnowledge, maxChars = 1800): readonly ReviewedChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 500 || maxChars > 4000) throw new RangeError("Invalid Knowledge chunk size.");
  if (passage.sourceType !== "TRUSTED_KNOWLEDGE_BASE" || !passage.sources.length || !passage.content.trim() || passage.content.length > 4000) {
    throw new Error("A bounded reviewed passage with provenance is required.");
  }
  // Preserve math (x², units, Thai marks); compatibility normalization changes symbols.
  const normalized = passage.content.normalize("NFC").replace(/\r\n?/gu, "\n").trim();
  const paragraphs = normalized.split(/\n[\t ]*\n/gu);
  const groups: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) throw new Error("Knowledge paragraph exceeds chunk limit; curate a complete smaller unit.");
    const joined = current ? `${current}\n\n${paragraph}` : paragraph;
    if (joined.length > maxChars) { groups.push(current); current = paragraph; }
    else current = joined;
  }
  if (current) groups.push(current);
  const passageHash = sha256(passage.content);
  const sourceIds = Object.freeze([...new Set(passage.sources.map(source => source.sourceId))].sort());
  return Object.freeze(groups.map((content, ordinal) => {
    const contentHash = sha256(content);
    return Object.freeze({ id: sha256(`${passage.passageId}\n${ordinal}\n${contentHash}`), passageId: passage.passageId,
      documentId: passage.conceptId, documentVersion: passage.conceptVersion, passageHash, contentHash,
      ordinal, content, subject: passage.subject, language: passage.language, sourceIds, page: null });
  }));
}
