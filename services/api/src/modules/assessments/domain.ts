import type { AssessmentPhase, AssessmentSnapshot, AssessmentTopic, scoreAssessment } from "./scoring.js";

export type GradedAnswer = ReturnType<typeof scoreAssessment>["answers"][number];
export interface AssessmentRecord {
  id: string;
  learningSessionId: string;
  phase: AssessmentPhase;
  topic: AssessmentTopic | null;
  snapshot: AssessmentSnapshot | null;
  score: number | null;
  maxScore: number | null;
  submittedAt: string | null;
  submissionHash: string | null;
}
export interface OwnedAssessmentSession {
  id: string;
  stage: string;
  lifecycleState: string;
  version: number;
}
export interface MasterySample {
  percent: number;
  assessmentId: string;
  sampleQuestions: number;
  assessedAt: string;
}
export interface LearningProfileDto {
  mastery: Partial<Record<AssessmentTopic, MasterySample>>;
  strengths: AssessmentTopic[];
  weakPoints: AssessmentTopic[];
  updatedAt: string | null;
}
export interface LearningProgressDto {
  sessionCount: number;
  completedSessionCount: number;
  averageProgressPercent: number;
  comparisons: Array<{ sessionId: string; topic: string; prePercent: number | null; postPercent: number | null; deltaPercent: number | null }>;
}

/** Production composition uses PrismaAssessmentStore, not an in-memory fallback. */
export interface AssessmentStore {
  getSession(sessionId: string): Promise<OwnedAssessmentSession | null>;
  getAssessment(sessionId: string, phase: AssessmentPhase): Promise<AssessmentRecord | null>;
  createAssessment(record: AssessmentRecord): Promise<boolean>;
  submitAssessment(record: AssessmentRecord, answers: GradedAnswer[], submissionHash: string, at: string): Promise<boolean>;
  getAnswers(assessmentId: string): Promise<GradedAnswer[]>;
  getLearningProfile(): Promise<LearningProfileDto | null>;
  getProgress(): Promise<LearningProgressDto>;
}
