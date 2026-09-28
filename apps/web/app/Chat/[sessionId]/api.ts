// Everything that talks to the Learning API lives in this file, so changing
// the URL/path (or the response shape) later only touches one place.

export const LEARNING_API_BASE_URL = "";

const RESPOND_PATH = "/api/learning/respond";

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
  learningGoal?: string;
  subject?: string;
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

function extractErrorMessage(payload: unknown): string | null {
  const message = (payload as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" && message.length > 0 ? message : null;
}

export async function respondToLearning(request: LearningRequest): Promise<TutorOutput> {
  let response: Response;

  try {
    response = await fetch(`${LEARNING_API_BASE_URL}${RESPOND_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new LearningApiError(
      `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (${LEARNING_API_BASE_URL}) — ตรวจสอบว่า backend เปิดอยู่ และอนุญาต CORS จากเว็บนี้`,
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Body wasn't JSON; handled below.
  }

  if (!response.ok) {
    throw new LearningApiError(
      extractErrorMessage(payload) ?? `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`,
      response.status,
    );
  }

  const data = (payload as { data?: Partial<TutorOutput> } | null)?.data;

  if (!data || !Array.isArray(data.blocks)) {
    throw new LearningApiError(
      "ข้อมูลจากเซิร์ฟเวอร์ไม่อยู่ในรูปแบบที่คาดไว้ (ไม่พบ data.blocks)",
    );
  }

  return data as TutorOutput;
}
