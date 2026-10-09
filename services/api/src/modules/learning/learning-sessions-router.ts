import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";

import { getDb, type UserDb } from "../../prisma/db.js";
import { withApiWrite } from "../../prisma/api-write.js";
import { PrismaTextMaterials } from "../input/text-materials.js";
import { PrismaAssessmentStore } from "../assessments/prisma-assessment-store.js";
import type { ModelProvider } from "../ai/providers/model-provider.js";
import {
  requireSupabaseUser,
  type AuthenticatedRequest,
  type AuthenticatedUser,
} from "../auth/supabase-auth.js";
import { createLearningEngine, type CreateLearningEngineOptions } from "./create-learning-engine.js";
import { LearningError } from "./learning-errors.js";
import { PrismaLearningPersistence } from "./prisma-learning-persistence.js";
import { readPersistedMessages, type PersistedMessage } from "./persisted-messages.js";
import { logSessionLoadFailure } from "../../shared/safe-diagnostics.js";

type SessionRow = NonNullable<Awaited<ReturnType<UserDb["orm"]["public"]["LearningSession"]["first"]>>>;

export interface LearningSessionsRouterOptions extends Pick<CreateLearningEngineOptions, "knowledgeRetriever" | "knowledgeRoot"> {
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

function messageDto(row: PersistedMessage) {
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

async function ensureAppUser(client: UserDb, user: AuthenticatedUser): Promise<void> {
  const existing = await client.orm.public.User.where({ id: user.id }).select("id").first();
  if (existing) {
    await client.orm.public.User.where({ id: user.id }).update({
      authUserId: user.id,
      email: user.email,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  await client.orm.public.User.create({
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
  if (!request.authUser || !request.authToken) throw new Error("Missing verified user context.");
  return request.authUser;
}
async function requestDb(request: AuthenticatedRequest): Promise<UserDb> {
  requireUser(request);
  return (await getDb()).asUser(request.authToken!);
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

      const client = await requestDb(request);
      await ensureAppUser(client, user);

      const now = new Date().toISOString();
      const id = randomUUID();
      const row = {
        id,
        userId: user.id,
        title,
        learningGoal: learningGoal ?? null,
        subject: subject ?? null,
        state: "INPUT" as const,
        lifecycleState: "ACTIVE" as const,
        stage: "EXPLAIN" as const,
        progressPercent: 0,
        version: 0,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
      await withApiWrite(client, async tx => {
        await tx.execute(client.raw.sql`
          INSERT INTO public."LearningSession"
          ("id", "userId", "title", "learningGoal", "subject", "state", "lifecycleState",
           "stage", "progressPercent", "version", "createdAt", "updatedAt", "completedAt")
          VALUES (${row.id}, ${row.userId}, ${row.title}, NULLIF(${row.learningGoal ?? ""}, ''),
            NULLIF(${row.subject ?? ""}, ''), ${row.state}, ${row.lifecycleState}, ${row.stage},
            ${row.progressPercent}, ${row.version}, ${row.createdAt}::timestamptz,
            ${row.updatedAt}::timestamptz, NULL)
        `.affectedCount().build());
      });

      response.status(201).json({ data: sessionSummary(row) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (request: AuthenticatedRequest, response, next) => {
    try {
      const user = requireUser(request);
      const client = await requestDb(request);
      const rows = await client.orm.public.LearningSession
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
    let phase: "auth" | "session" | "messages" | "response" = "auth";
    try {
      const user = requireUser(request);
      const sessionId = readSessionId(request);
      const client = await requestDb(request);
      phase = "session";
      const session = await client.orm.public.LearningSession
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

      phase = "messages";
      const messages = await readPersistedMessages(client, session.id);
      const materials = await new PrismaTextMaterials(client, user.id).list(session.id);

      phase = "response";
      response.status(200).json({
        data: {
          ...sessionSummary(session),
          messages: messages.map(messageDto),
          materials,
        },
      });
    } catch (error) {
      // Never include JWTs, request bodies or SQL parameters in logs or responses.
      // The request ID and phase isolate failures in session/message restoration.
      logSessionLoadFailure(response.locals.requestId, phase);
      // The phase is a fixed enum with no query, token or user data.
      // Return only the phase for this detail endpoint so Preview E2E can
      // diagnose failures even when runtime log access is restricted.
      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "The request could not be completed.",
          requestId: response.locals.requestId,
          details: [{ path: "/lesson", message: `Lesson loading failed at ${phase} phase.` }],
        },
      });
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
        const client = await requestDb(request);
      const session = await client.orm.public.LearningSession
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

        if (action === "ADVANCE" && session.stage === "ASSESS") {
          const assessment = await new PrismaAssessmentStore(client, user.id).getAssessment(session.id, "POST");
          if (!assessment?.submittedAt) throw new LearningError("INVALID_STAGE_TRANSITION", [
            { path: "/action", message: "Submit the post-test before completing the learning session." },
          ]);
        }

        if (session.state === "PRE_TEST" && session.stage === "EXPLAIN") {
          const assessment = await new PrismaAssessmentStore(client, user.id).getAssessment(session.id, "PRE");
          if (!assessment?.submittedAt) throw new LearningError("INVALID_STAGE_TRANSITION", [
            { path: "/action", message: "Submit the pre-test before starting this learning session." },
          ]);
        }

        const persistence = new PrismaLearningPersistence({
          userId: user.id,
          client,
          titleForSession: () => session.title,
        });
        const engine = createLearningEngine({
          learningPersistence: persistence,
          modelProvider: options.modelProvider,
          knowledgeRetriever: options.knowledgeRetriever,
          knowledgeRoot: options.knowledgeRoot,
          materials: new PrismaTextMaterials(client, user.id),
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
