import type { UserDb } from "../../prisma/db.js";
import { readPersistedMessages, type PersistedMessage } from "./persisted-messages.js";
import type { ValidatedTutorOutput } from "../ai/tutor-output.js";
import type { LearningMessage, LearningSession } from "./domain.js";
import { getStagePolicy } from "./stage-machine.js";
import type {
  LearningCommit,
  LearningPersistence,
  LearningSessionRepository,
  MessageRepository,
} from "./repositories.js";

type LearningSessionRow = NonNullable<Awaited<ReturnType<UserDb["orm"]["public"]["LearningSession"]["first"]>>>;

export interface PrismaLearningPersistenceOptions {
  client: UserDb;
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
      ...getStagePolicy(row.stage).progress,
      percent: row.progressPercent,
    },
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toLearningMessage(row: PersistedMessage): LearningMessage {
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
    const row = await this.options.client.orm.public.LearningSession
      .where({ id, userId: this.options.userId })
      .first();

    return row ? toLearningSession(row) : null;
  }

  async save(session: LearningSession): Promise<void> {
    const updated = await this.options.client.orm.public.LearningSession
      .where({ id: session.id, userId: this.options.userId })
      .update(toSessionUpdateData(session));

    if (updated) return;

    await this.options.client.orm.public.LearningSession.create(
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
    const session = await this.options.client.orm.public.LearningSession
      .where({ id: message.sessionId, userId: this.options.userId })
      .select("id")
      .first();

    if (!session) {
      throw new Error("Learning session not found.");
    }

    await this.options.client.orm.public.Message.create(toMessageCreateData(message));
  }

  async findBySessionId(sessionId: string): Promise<LearningMessage[]> {
    const session = await this.options.client.orm.public.LearningSession
      .where({ id: sessionId, userId: this.options.userId })
      .select("id")
      .first();

    if (!session) return [];

    const rows = await readPersistedMessages(this.options.client, sessionId);

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

    // Supabase RoleBoundDb.transaction returns a bare TransactionContext
    // (execute/query only). Compile parameterized SQL with the role-bound
    // client's builder and execute every statement on the SAME transaction.
    const raw = this.options.client.raw;
    return this.options.client.transaction(async (tx) => {
      let affected = 0;
      if (change.expectedVersion === null) {
        const row = toSessionCreateData(
          change.session,
          this.options.userId,
          this.options.titleForSession(change.session),
        );
        const plan = raw.sql`
          INSERT INTO public."LearningSession"
            ("id", "userId", "title", "learningGoal", "subject", "state",
             "lifecycleState", "stage", "progressPercent", "version",
             "createdAt", "updatedAt")
          VALUES (
            ${row.id}, ${row.userId}, ${row.title}, NULLIF(${row.learningGoal ?? ""}, ''),
            NULLIF(${row.subject ?? ""}, ''), ${row.state}, ${row.lifecycleState}, ${row.stage},
            ${row.progressPercent}, ${row.version},
            ${row.createdAt}::timestamptz, ${row.updatedAt}::timestamptz
          )
          ON CONFLICT ("id") DO NOTHING
        `.affectedCount().build();
        affected = (await tx.execute(plan)).affectedRows;
      } else {
        const row = toSessionUpdateData(change.session);
        const plan = raw.sql`
          UPDATE public."LearningSession" SET
            "learningGoal" = NULLIF(${row.learningGoal ?? ""}, ''),
            "subject" = NULLIF(${row.subject ?? ""}, ''),
            "state" = ${row.state},
            "lifecycleState" = ${row.lifecycleState},
            "stage" = ${row.stage},
            "progressPercent" = ${row.progressPercent},
            "version" = ${row.version},
            "updatedAt" = ${row.updatedAt}::timestamptz
          WHERE "id" = ${change.session.id}
            AND "userId" = ${this.options.userId}
            AND "version" = ${change.expectedVersion}
        `.affectedCount().build();
        affected = (await tx.execute(plan)).affectedRows;
      }

      if (affected !== 1) return false;

      for (const message of change.messages) {
        const row = toMessageCreateData(message);
        const plan = raw.sql`
          INSERT INTO public."Message"
            ("id", "learningSessionId", "role", "content", "createdAt")
          VALUES (
            ${row.id}, ${row.learningSessionId}, ${row.role},
            ${JSON.stringify(row.content)}::jsonb,
            ${row.createdAt}::timestamptz
          )
        `.affectedCount().build();
        await tx.execute(plan);
      }
      return true;
    });;
  }
}
