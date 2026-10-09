import { Router, type RequestHandler } from "express";
import { requireSupabaseUser, type AuthenticatedRequest } from "../auth/supabase-auth.js";
import { authenticatedDb, verifiedUser } from "../../shared/authenticated-context.js";
import { ApiError } from "../../shared/api-error.js";
import { AssessmentService } from "./assessment-service.js";
import { PrismaAssessmentStore } from "./prisma-assessment-store.js";
import type { AssessmentStore } from "./domain.js";
import type { AssessmentPhase } from "./scoring.js";

export interface AssessmentRouterOptions {
  authenticate?: RequestHandler;
  storeFactory?: (request: AuthenticatedRequest) => Promise<AssessmentStore>;
}
const invalid = (path: string, message: string) => new ApiError("VALIDATION_ERROR", 400, "The assessment request is invalid.", [{ path, message }]);

function parameters(request: AuthenticatedRequest) {
  const sessionId = request.params.sessionId;
  const phase = typeof request.params.phase === "string" ? request.params.phase.toUpperCase() : "";
  if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 128) throw invalid("/sessionId", "A valid session id is required.");
  if (!["PRE", "POST", "TRANSFER"].includes(phase)) throw invalid("/phase", "Use PRE, POST or TRANSFER.");
  return { sessionId, phase: phase as AssessmentPhase };
}

function body(request: AuthenticatedRequest, fields: readonly string[]) {
  if (!request.is("application/json")) throw new ApiError("UNSUPPORTED_MEDIA_TYPE", 415, "Use application/json.");
  const value: unknown = request.body;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) {
    throw invalid("/", "Use the documented request fields only.");
  }
  return value as Record<string, unknown>;
}

export async function requestAssessmentStore(request: AuthenticatedRequest, options: AssessmentRouterOptions = {}) {
  verifiedUser(request);
  return options.storeFactory ? options.storeFactory(request) : new PrismaAssessmentStore(await authenticatedDb(request), verifiedUser(request).id);
}

export function createAssessmentRouter(options: AssessmentRouterOptions = {}) {
  const router = Router({ mergeParams: true });
  router.use(options.authenticate ?? requireSupabaseUser);
  router.post("/:phase", async (request: AuthenticatedRequest, response, next) => {
    try {
      const { sessionId, phase } = parameters(request);
      const input = body(request, ["topic", "language"]);
      if (input.topic !== "linear-equations" && input.topic !== "ohms-law") throw invalid("/topic", "Choose linear-equations or ohms-law.");
      const language = input.language ?? "th";
      if (language !== "th" && language !== "en") throw invalid("/language", "Use th or en.");
      const service = new AssessmentService(await requestAssessmentStore(request, options));
      response.status(201).json({ data: await service.create(sessionId, phase, input.topic, language) });
    } catch (error) { next(error); }
  });
  router.get("/:phase", async (request: AuthenticatedRequest, response, next) => {
    try {
      const { sessionId, phase } = parameters(request);
      const service = new AssessmentService(await requestAssessmentStore(request, options));
      response.json({ data: await service.get(sessionId, phase) });
    } catch (error) { next(error); }
  });
  router.post("/:phase/submissions", async (request: AuthenticatedRequest, response, next) => {
    try {
      const { sessionId, phase } = parameters(request);
      const input = body(request, ["answers"]);
      const service = new AssessmentService(await requestAssessmentStore(request, options));
      response.json({ data: await service.submit(sessionId, phase, input.answers) });
    } catch (error) { next(error); }
  });
  return router;
}

export function createLearningProfileRouter(options: AssessmentRouterOptions = {}) {
  const router = Router();
  router.use(options.authenticate ?? requireSupabaseUser);
  router.get("/learning-profile", async (request: AuthenticatedRequest, response, next) => {
    try {
      const store = await requestAssessmentStore(request, options);
      response.json({ data: await store.getLearningProfile() ?? { mastery: {}, strengths: [], weakPoints: [], updatedAt: null } });
    } catch (error) { next(error); }
  });
  router.get("/progress", async (request: AuthenticatedRequest, response, next) => {
    try { response.json({ data: await (await requestAssessmentStore(request, options)).getProgress() }); }
    catch (error) { next(error); }
  });
  return router;
}
