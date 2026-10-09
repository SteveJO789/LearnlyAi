import { createHash } from "node:crypto";
import { LearningError } from "../learning/learning-errors.js";

export type AssessmentTopic = "linear-equations" | "ohms-law";
export type AssessmentPhase = "PRE" | "POST" | "TRANSFER";
export type AssessmentLanguage = "th" | "en";
export interface AssessmentQuestion {
  id: string;
  prompt: string;
  format: "NUMBER";
  unit?: "V" | "A" | "Ω";
  /** Stored server-created operands, not a client-supplied grading key. */
  rule: { kind: "LINEAR" | "VOLTAGE" | "CURRENT" | "RESISTANCE"; left: number; right: number; target?: number };
}
export interface AssessmentSnapshot {
  version: "1.0";
  topic: AssessmentTopic;
  language: AssessmentLanguage;
  questions: AssessmentQuestion[];
}

/** Original generated exercises; never represented as human-reviewed Knowledge sources. */
export function createAssessmentSnapshot(
  assessmentId: string, topic: AssessmentTopic, phase: AssessmentPhase, language: AssessmentLanguage,
): AssessmentSnapshot {
  const seed = createHash("sha256").update(`${assessmentId}:${topic}:${phase}:v1`).digest();
  const questions = Array.from({ length: 3 }, (_, index): AssessmentQuestion => {
    const left = 2 + seed[index * 2]! % 8;
    const right = 2 + seed[index * 2 + 1]! % 10;
    const id = `${topic}:v1:${phase}:${index + 1}`;
    if (topic === "linear-equations") {
      const solution = 1 + seed[index + 9]! % 9;
      const target = left * solution + right;
      return { id, format: "NUMBER", rule: { kind: "LINEAR", left, right, target },
        prompt: language === "th" ? `แก้สมการ ${left}x + ${right} = ${target} จงหาค่า x` : `Solve ${left}x + ${right} = ${target} for x.` };
    }
    const common = language === "th" ? "ตัวต้านทานเป็นโอห์มมิกและอุณหภูมิคงที่" : "For an ohmic resistor at constant temperature";
    if (index === 0) return { id, format: "NUMBER", unit: "V", rule: { kind: "VOLTAGE", left, right },
      prompt: language === "th" ? `${common}: กระแส ${left} A ความต้านทาน ${right} Ω จงหาแรงดัน (V)` : `${common}: current ${left} A, resistance ${right} Ω. Find voltage (V).` };
    if (index === 1) return { id, format: "NUMBER", unit: "A", rule: { kind: "CURRENT", left: left * right, right },
      prompt: language === "th" ? `${common}: แรงดัน ${left * right} V ความต้านทาน ${right} Ω จงหากระแส (A)` : `${common}: voltage ${left * right} V, resistance ${right} Ω. Find current (A).` };
    return { id, format: "NUMBER", unit: "Ω", rule: { kind: "RESISTANCE", left: left * right, right: left },
      prompt: language === "th" ? `${common}: แรงดัน ${left * right} V กระแส ${left} A จงหาความต้านทาน (Ω)` : `${common}: voltage ${left * right} V, current ${left} A. Find resistance (Ω).` };
  });
  return { version: "1.0", topic, language, questions };
}

export function publicAssessmentQuestions(snapshot: AssessmentSnapshot) {
  return snapshot.questions.map(({ rule: _rule, ...question }) => question);
}

function invalid(path: string): never {
  throw new LearningError("VALIDATION_ERROR", [{ path, message: "Submit one finite numeric answer for each issued question." }]);
}

/** Exact integer scoring for these generated exercises. No model call or model score. */
export function scoreAssessment(snapshot: AssessmentSnapshot, input: unknown) {
  if (!Array.isArray(input) || input.length !== snapshot.questions.length) invalid("/answers");
  const answers = new Map<string, number>();
  for (const [index, item] of input.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item) ||
      Object.keys(item).some(key => !["questionId", "answer"].includes(key)) ||
      typeof item.questionId !== "string" || typeof item.answer !== "number" ||
      !Number.isFinite(item.answer) || Math.abs(item.answer) > 1e9 || answers.has(item.questionId) ||
      !snapshot.questions.some(question => question.id === item.questionId)) invalid(`/answers/${index}`);
    answers.set(item.questionId, item.answer);
  }
  const graded = snapshot.questions.map(question => {
    const { kind, left, right, target } = question.rule;
    const expected = kind === "LINEAR" ? (target! - right) / left : kind === "VOLTAGE" ? left * right : left / right;
    const response = answers.get(question.id)!;
    const isCorrect = response === expected;
    return { questionId: question.id, response, isCorrect, awardedScore: isCorrect ? 1 : 0 };
  });
  return { score: graded.reduce((sum, answer) => sum + answer.awardedScore, 0), maxScore: graded.length, answers: graded };
}
