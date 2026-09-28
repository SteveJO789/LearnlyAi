// TypeScript view of contracts/learning-output.schema.json v1.0.
// Runtime acceptance always belongs to validateTutorOutput(), including ID rules.
export type TutorOutputStage =
  | "CONTENT_ANALYSIS"
  | "PRE_TEST"
  | "LEARNING"
  | "TRANSFER"
  | "POST_TEST"
  | "COMPLETED";

export interface TutorProgress {
  percent: number;
  canAdvance: boolean;
  nextAction?: "ANSWER" | "REQUEST_HINT" | "SUBMIT_ASSESSMENT" | "CONTINUE" | null;
}

export interface Citation {
  id: string;
  title: string;
  sourceType: "USER_MATERIAL" | "TRUSTED_KNOWLEDGE_BASE";
  url?: string | null;
  page?: number | null;
}

interface BlockBase {
  id: string;
  citationIds?: string[];
}

export type LearningBlock = BlockBase & (
  | { type: "explanation"; title?: string | null; content: string }
  | ({ type: "guided_question"; content: string } & (
      | { expectedInput: "TEXT" | "NUMBER"; choices?: never }
      | { expectedInput: "CHOICE"; choices: string[] }
    ))
  | { type: "hint"; title?: string | null; content: string; level: 1 | 2 | 3 }
  | ({ type: "quiz"; questionId: string; prompt: string } & (
      | { format: "SHORT_TEXT" | "NUMBER"; choices?: never }
      | { format: "MULTIPLE_CHOICE"; choices: Array<{ id: string; label: string }> }
    ))
  | { type: "feedback"; content: string; result: "CORRECT" | "PARTIALLY_CORRECT" | "TRY_AGAIN" }
  | {
      type: "interactive";
      component: "OHMS_LAW" | "LINEAR_EQUATION" | "LOGIC_GATE";
      props: Record<string, unknown>;
    }
);

export interface TutorOutput {
  schemaVersion: "1.0";
  responseId: string;
  sessionId: string;
  stage: TutorOutputStage;
  blocks: LearningBlock[];
  progress: TutorProgress;
  citations: Citation[];
}

declare const validatedTutorOutput: unique symbol;

// Only the orchestration boundary constructs this type after runtime validation.
export type ValidatedTutorOutput = TutorOutput & {
  readonly [validatedTutorOutput]: true;
};
