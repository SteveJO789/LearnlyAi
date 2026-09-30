import type { LearningStage } from "../learning/domain.js";
import type { ModelMessage } from "./providers/model-provider.js";
import type { Citation, TutorOutputStage, TutorProgress } from "./tutor-output.js";

export interface SourceMaterial {
  citation: Citation;
  content: string;
}

export interface TutorContext {
  sessionId: string;
  responseId: string;
  stage: LearningStage;
  outputStage: TutorOutputStage;
  progress: TutorProgress;
  studentInput: string;
  learningGoal?: string;
  subject?: string;
  previousMessages: readonly ModelMessage[];
  sourceMaterials: readonly SourceMaterial[];
}
