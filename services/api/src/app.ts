import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type Express } from "express";
import { AIBoundaryError } from "./modules/ai/ai-boundary-error.js";
import { createLearningEngine, type CreateLearningEngineOptions } from "./modules/learning/create-learning-engine.js";
import type { LearningEngine } from "./modules/learning/domain.js";
import { LearningError } from "./modules/learning/learning-errors.js";
import { createLearningRouter } from "./modules/learning/learning-router.js";
import { createLearningSessionsRouter } from "./modules/learning/learning-sessions-router.js";
import { createReadinessCheck, type ReadinessOptions } from "./shared/readiness.js";

export interface AppOptions extends CreateLearningEngineOptions {
  learningEngine?: LearningEngine;
  /** Explicit test/local development opt-in. Never enabled on a deployment. */
  enableDevelopmentLearningRoute?: boolean;
  readiness?: ReadinessOptions;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const engine = options.learningEngine ?? createLearningEngine(options);

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID();
    response.setHeader("x-request-id", response.locals.requestId);
    next();
  });
  app.use(express.json({ limit: "1mb" }));

  app.get("/health/live", (_request, response) => {
    response.status(200).json({
      data: {
        status: "ok",
      },
    });
  });

  const checkReadiness = createReadinessCheck({ knowledgeRoot: options.knowledgeRoot, ...options.readiness });
  app.get("/health/ready", async (_request, response) => {
    const data = await checkReadiness();
    response.status(data.status === "ready" ? 200 : 503).json({ data });
  });

  const deployed = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const developmentRouteEnabled = options.enableDevelopmentLearningRoute ??
    (process.env.APP_ENV === "development" && process.env.LEARNING_DEV_ROUTE_ENABLED === "true");
  if (developmentRouteEnabled && !deployed) {
    const learningRouter = createLearningRouter(engine);
    app.use("/api/learning", learningRouter);
    app.use("/api/v1/learning", learningRouter);
  }
  app.use(
    "/api/v1/learning-sessions",
    createLearningSessionsRouter({ modelProvider: options.modelProvider }),
  );

  app.use((_request, response) => {
    response.status(404).json({ error: {
      code: "NOT_FOUND", message: "The endpoint was not found.",
      requestId: response.locals.requestId, details: [],
    } });
  });

  const handleError: ErrorRequestHandler = (error: unknown, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "The request could not be completed.";
    let details: ReadonlyArray<{ path: string; message: string }> = [];
    if (error instanceof LearningError || error instanceof AIBoundaryError) {
      ({ status, code, message } = error);
      if (error instanceof LearningError) {
        details = error.details.map((detail) => ({
          ...detail,
          path: detail.path === "/userInput" ? "/input" : detail.path,
        }));
      }
    } else if (error && typeof error === "object" && "type" in error) {
      if (error.type === "entity.parse.failed") {
        status = 400;
        code = "VALIDATION_ERROR";
        message = "The request body must be valid JSON.";
      } else if (error.type === "entity.too.large") {
        status = 413;
        code = "PAYLOAD_TOO_LARGE";
        message = "The request body is too large.";
      }
    }
    response.status(status).json({ error: { code, message, requestId: response.locals.requestId, details } });
  };
  app.use(handleError);
  return app;
}

const app = createApp();

export default app;
