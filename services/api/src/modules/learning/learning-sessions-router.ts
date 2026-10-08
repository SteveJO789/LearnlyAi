import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { db } from "../../prisma/db.js";
import type { ModelProvider } from "../ai/providers/model-provider.js";
import {
  requireSupabaseUser,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from "../auth/supabase-auth.js";
import { createLearningEngine } from "./create-learning-engine.js";
import { LearningError } from "./learning-errors.js";
import { PrismaLearningPersistence } from "./prisma-learning-persistence.js";

type SessionRow = NonNullable<
  Awaited<ReturnType<typeof db.orm.public.LearningSession.first>>
>;
type MessageRow = NonNullable<
  Awaited<ReturnType<typeof db.orm.public.Message.first>>
>;

export interface LearningSessionsRouterOptions {
  authenticate?: RequestHandler;
  modelProvider?: ModelProvider;
}

function sessionSummary(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    learningGoal: row.learningGoal,
    subject: row.subject,
    state: row.state,
    lifecycleState: row.lifecycleState,
    stage: row.stage,
    progressPercent: row.progressPercent,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function messageDto(row: MessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
  };
}

function readOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new LearningError("VALIDATION_ERROR", [
      {
        path: `/${field}`,
        message: `Must be nonblank text of at most ${maxLength} characters.`,
      },
    ]);
  }
  return value.trim();
}

async function ensureAppUser(user: AuthenticatedUser): Promise<void> {
  const existing = await db.orm.public.User.where({ id: user.id }).select("id").first();
  if (existing) {
    await db.orm.public.User.where({ id: user.id }).update({
      authUserId: user.id,
      email: user.email,
      avatarUrl: user.avatarUrl,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  await db.orm.public.User.create({
    id: user.id,
    authUserId: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function requireUser(request: AuthenticatedRequest): AuthenticatedUser {
  if (!request.authUser) {
    throw new Error("Authenticated request is missing authUser.");
  }
  return request.authUser;
}

function readSessionId(request: AuthenticatedRequest): string {
  const value = request.params.sessionId;
  if (typeof value !== "string" || !value.trim()) {
    throw new LearningError("VALIDATION_ERROR", [
      { path: "/sessionId", message: "A valid session id is required." },
    ]);
  }
  return value;
}

export function createLearningSessionsRouter(
  options: LearningSessionsRouterOptions = {},
): Router {
  const router = Router();
  router.use(options.authenticate ?? requireSupabaseUser);

  router.post("/", async (request: AuthenticatedRequest, response, next) => {
    try {
      const user = requireUser(request);
      if (!request.is("application/json")) {
        response.status(415).json({
          error: {
            code: "UNSUPPORTED_MEDIA_TYPE",
            message: "Use application/json.",
            requestId: response.locals.requestId,
            details: [],
          },
        });
        return;
      }

      const body =
        request.body && typeof request.body === "object" && !Array.isArray(request.body)
          ? (request.body as Record<string, unknown>)
          : {};

      const learningGoal = readOptionalText(body.learningGoal, "learningGoal", 1000);
      const subject = readOptionalText(body.subject, "subject", 128);
      const requestedTitle = readOptionalText(body.title, "title", 160);
      const title =
        requestedTitle ??
        learningGoal?.slice(0, 160) ??
        (subject ? `${subject} learning session` : "New learning session");

      await ensureAppUser(user);

      const now = new Date().toISOString();
      const id = randomUUID();
      const row = await db.orm.public.LearningSession.create({
        id,
        userId: user.id,
        title,
        learningGoal: learningGoal ?? null,
        subject: subject ?? null,
        state: "INPUT",
        lifecycleState: "ACTIVE",
        stage: "EXPLAIN",
        progressPercent: 0,
        version: 0,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      response.status(201).json({ data: sessionSummary(row) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (request: AuthenticatedRequest, response, next) => {
    try {
      const user = requireUser(request);
      const rows = await db.orm.public.LearningSession
        .where({ userId: user.id })
        .orderBy((session) => session.updatedAt.desc())
        .all();

      response.status(200).json({
        data: rows.slice(0, 100).map(sessionSummary),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:sessionId", async (request: AuthenticatedRequest, response, next) => {
    try {
      const user = requireUser(request);
      const sessionId = readSessionId(request);
      const session = await db.orm.public.LearningSession
        .where({ id: sessionId, userId: user.id })
        .first();

      if (!session) {
        response.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "Learning session was not found.",
            requestId: response.locals.requestId,
            details: [],
          },
        });
        return;
      }

      const messages = await db.orm.public.Message
        .where({ learningSessionId: session.id })
        .orderBy((message) => message.createdAt.asc())
        .all();

      response.status(200).json({
        data: {
          ...sessionSummary(session),
          messages: messages.map(messageDto),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:sessionId/interactions",
    async (request: AuthenticatedRequest, response, next) => {
      try {
        const user = requireUser(request);
        if (!request.is("application/json")) {
          response.status(415).json({
            error: {
              code: "UNSUPPORTED_MEDIA_TYPE",
              message: "Use application/json.",
              requestId: response.locals.requestId,
              details: [],
            },
          });
          return;
        }

        const sessionId = readSessionId(request);
        const session = await db.orm.public.LearningSession
          .where({ id: sessionId, userId: user.id })
          .first();

        if (!session) {
          response.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: "Learning session was not found.",
              requestId: response.locals.requestId,
              details: [],
            },
          });
          return;
        }

        const body =
          request.body && typeof request.body === "object" && !Array.isArray(request.body)
            ? (request.body as Record<string, unknown>)
            : {};

        const input = body.input ?? body.message;
        const action = body.action ?? "RESPOND";

        if (action !== "RESPOND" && action !== "ADVANCE") {
          throw new LearningError("VALIDATION_ERROR", [
            { path: "/action", message: "Must be RESPOND or ADVANCE." },
          ]);
        }

        const persistence = new PrismaLearningPersistence({
          userId: user.id,
          titleForSession: () => session.title,
        });
        const engine = createLearningEngine({
          learningPersistence: persistence,
          modelProvider: options.modelProvider,
        });

        const result = await engine.process({
          sessionId: session.id,
          userInput:
            typeof input === "string"
              ? input
              : action === "ADVANCE"
                ? "Continue"
                : "",
          learningGoal: session.learningGoal ?? undefined,
          subject: session.subject ?? undefined,
          action,
        });

        response.status(200).json({ data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
