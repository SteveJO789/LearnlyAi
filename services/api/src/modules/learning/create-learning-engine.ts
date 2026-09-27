import { mockTutorScenario } from "../ai/mock-tutor-scenario.js";
import { createModelProvider, loadModelProviderConfig } from "../ai/providers/create-model-provider.js";
import type { ModelProvider } from "../ai/providers/model-provider.js";
import { DefaultTutorOrchestrator } from "../ai/tutor-orchestrator.js";
import { DefaultLearningEngine } from "./default-learning-engine.js";
import { InMemoryLearningPersistence } from "./in-memory-repositories.js";
import type { LearningPersistence } from "./repositories.js";

export interface CreateLearningEngineOptions {
  modelProvider?: ModelProvider;
  learningPersistence?: LearningPersistence;
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
  });
}
