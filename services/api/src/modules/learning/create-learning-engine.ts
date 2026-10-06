import { fileURLToPath } from "node:url";
import { mockTutorScenario } from "../ai/mock-tutor-scenario.js";
import { createModelProvider, loadModelProviderConfig } from "../ai/providers/create-model-provider.js";
import type { ModelProvider } from "../ai/providers/model-provider.js";
import { DefaultTutorOrchestrator } from "../ai/tutor-orchestrator.js";
import { DefaultLearningEngine } from "./default-learning-engine.js";
import { InMemoryLearningPersistence } from "./in-memory-repositories.js";
import type { LearningPersistence } from "./repositories.js";
import type { KnowledgeRetriever } from "../knowledge/knowledge-retriever.js";
import { LocalKnowledgeRetriever } from "../knowledge/local-knowledge-retriever.js";
import { LocalReviewedKnowledgeReader } from "../knowledge/reviewed-knowledge-reader.js";

export interface CreateLearningEngineOptions {
  modelProvider?: ModelProvider;
  learningPersistence?: LearningPersistence;
  knowledgeRetriever?: KnowledgeRetriever;
  knowledgeRoot?: string;
}

// Composition boundary: provider configuration and concrete repositories live here,
// outside the engine, orchestrator, and route business rules.
export function createLearningEngine(options: CreateLearningEngineOptions = {}): DefaultLearningEngine {
  let provider = options.modelProvider;
  if (!provider) {
    const config = loadModelProviderConfig();
    provider = createModelProvider(config.provider === "mock"
      ? { ...config, mock: { scenario: mockTutorScenario } }
      : config);
  }
  return new DefaultLearningEngine({
    orchestrator: new DefaultTutorOrchestrator(provider),
    persistence: options.learningPersistence ?? new InMemoryLearningPersistence(),
    knowledgeRetriever: options.knowledgeRetriever ?? new LocalKnowledgeRetriever(new LocalReviewedKnowledgeReader(
      options.knowledgeRoot ?? process.env.KNOWLEDGE_ROOT ?? fileURLToPath(new URL("../../../runtime-knowledge/", import.meta.url)),
    )),
  });
}
