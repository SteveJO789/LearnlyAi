import { db } from "../../prisma/db.js";
import type { ValidatedTutorOutput } from "../ai/tutor-output.js";
import type { LearningMessage, LearningSession } from "./domain.js";
import { getStagePolicy } from "./stage-machine.js";
import type {
  LearningCommit,
  LearningPersistence,
  LearningSessionRepository,
  MessageRepository,
} from "./repositories.js";

type LearningSessionRow = NonNullable<
  Awaited<ReturnType<typeof db.orm.public.LearningSession.first>>
>;
type MessageRow = NonNullable<
  Awaited<ReturnType<typeof db.orm.public.Message.first>>
>;

export interface PrismaLearningPersistenceOptions {
  userId: string;
  titleForSession: (session: LearningSession) => string;
}

function toLearningSession(row: LearningSessionRow): LearningSession {
  return {
    id: row.id,
    state: row.state,
    lifecycleState: row.lifecycleState,
    stage: row.stage,
    learningGoal: row.learningGoal ?? undefined,
    subject: row.subject ?? undefined,
    progress: {
      percent: row.progressPercent,
      canAdvance: false,
      nextAction: "CONTINUE",
    },
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLearningMessage(row: MessageRow): LearningMessage {
  const base = {
    id: row.id,
    sessionId: row.learningSessionId,
    createdAt: row.createdAt,
  };

  if (row.role === "USER") {
    if (typeof row.content !== "string") {
      throw new Error("Persisted USER message content must be a string.");
    }
    return { ...base, role: "USER", content: row.content };
  }

  if (row.role === "TUTOR") {
    return {
      ...base,
      role: "TUTOR",
      content: row.content as unknown as ValidatedTutorOutput,
    };
  }

  throw new Error(`Unsupported persisted learning message role: ${row.role}`);
}

function toSessionCreateData(
  session: LearningSession,
  userId: string,
  title: string,
) {
  return {
    id: session.id,
    userId,
    title,
    learningGoal: session.learningGoal ?? null,
    subject: session.subject ?? null,
    state: session.state,
    lifecycleState: session.lifecycleState,
    stage: session.stage,
    progressPercent: session.progress.percent,
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function toSessionUpdateData(session: LearningSession) {
  return {
    learningGoal: session.learningGoal ?? null,
    subject: session.subject ?? null,
    state: session.state,
    lifecycleState: session.lifecycleState,
    stage: session.stage,
    progressPercent: session.progress.percent,
    version: session.version,
    updatedAt: session.updatedAt,
  };
}

function toMessageCreateData(message: LearningMessage) {
  return {
    id: message.id,
    learningSessionId: message.sessionId,
    role: message.role,
    content: JSON.parse(JSON.stringify(message.content)),
    createdAt: message.createdAt,
  };
}

class PrismaLearningSessionRepository implements LearningSessionRepository {
  constructor(private readonly options: PrismaLearningPersistenceOptions) {}

  async findById(id: string): Promise<LearningSession | null> {
    const row = await db.orm.public.LearningSession
      .where({ id, userId: this.options.userId })
      .first();

    return row ? toLearningSession(row) : null;
  }

  async save(session: LearningSession): Promise<void> {
    const updated = await db.orm.public.LearningSession
      .where({ id: session.id, userId: this.options.userId })
      .update(toSessionUpdateData(session));

    if (updated) return;

    await db.orm.public.LearningSession.create(
      toSessionCreateData(
        session,
        this.options.userId,
        this.options.titleForSession(session),
      ),
    );
  }
}

class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly options: PrismaLearningPersistenceOptions) {}

  async add(message: LearningMessage): Promise<void> {
    const session = await db.orm.public.LearningSession
      .where({ id: message.sessionId, userId: this.options.userId })
      .select("id")
      .first();

    if (!session) {
      throw new Error("Learning session not found.");
    }

    await db.orm.public.Message.create(toMessageCreateData(message));
  }

  async findBySessionId(sessionId: string): Promise<LearningMessage[]> {
    const session = await db.orm.public.LearningSession
      .where({ id: sessionId, userId: this.options.userId })
      .select("id")
      .first();

    if (!session) return [];

    const rows = await db.orm.public.Message
      .where({ learningSessionId: sessionId })
      .orderBy((message) => message.createdAt.asc())
      .all();

    return rows.map(toLearningMessage);
  }
}

export class PrismaLearningPersistence implements LearningPersistence {
  readonly sessions: LearningSessionRepository;
  readonly messages: MessageRepository;

  constructor(private readonly options: PrismaLearningPersistenceOptions) {
    this.sessions = new PrismaLearningSessionRepository(options);
    this.messages = new PrismaMessageRepository(options);
  }

  async commit(change: LearningCommit): Promise<boolean> {
    const expectedNextVersion = (change.expectedVersion ?? 0) + 1;

    if (change.session.version !== expectedNextVersion) {
      throw new Error("A commit must increment the session version.");
    }

    for (const message of change.messages) {
      if (message.sessionId !== change.session.id) {
        throw new Error("Invalid conversation commit.");
      }
    }

    return db.transaction(async (tx) => {
      if (change.expectedVersion === null) {
        const created = await tx.orm.public.LearningSession.createAll(
          [
            toSessionCreateData(
              change.session,
              this.options.userId,
              this.options.titleForSession(change.session),
            ),
          ],
          { onConflict: "skip", conflictOn: ["id"] },
        );

        if (created.length !== 1) return false;
      } else {
        const updated = await tx.orm.public.LearningSession
          .where({
            id: change.session.id,
            userId: this.options.userId,
            version: change.expectedVersion,
          })
          .update(toSessionUpdateData(change.session));

        if (!updated) return false;
      }

      if (change.messages.length > 0) {
        await tx.orm.public.Message.createAll(
          change.messages.map(toMessageCreateData),
        );
      }

      return true;
    });
  }
}
