import type { TutorProgress, ValidatedTutorOutput } from "../ai/tutor-output.js";

export type SessionState = "ACTIVE" | "COMPLETED" | "FAILED";
export type LearningStage = "DIAGNOSE" | "EXPLAIN" | "PRACTICE" | "ASSESS" | "REVIEW";

export interface LearningRequest {
  sessionId: string;
  userInput: string;
  learningGoal?: string;
  subject?: string;
  action?: "RESPOND" | "ADVANCE";
}

// Reuse the canonical output, including schemaVersion and progress; no new envelope.
export type LearningResult = ValidatedTutorOutput;

export interface LearningEngine {
  process(request: LearningRequest): Promise<LearningResult>;
}

export interface LearningSession {
  id: string;
  state: SessionState;
  stage: LearningStage;
  learningGoal?: string;
  subject?: string;
  progress: TutorProgress;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type LearningMessage = {
  id: string;
  sessionId: string;
  createdAt: string;
} & (
  | { role: "USER"; content: string }
  | { role: "TUTOR"; content: ValidatedTutorOutput }
);
