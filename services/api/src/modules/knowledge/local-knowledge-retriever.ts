import type { KnowledgeQuery, KnowledgeRetriever, RetrievedKnowledge } from "./knowledge-retriever.js";
import type { ReviewedKnowledgeReader } from "./reviewed-knowledge-reader.js";

function matchesOhmsLaw(input: string): boolean {
  const text = input.normalize("NFKC").toLowerCase();
  if (/\bohms?(?:['’]s)?\b/u.test(text) || text.includes("กฎของโอห์ม")) return true;

  // Preserve word boundaries around the equation, including when it is in a sentence.
  if (/(?:^|[^a-z])(?:v\s*=\s*i\s*[×*·]?\s*r|v\s*=\s*r\s*[×*·]?\s*i|i\s*=\s*v\s*\/\s*r|r\s*=\s*v\s*\/\s*i)(?=$|[^a-z])/u.test(text)) return true;

  const voltage = /\bvoltage\b/u.test(text) || /ความต่างศักย์|แรงดันไฟฟ้า/u.test(text);
  const current = /\bcurrent\b/u.test(text) || text.includes("กระแสไฟฟ้า");
  const resistance = /\bresistance\b/u.test(text) || text.includes("ความต้านทาน");
  const electrical = /\b(?:electric(?:al)?|circuit|ampere)\b/u.test(text);
  // "current project" and unrelated resistance are not electrical questions.
  return voltage || (current && resistance) || (electrical && (current || resistance));
}

/** One-concept lexical pilot; never falls back to the first available document. */
export class LocalKnowledgeRetriever implements KnowledgeRetriever {
  constructor(private readonly reader: ReviewedKnowledgeReader) {}

  async retrieve(query: KnowledgeQuery): Promise<ReadonlyArray<RetrievedKnowledge>> {
    if (typeof query.studentInput !== "string" || query.studentInput.length > 8000) {
      throw new RangeError("Knowledge studentInput must be a string of at most 8000 characters.");
    }
    if (query.subject !== undefined && query.subject.trim().toLowerCase() !== "physics") return Object.freeze([]);
    if (query.language !== undefined && query.language.trim().toLowerCase().split("-")[0] !== "th") return Object.freeze([]);
    if (!matchesOhmsLaw(query.studentInput)) return Object.freeze([]);

    const reference = await this.reader.readPilot();
    return Object.freeze(reference ? [reference] : []);
  }
}
