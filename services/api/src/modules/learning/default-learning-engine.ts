import { randomUUID } from "node:crypto";
import { AIBoundaryError, normalizeProviderFailure } from "../ai/ai-boundary-error.js";
import type { TutorContext } from "../ai/tutor-context.js";
import type { TutorOrchestrator } from "../ai/tutor-orchestrator.js";
import type { LearningEngine, LearningRequest, LearningResult, LearningSession, LearningStage } from "./domain.js";
import { LearningError } from "./learning-errors.js";
import { normalizeLearningRequest } from "./learning-request.js";
import type { LearningPersistence, SourceMaterialRepository } from "./repositories.js";
import { determineStage, getStagePolicy } from "./stage-machine.js";

export interface LearningEngineDependencies {
  orchestrator: TutorOrchestrator;
  persistence: LearningPersistence;
  materials?: SourceMaterialRepository;
  initialStage?: LearningStage;
  idFactory?: () => string;
  now?: () => Date;
}

export class DefaultLearningEngine implements LearningEngine {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(private readonly dependencies: LearningEngineDependencies) {
    this.idFactory = dependencies.idFactory ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date());
  }

  async process(input: LearningRequest): Promise<LearningResult> {
    const request = normalizeLearningRequest(input);
    const { persistence, orchestrator } = this.dependencies;
    const previous = await persistence.sessions.findById(request.sessionId);
    const stage = determineStage(previous, request.action, this.dependencies.initialStage);
    const policy = getStagePolicy(stage);
    const timestamp = this.now().toISOString();
    const session: LearningSession = {
      id: request.sessionId,
      state: stage === "REVIEW" ? "COMPLETED" : "ACTIVE",
      stage,
      learningGoal: request.learningGoal ?? previous?.learningGoal,
      subject: request.subject ?? previous?.subject,
      progress: policy.progress,
      version: (previous?.version ?? 0) + 1,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const context = await this.buildContext(request, session, policy.outputStage);
    let result: LearningResult;
    try {
      result = await orchestrator.generate(context);
    } catch (error) {
      const boundaryError = error instanceof AIBoundaryError ? error : normalizeProviderFailure(error);
      // Retain the last successful stage; never persist rejected model content.
      const failedSession: LearningSession = previous
        ? { ...previous, state: "FAILED", version: session.version, updatedAt: timestamp }
        : { ...session, state: "FAILED" };
      // A concurrent successful commit wins over this stale failure.
      await persistence.commit({ session: failedSession, messages: [], expectedVersion: previous?.version ?? null });
      throw boundaryError;
    }
    const committed = await persistence.commit({
      session,
      expectedVersion: previous?.version ?? null,
      messages: [
        { id: this.idFactory(), sessionId: session.id, createdAt: timestamp, role: "USER", content: request.userInput },
        { id: result.responseId, sessionId: session.id, createdAt: timestamp, role: "TUTOR", content: result },
      ],
    });
    if (!committed) throw new LearningError("SESSION_CONFLICT");
    return result;
  }

  private async buildContext(
    request: LearningRequest,
    session: LearningSession,
    outputStage: TutorContext["outputStage"],
  ): Promise<TutorContext> {
    const { persistence, materials } = this.dependencies;
    const [messages, sourceMaterials] = await Promise.all([
      persistence.messages.findBySessionId(session.id),
      materials?.findBySessionId(session.id) ?? Promise.resolve([]),
    ]);
    return {
      sessionId: session.id,
      responseId: this.idFactory(),
      stage: session.stage,
      outputStage,
      progress: structuredClone(session.progress),
      studentInput: request.userInput,
      learningGoal: session.learningGoal,
      subject: session.subject,
      previousMessages: messages.slice(-20).map((message) => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.role === "USER" ? message.content : JSON.stringify(message.content),
      })),
      sourceMaterials,
    };
  }
}
