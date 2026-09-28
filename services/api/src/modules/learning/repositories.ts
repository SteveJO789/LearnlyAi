import type { LearningMessage, LearningSession } from "./domain.js";
import type { SourceMaterial } from "../ai/tutor-context.js";

export interface SourceMaterialRepository {
  findBySessionId(sessionId: string): Promise<SourceMaterial[]>;
}

export interface LearningSessionRepository {
  findById(id: string): Promise<LearningSession | null>;
  save(session: LearningSession): Promise<void>;
}

export interface MessageRepository {
  add(message: LearningMessage): Promise<void>;
  findBySessionId(sessionId: string): Promise<LearningMessage[]>;
}

export interface LearningCommit {
  session: LearningSession;
  messages: readonly LearningMessage[];
  // null means create only if no session exists; otherwise compare the version.
  expectedVersion: number | null;
}

export interface LearningPersistence {
  readonly sessions: LearningSessionRepository;
  readonly messages: MessageRepository;
  // Atomically compare version and save the session plus all messages.
  // A future Prisma adapter must implement this operation in a transaction.
  commit(change: LearningCommit): Promise<boolean>;
}
