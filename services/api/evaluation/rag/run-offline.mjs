import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { MockModelProvider } from "../../dist/modules/ai/providers/mock-model-provider.js";
import { mockTutorScenario } from "../../dist/modules/ai/mock-tutor-scenario.js";
import { dataset, createEvaluationHarness, framingChecks, retrievalMetrics } from "./helpers.mjs";

const records = [];
for (const scenario of dataset.scenarios) {
  const harness = createEvaluationHarness(new MockModelProvider({ scenario: mockTutorScenario }), { hostile: Boolean(scenario.fixture) });
  const turns = [scenario, ...(scenario.followUp ? [scenario.followUp] : [])];
  for (let turn = 0; turn < turns.length; turn++) {
    const definition = turns[turn];
    await harness.engine.process({ sessionId: `offline-${scenario.id}`, userInput: definition.input });
    const found = harness.retrievals[turn].found;
    const request = harness.requests[turn];
    const record = { scenarioId: scenario.id, turn: turn + 1, input: definition.input,
      expected: definition.expectedRetrieval, actual: found.length > 0,
      retrieved: found.map((ref) => ({ conceptId: ref.conceptId, version: ref.conceptVersion, passageId: ref.passageId })),
      previousMessageCount: request.messages.length - 2 };
    if (scenario.fixture) {
      record.framing = framingChecks(request);
      assert.ok(Object.values(record.framing).every(Boolean));
    }
    records.push(record);
  }
}
const core = records.filter((record) => /^R[1-7]$/u.test(record.scenarioId));
const summary = { schemaVersion: "1.0", category: "OFFLINE_DETERMINISTIC", knowledge: dataset.knowledge,
  coreRetrieval: retrievalMetrics(core), records,
  warning: "Mock responses establish framing/validator behavior only, not live answer correctness or injection resistance." };
const directory = new URL("../results/rag/", import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL("offline-summary.json", directory), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ category: summary.category, coreRetrieval: summary.coreRetrieval, records: records.length }));
