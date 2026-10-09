"use client";
import { authenticatedRequest } from "./learning-sessions";

export type AssessmentPhase = "PRE" | "POST" | "TRANSFER";
export type AssessmentTopic = "linear-equations" | "ohms-law";
export type AssessmentDto = {
  id: string; sessionId: string; phase: AssessmentPhase; topic: AssessmentTopic; language: "th" | "en";
  questions: Array<{ id: string; prompt: string; format: "NUMBER"; unit?: string }>;
  score: number | null; maxScore: number; submittedAt: string | null;
  answers?: Array<{ questionId: string; response: number; isCorrect: boolean; awardedScore: number }>;
};
export type LearningProfileDto = {
  mastery: Partial<Record<AssessmentTopic, { percent: number; assessmentId: string; sampleQuestions: number; assessedAt: string }>>;
  strengths: AssessmentTopic[]; weakPoints: AssessmentTopic[]; updatedAt: string | null;
};
export type LearningProgressDto = {
  sessionCount: number; completedSessionCount: number; averageProgressPercent: number;
  comparisons: Array<{ sessionId: string; topic: string; prePercent: number | null; postPercent: number | null; deltaPercent: number | null }>;
};
const path = (sessionId: string, phase: AssessmentPhase) => `/api/learning-sessions/${encodeURIComponent(sessionId)}/assessments/${phase}`;
function assessment(value: AssessmentDto): AssessmentDto {
  if (!value || typeof value.id !== "string" || !Array.isArray(value.questions) || !value.questions.length ||
    value.questions.some(question => typeof question.id !== "string" || typeof question.prompt !== "string" || question.format !== "NUMBER") ||
    !Number.isInteger(value.maxScore) || value.maxScore <= 0 ||
    (value.score !== null && (!Number.isInteger(value.score) || value.score < 0 || value.score > value.maxScore))) {
    throw new Error("Assessment API returned an invalid response.");
  }
  return value;
}
export async function getAssessment(sessionId: string, phase: AssessmentPhase, signal?: AbortSignal) {
  return assessment(await authenticatedRequest<AssessmentDto>(path(sessionId, phase), { signal }));
}
export async function createAssessment(sessionId: string, phase: AssessmentPhase, topic: AssessmentTopic, language: "th" | "en") {
  return assessment(await authenticatedRequest<AssessmentDto>(path(sessionId, phase), { method: "POST", body: JSON.stringify({ topic, language }) }));
}
export async function submitAssessment(sessionId: string, phase: AssessmentPhase, answers: Array<{ questionId: string; answer: number }>) {
  return assessment(await authenticatedRequest<AssessmentDto>(path(sessionId, phase) + "/submissions", { method: "POST", body: JSON.stringify({ answers }) }));
}
export async function getLearningProfile(signal?: AbortSignal) {
  const value = await authenticatedRequest<LearningProfileDto>("/api/users/me/learning-profile", { signal });
  const topic = (key: string) => key === "linear-equations" || key === "ohms-law";
  if (!value || !value.mastery || typeof value.mastery !== "object" || Array.isArray(value.mastery) ||
    !Array.isArray(value.strengths) || !Array.isArray(value.weakPoints) || [...value.strengths, ...value.weakPoints].some(key => !topic(key)) ||
    Object.entries(value.mastery).some(([key, sample]) => !topic(key) || !sample || !Number.isInteger(sample.percent) || sample.percent < 0 || sample.percent > 100 ||
      typeof sample.assessmentId !== "string" || !Number.isInteger(sample.sampleQuestions) || sample.sampleQuestions <= 0 || typeof sample.assessedAt !== "string")) {
    throw new Error("Learning profile API returned an invalid response.");
  }
  return value;
}
export async function getLearningProgress(signal?: AbortSignal) {
  const value = await authenticatedRequest<LearningProgressDto>("/api/users/me/progress", { signal });
  const percent = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 100);
  if (!value || !Number.isInteger(value.sessionCount) || value.sessionCount < 0 || !Number.isInteger(value.completedSessionCount) ||
    value.completedSessionCount < 0 || value.completedSessionCount > value.sessionCount || !percent(value.averageProgressPercent) ||
    !Array.isArray(value.comparisons) || value.comparisons.some(pair => typeof pair.sessionId !== "string" || typeof pair.topic !== "string" ||
      !percent(pair.prePercent) || !percent(pair.postPercent) || (pair.deltaPercent !== null && (!Number.isInteger(pair.deltaPercent) || Math.abs(pair.deltaPercent) > 100)))) {
    throw new Error("Learning progress API returned an invalid response.");
  }
  return value;
}
