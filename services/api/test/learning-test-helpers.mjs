import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../dist/app.js";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { MockModelProvider } from "../dist/modules/ai/providers/mock-model-provider.js";
import { DefaultTutorOrchestrator } from "../dist/modules/ai/tutor-orchestrator.js";
import { DefaultLearningEngine } from "../dist/modules/learning/default-learning-engine.js";
import { InMemoryLearningPersistence } from "../dist/modules/learning/in-memory-repositories.js";

export const sampleRequest = { sessionId: "test-session", userInput: "แก้สมการ 2x + 4 = 10" };

export function createHarness(options = {}) {
  const requests = [];
  const provider = options.provider ?? new MockModelProvider({
    scenario: (request) => {
      requests.push(request);
      return options.scenario ? options.scenario(request) : mockTutorScenario(request);
    },
  });
  const persistence = new InMemoryLearningPersistence();
  let id = 0;
  const engine = new DefaultLearningEngine({
    orchestrator: new DefaultTutorOrchestrator(provider), persistence,
    idFactory: () => `test-id-${++id}`,
    now: () => new Date("2026-09-27T00:00:00Z"),
    initialStage: options.initialStage,
    materials: options.materials,
  });
  return { engine, persistence, requests };
}

export async function withTestServer(options, run) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeIdleConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
