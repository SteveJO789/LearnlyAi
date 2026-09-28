import { Router } from "express";
import type { LearningEngine } from "./domain.js";
import { LearningError } from "./learning-errors.js";
import { normalizeLearningRequest } from "./learning-request.js";

const REQUEST_FIELDS = new Set(["sessionId", "input", "learningGoal", "subject", "action"]);

export function createLearningRouter(engine: LearningEngine): Router {
  const router = Router();
  router.post("/respond", async (request, response) => {
    if (!request.is("application/json")) {
      response.status(415).json({
        error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Use application/json.", requestId: response.locals.requestId, details: [] },
      });
      return;
    }
    const body: unknown = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new LearningError("VALIDATION_ERROR");
    const fields = body as Record<string, unknown>;
    if (Object.keys(fields).some((key) => !REQUEST_FIELDS.has(key))) throw new LearningError("VALIDATION_ERROR");
    const learningRequest = normalizeLearningRequest({
      sessionId: fields.sessionId,
      userInput: fields.input,
      learningGoal: fields.learningGoal,
      subject: fields.subject,
      action: fields.action,
    });
    const result = await engine.process(learningRequest);
    response.status(200).json({ data: result });
  });
  return router;
}
