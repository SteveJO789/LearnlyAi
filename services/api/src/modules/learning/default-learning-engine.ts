import { randomUUID } from "node:crypto";
import { AIBoundaryError, normalizeProviderFailure } from "../ai/ai-boundary-error.js";
import type { TutorContext } from "../ai/tutor-context.js";
import type { TutorOrchestrator } from "../ai/tutor-orchestrator.js";
import type { KnowledgeRetriever } from "../knowledge/knowledge-retriever.js";
import type { LearningEngine, LearningRequest, LearningResult, LearningSession, LearningStage } from "./domain.js";
import { LearningError } from "./learning-errors.js";
import { normalizeLearningRequest } from "./learning-request.js";
import type { LearningPersistence, SourceMaterialRepository } from "./repositories.js";
import { determineStage, getStagePolicy } from "./stage-machine.js";
import { knowledgeSourceMaterials } from "./knowledge-source-material.js";
import { orderConversationMessages } from "./message-order.js";

export interface LearningEngineDependencies {
  orchestrator: TutorOrchestrator;
  persistence: LearningPersistence;
  materials?: SourceMaterialRepository;
  knowledgeRetriever?: KnowledgeRetriever;
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

  async process(input: LearningRequest, options: { expectedVersion?: number } = {}): Promise<LearningResult> {
    const request = normalizeLearningRequest(input);
    const { persistence, orchestrator } = this.dependencies;
    const previous = await persistence.sessions.findById(request.sessionId);
    if (options.expectedVersion !== undefined && (previous?.version ?? null) !== options.expectedVersion) {
      throw new LearningError("SESSION_CONFLICT");
    }
    const messages = await persistence.messages.findBySessionId(request.sessionId);
    const stage = determineStage(previous, request.action, this.dependencies.initialStage);
    const policy = getStagePolicy(stage);
    const now = this.now().getTime();
    if (!Number.isFinite(now)) throw new Error("Invalid server event timestamp.");
    const previousTime = previous ? Date.parse(previous.updatedAt) : Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(previousTime) && previous) throw new Error("Invalid session event timestamp.");
    const latestConversationTime = messages.reduce((latest, message) => {
      const timestamp = Date.parse(message.orderingTimestamp ?? message.createdAt);
      if (!Number.isFinite(timestamp)) throw new Error("Invalid persisted message timestamp.");
      return Math.max(latest, timestamp);
    }, Number.NEGATIVE_INFINITY);
    const userTime = Math.max(now, previousTime + 1, latestConversationTime + 1);
    const userTimestamp = new Date(userTime).toISOString();
    const tutorTimestamp = new Date(userTime + 1).toISOString();
    const session: LearningSession = {
      id: request.sessionId,
      state: stage === "REVIEW" ? "COMPLETED" : stage === "DIAGNOSE" ? "PRE_TEST" : stage === "ASSESS" ? "POST_TEST" : "LEARNING",
      lifecycleState: stage === "REVIEW" ? "COMPLETED" : "ACTIVE",
      stage,
      learningGoal: request.learningGoal ?? previous?.learningGoal,
      subject: request.subject ?? previous?.subject,
      progress: policy.progress,
      version: (previous?.version ?? 0) + 1,
      createdAt: previous?.createdAt ?? userTimestamp,
      updatedAt: tutorTimestamp,
    };
    const context = await this.buildContext(request, session, policy.outputStage, messages);
    let result: LearningResult;
    try {
      result = await orchestrator.generate(context);
    } catch (error) {
      const boundaryError = error instanceof AIBoundaryError ? error : normalizeProviderFailure(error);
      // Retain the last successful stage; never persist rejected model content.
      const failedSession: LearningSession = previous
        ? { ...previous, lifecycleState: "FAILED", version: session.version, updatedAt: tutorTimestamp }
        : { ...session, lifecycleState: "FAILED" };
      // A concurrent successful commit wins over this stale failure.
      await persistence.commit({ session: failedSession, messages: [], expectedVersion: previous?.version ?? null });
      throw boundaryError;
    }
    const committed = await persistence.commit({
      session,
      expectedVersion: previous?.version ?? null,
      messages: [
        { id: this.idFactory(), sessionId: session.id, createdAt: userTimestamp, role: "USER", content: request.userInput },
        { id: result.responseId, sessionId: session.id, createdAt: tutorTimestamp, role: "TUTOR", content: result },
      ],
    });
    if (!committed) throw new LearningError("SESSION_CONFLICT");
    return result;
  }

  private async buildContext(
    request: LearningRequest,
    session: LearningSession,
    outputStage: TutorContext["outputStage"],
    messages: Awaited<ReturnType<LearningPersistence["messages"]["findBySessionId"]>>,
  ): Promise<TutorContext> {
    const { persistence, materials, knowledgeRetriever } = this.dependencies;
    const orderedMessages = orderConversationMessages(messages);
    const tutoringMessages = orderedMessages.filter(message => message.role !== "SYSTEM");
    const retrieve = async () => {
      try {
        const references = await knowledgeRetriever?.retrieve({
          studentInput: request.userInput, subject: session.subject,
          previousStudentInputs: orderedMessages.filter(message => message.role === "USER")
            .slice(-4).map(message => message.content as string),
        }) ?? [];
        return knowledgeSourceMaterials(references);
      } catch {
        // Artifact/adapter failures are not provider failures and must not end the session.
        throw new LearningError("KNOWLEDGE_UNAVAILABLE");
      }
    };
    const [sessionMaterials, knowledgeMaterials] = await Promise.all([
      materials?.findBySessionId(session.id) ?? Promise.resolve([]),
      retrieve(),
    ]);
    const sourceMaterials = [...sessionMaterials, ...knowledgeMaterials];
    if (new Set(sourceMaterials.map((source) => source.citation.id)).size !== sourceMaterials.length) {
      throw new LearningError("KNOWLEDGE_UNAVAILABLE");
    }
    return {
      sessionId: session.id,
      responseId: this.idFactory(),
      stage: session.stage,
      outputStage,
      progress: structuredClone(session.progress),
      studentInput: request.userInput,
      learningGoal: session.learningGoal,
      subject: session.subject,
      previousMessages: tutoringMessages.slice(-20).map((message) => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.role === "USER" ? message.content : JSON.stringify(message.content),
      })),
      sourceMaterials,
    };
  }
}
