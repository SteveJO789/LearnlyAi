import type { LearningMessage, LearningSession } from "./domain.js";
import type {
  LearningCommit, LearningPersistence, LearningSessionRepository, MessageRepository,
} from "./repositories.js";

interface MemoryStore {
  sessions: Map<string, LearningSession>;
  messages: Map<string, LearningMessage>;
}

function createStore(): MemoryStore {
  return { sessions: new Map(), messages: new Map() };
}

export class InMemoryLearningSessionRepository implements LearningSessionRepository {
  constructor(private readonly store: MemoryStore = createStore()) {}

  async findById(id: string): Promise<LearningSession | null> {
    return structuredClone(this.store.sessions.get(id) ?? null);
  }

  async save(session: LearningSession): Promise<void> {
    this.store.sessions.set(session.id, structuredClone(session));
  }
}

export class InMemoryMessageRepository implements MessageRepository {
  constructor(private readonly store: MemoryStore = createStore()) {}

  async add(message: LearningMessage): Promise<void> {
    if (this.store.messages.has(message.id)) throw new Error("Message ID already exists.");
    this.store.messages.set(message.id, structuredClone(message));
  }

  async findBySessionId(sessionId: string): Promise<LearningMessage[]> {
    // Map insertion order is the committed conversation order, including equal timestamps.
    return structuredClone([...this.store.messages.values()].filter((message) => message.sessionId === sessionId));
  }
}

export class InMemoryLearningPersistence implements LearningPersistence {
  private readonly store = createStore();
  readonly sessions = new InMemoryLearningSessionRepository(this.store);
  readonly messages = new InMemoryMessageRepository(this.store);

  async commit(change: LearningCommit): Promise<boolean> {
    const current = this.store.sessions.get(change.session.id);
    if ((current?.version ?? null) !== change.expectedVersion) return false;
    if (change.session.version !== (change.expectedVersion ?? 0) + 1) {
      throw new Error("A commit must increment the session version.");
    }
    // Clone and check everything before the synchronous writes: failed commits
    // cannot leave a session without its corresponding conversation messages.
    const session = structuredClone(change.session);
    const messages = structuredClone(change.messages);
    const ids = new Set<string>();
    for (const message of messages) {
      if (message.sessionId !== session.id || ids.has(message.id) || this.store.messages.has(message.id)) {
        throw new Error("Invalid conversation commit.");
      }
      ids.add(message.id);
    }
    this.store.sessions.set(session.id, session);
    for (const message of messages) this.store.messages.set(message.id, message);
    return true;
  }
}
