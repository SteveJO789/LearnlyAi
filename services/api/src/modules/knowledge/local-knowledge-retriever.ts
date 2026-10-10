import type { KnowledgeQuery, KnowledgeRetriever, RetrievedKnowledge } from "./knowledge-retriever.js";
import type { ReviewedKnowledgeReader } from "./reviewed-knowledge-reader.js";
import { isNumericMathReply } from "./numeric-math-reply.js";

function matchesOhmsLaw(input: string): boolean {
  const text = input.normalize("NFKC").toLowerCase();
  if (/\bohms?(?:['’]s)?\b/u.test(text) || text.includes("กฎของโอห์ม")) return true;

  // Preserve word boundaries around the equation, including when it is in a sentence.
  if (/(?:^|[^a-z])(?:v\s*=\s*i\s*[×*·]?\s*r|v\s*=\s*r\s*[×*·]?\s*i|i\s*=\s*v\s*\/\s*r|r\s*=\s*v\s*\/\s*i)(?=$|[^a-z])/u.test(text)) return true;

  const voltage = /\bvoltage\b/u.test(text) || /ความต่างศักย์|แรงดันไฟฟ้า/u.test(text);
  const current = /\bcurrent\b/u.test(text) || text.includes("กระแสไฟฟ้า");
  const resistance = /\b(?:resistance|resistor)\b/u.test(text) || /ความต้านทาน|ตัวต้านทาน|ω/u.test(text);
  // Voltage/current alone do not establish this concept (e.g. batteries/transformers).
  return resistance && (current || voltage);
}

function acknowledgement(input: string): boolean {
  return /^(?:thanks?(?:\s+you)?|thank you|ok(?:ay)?|ขอบคุณ(?:ครับ|ค่ะ|มาก)?|โอเค)[.!\s]*$/iu.test(input.trim());
}

function followUp(input: string): boolean {
  const text = input.normalize("NFKC").replace(/\u0e4d\u0e32/gu, "\u0e33").toLowerCase().trim();
  // Short, referential questions/confusion only. A new explicit topic resets context.
  if (text.length > 250 || /transformer|battery|photosynthesis|antibiotic|project|หม้อแปลง|แบตเตอรี่|สังเคราะห์แสง/u.test(text)) return false;
  if (isNumericMathReply(input)) return true;
  return /^(?:what if|what about|how about|then|why|can you (?:explain|show|give)|i (?:don't|do not) understand|i(?:'m| am) confused|(?:a |another )?hint|explain (?:it|that)|make (?:it|that) simpler|ไม่เข้าใจ|ทำไม|ถ้า|ขอ(?:คำใบ้|ตัวอย่าง)|อธิบาย.*ง่าย)/u.test(text);
}

/** Reuse learner context only for an explicit short follow-up; never send tutor/system turns. */
export function knowledgeSearchText(query: KnowledgeQuery): string | null {
  if (typeof query.studentInput !== "string" || query.studentInput.length > 8000) {
    throw new RangeError("Knowledge studentInput must be a string of at most 8000 characters.");
  }
  const history = query.previousStudentInputs ?? [];
  if (!Array.isArray(history) || history.length > 4 || history.some(input => typeof input !== "string" || input.length > 8000)) {
    throw new RangeError("Knowledge history must contain at most four bounded learner turns.");
  }
  const current = query.studentInput.trim();
  if (!current || acknowledgement(current)) return null;
  if (followUp(current)) {
    for (const input of [...history].reverse()) {
      if (!input.trim() || acknowledgement(input) || followUp(input)) continue;
      const suffix = `\nFollow-up: ${current}`;
      return input.slice(0, 8000 - suffix.length) + suffix;
    }
  }
  return current;
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
    const history = query.previousStudentInputs ?? [];
    if (!Array.isArray(history) || history.length > 4 || history.some(input => typeof input !== "string" || input.length > 8000)) {
      throw new RangeError("Knowledge history must contain at most four bounded learner turns.");
    }
    if (acknowledgement(query.studentInput)) return Object.freeze([]);
    let matches = matchesOhmsLaw(query.studentInput);
    if (!matches && followUp(query.studentInput)) {
      for (const input of [...history].reverse()) {
        if (acknowledgement(input)) continue;
        if (matchesOhmsLaw(input)) { matches = true; break; }
        if (!followUp(input)) break;
      }
    }
    if (!matches) return Object.freeze([]);

    const reference = await this.reader.readPilot();
    return Object.freeze(reference ? [reference] : []);
  }
}
