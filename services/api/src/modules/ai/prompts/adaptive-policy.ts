import type { TutorContext } from "../tutor-context.js";

export interface AdaptiveTeachingPolicy {
  language: "th" | "en";
  mode: "ACKNOWLEDGE" | "SIMPLIFY" | "HINT" | "GUIDE" | "STANDARD";
}

/** Selects teaching instructions only. It cannot change stage/progress or repair output. */
export function selectAdaptivePolicy(context: Pick<TutorContext, "studentInput" | "previousMessages">): AdaptiveTeachingPolicy {
  const input = context.studentInput.normalize("NFKC").replace(/\u0e4d\u0e32/gu, "\u0e33").trim();
  const englishRequested = /(?:in english|ภาษาอังกฤษ)/iu.test(input);
  const thaiRequested = /(?:in thai|ภาษาไทย)/iu.test(input);
  const language = englishRequested ? "en" : thaiRequested || /[\u0e00-\u0e7f]/u.test(input) ? "th" : "en";
  let mode: AdaptiveTeachingPolicy["mode"] = "STANDARD";
  if (/^(?:thanks?(?:\s+you)?|thank you|ok(?:ay)?|ขอบคุณ(?:ครับ|ค่ะ|มาก)?|โอเค)[.!\s]*$/iu.test(input)) mode = "ACKNOWLEDGE";
  else if (/don't understand|do not understand|confused|simpler|ไม่เข้าใจ|งง|อธิบาย.*ง่าย/iu.test(input)) mode = "SIMPLIFY";
  else if (/\bhint\b|คำใบ้|ช่วยใบ้/iu.test(input)) mode = "HINT";
  else if (context.previousMessages.length && /(?:^|\s)(?:my answer|i think|is it|because)|คำตอบ|คิดว่า|เพราะ/iu.test(input)) mode = "GUIDE";
  return { language, mode };
}

export function adaptiveInstructions(policy: AdaptiveTeachingPolicy): string {
  const mode = {
    ACKNOWLEDGE: "Use one brief acknowledgement block. No exercise, recap or new question.",
    SIMPLIFY: "Simplify the specific step the learner struggled with. Use everyday words, one hint or short explanation and one check-understanding question. Do not repeat the same explanation or demand a full solution.",
    HINT: "Give one small hint toward the next step. Do not reveal the full solution or final numeric answer. Use the learner's actual problem from the current input/history.",
    GUIDE: "Respond to the learner's attempt and reasoning. Give brief feedback and one useful next question or hint. Do not repeat an already answered question or claim an assessment score.",
    STANDARD: "Follow the current stage. For a request to teach problem solving, guide the next step before disclosing a full solution unless the learner explicitly asks for it. Use current/history operands, not a source example's operands.",
  }[policy.mode];
  return `Current response language: ${policy.language === "th" ? "Thai" : "English"}. Write all teaching prose and block titles in this language; symbols and units may retain their notation.\nAdaptive teaching mode: ${policy.mode}. ${mode}\nFor HINT and SIMPLIFY, this instruction overrides the stage's full-solution instructions. Stage, progress and citation validation remain unchanged.`;
}
