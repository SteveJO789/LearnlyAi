import { sendLearningInteraction } from "../../../lib/learning-sessions";

export type LearningAction = "RESPOND" | "ADVANCE";

export type Choice = { id: string; label: string };

export type Block =
  | { id: string; type: "explanation"; title?: string | null; content: string }
  | {
      id: string;
      type: "guided_question";
      content: string;
      expectedInput?: string;
      choices?: string[];
    }
  | { id: string; type: "hint"; title?: string | null; content: string; level?: number }
  | {
      id: string;
      type: "quiz";
      questionId: string;
      prompt: string;
      format: "MULTIPLE_CHOICE" | "SHORT_TEXT" | "NUMBER";
      choices?: Choice[];
    }
  | {
      id: string;
      type: "feedback";
      content: string;
      result: "CORRECT" | "PARTIALLY_CORRECT" | "TRY_AGAIN";
    }
  | {
      id: string;
      type: "interactive";
      component: string;
      props?: Record<string, unknown>;
    };

export type Citation = {
  id: string;
  title: string;
  sourceType?: string;
  url?: string | null;
  page?: number | null;
};

export type TutorOutput = {
  schemaVersion?: string;
  responseId?: string;
  sessionId?: string;
  stage?: string;
  blocks: Block[];
  progress?: {
    percent: number;
    canAdvance: boolean;
    nextAction?: string | null;
  };
  citations?: Citation[];
};

export type LearningRequest = {
  sessionId: string;
  input: string;
  action: LearningAction;
};

export class LearningApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LearningApiError";
    this.status = status;
  }
}

export async function respondToLearning(
  request: LearningRequest,
): Promise<TutorOutput> {
  try {
    return await sendLearningInteraction<TutorOutput>({
      sessionId: request.sessionId,
      message: request.input,
      action: request.action,
    });
  } catch (error) {
    throw new LearningApiError(
      error instanceof Error
        ? error.message
        : "เชื่อมต่อ Learning API ไม่ได้",
    );
  }
}
