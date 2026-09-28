import type { LearningRequest } from "./domain.js";
import { LearningError } from "./learning-errors.js";

export function normalizeLearningRequest(value: unknown): LearningRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LearningError("VALIDATION_ERROR");
  }
  const request = value as Record<string, unknown>;
  const readText = (field: string, limit: number, optional = false): string | undefined => {
    const text = request[field];
    if (optional && text === undefined) return undefined;
    if (typeof text !== "string" || !text.trim() || text.length > limit) {
      throw new LearningError("VALIDATION_ERROR", [
        { path: `/${field}`, message: `Must be nonblank text of at most ${limit} characters.` },
      ]);
    }
    return text.trim();
  };
  const sessionId = readText("sessionId", 128)!;
  const userInput = readText("userInput", 8000)!;
  const learningGoal = readText("learningGoal", 1000, true);
  const subject = readText("subject", 128, true);
  const action = request.action === undefined ? "RESPOND" : request.action;
  if (action !== "RESPOND" && action !== "ADVANCE") {
    throw new LearningError("VALIDATION_ERROR", [
      { path: "/action", message: "Must be RESPOND or ADVANCE." },
    ]);
  }
  return { sessionId, userInput, learningGoal, subject, action };
}
