import type { LearningStage } from "../learning/domain.js";
import type { ModelMessage } from "./providers/model-provider.js";
import type { Citation, TutorOutputStage, TutorProgress } from "./tutor-output.js";
import type { KnowledgeSource } from "../knowledge/knowledge-retriever.js";

export interface SourceMaterial {
  citation: Citation;
  content: string;
  // Identity/provenance are data, separate from the passage's teaching text.
  readonly knowledge?: {
    readonly conceptId: string;
    readonly conceptVersion: string;
    readonly schemaVersion: string;
    readonly passageId: string;
    readonly language: string;
    readonly sources: ReadonlyArray<KnowledgeSource>;
  };
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
