import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MockModelProvider } from "../dist/modules/ai/providers/mock-model-provider.js";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { LocalKnowledgeRetriever } from "../dist/modules/knowledge/local-knowledge-retriever.js";
import { LocalReviewedKnowledgeReader } from "../dist/modules/knowledge/reviewed-knowledge-reader.js";
import { dataset, runtimeRoot, createEvaluationHarness, framingChecks, screenFacts, sanitize, retrievalMetrics } from "../evaluation/rag/helpers.mjs";

const mock = (mutate) => new MockModelProvider({ scenario: (request) => {
  const output = mockTutorScenario(request);
  mutate?.(output);
  return output;
} });
const request = { sessionId: "offline-p3", userInput: "Explain Ohm's law." };

test("P3 dataset is explicit, bounded and covers core, conversation, support and security targets", () => {
  const ids = dataset.scenarios.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "M1", "M2", "S1", "U1"]) assert.ok(ids.includes(id));
  for (const scenario of dataset.scenarios) {
    for (const key of ["id", "category", "input", "expectedRetrieval", "expectedConceptId", "expectedVersion", "expectedCitationRequirement", "evaluationCriteria"]) assert.ok(key in scenario);
    assert.ok(scenario.repetitions >= 1 && scenario.repetitions <= 3);
  }
  assert.equal(dataset.scenarios.reduce((total, scenario) => total + scenario.repetitions * (scenario.followUp ? 2 : 1), 0), 23);
});

test("P3 core retrieval uses the prepared real reviewed release; precision limitations are measured", async (t) => {
  const retriever = new LocalKnowledgeRetriever(new LocalReviewedKnowledgeReader(runtimeRoot));
  const records = [];
  for (const scenario of dataset.scenarios.filter((item) => /^R[1-7]$/u.test(item.id))) {
    const found = await retriever.retrieve({ studentInput: scenario.input });
    const actual = found.length > 0;
    if (["R1", "R2", "R3", "R4"].includes(scenario.id)) {
      assert.equal(actual, true);
      assert.equal(found[0].conceptId, dataset.knowledge.conceptId);
      assert.equal(found[0].conceptVersion, dataset.knowledge.version);
    }
    if (scenario.id === "R5") assert.equal(actual, false);
    records.push({ id: scenario.id, expected: scenario.expectedRetrieval, actual });
  }
  t.diagnostic(JSON.stringify({ category: "OFFLINE_DETERMINISTIC", retrieval: records, metrics: retrievalMetrics(records) }));
});

test("hostile Knowledge stays in bounded reference JSON and cannot create a system role", async () => {
  const harness = createEvaluationHarness(mock(), { hostile: true });
  await harness.engine.process(request);
  assert.deepEqual(framingChecks(harness.requests[0]), {
    referenceOnly: true, noSystemContamination: true, rolesIntact: true, bounded: true,
  });
  assert.ok(harness.requests[0].messages.at(-1).content.includes("REFERENCE_ROLE_ATTACK"));
});

test("no-match fabricated trusted citation is rejected by the real orchestration validator", async () => {
  const harness = createEvaluationHarness(mock((output) => {
    output.citations = [{ id: "fabricated-knowledge", title: "Invented source", sourceType: "TRUSTED_KNOWLEDGE_BASE" }];
    output.blocks[0].citationIds = ["fabricated-knowledge"];
  }));
  await assert.rejects(harness.engine.process({ ...request, userInput: "Explain photosynthesis." }), (error) => error.code === "AI_INVALID_OUTPUT");
  assert.deepEqual(await harness.persistence.messages.findBySessionId(request.sessionId), []);
  assert.equal(harness.generations[0].citations.identity, false);
});

test("stale citation identity is rejected without repairing the model output", async () => {
  const harness = createEvaluationHarness(mock((output) => {
    output.citations[0].id = output.citations[0].id.replace("@0.2.0", "@0.1.0");
    output.blocks[0].citationIds = [output.citations[0].id];
  }));
  await assert.rejects(harness.engine.process(request), (error) => error.code === "AI_INVALID_OUTPUT");
  assert.deepEqual(await harness.persistence.messages.findBySessionId(request.sessionId), []);
  assert.equal(harness.generations[0].citations.identity, false);
});

test("multi-turn evaluator observes real history, current references and no stale authorization", async () => {
  const harness = createEvaluationHarness(mock());
  await harness.engine.process(request);
  const next = await harness.engine.process({ ...request, userInput: "What if resistance doubles?" });
  assert.deepEqual(harness.requests[1].messages.map((message) => message.role), ["system", "user", "assistant", "user"]);
  assert.equal(harness.retrievals[1].found.length, 0);
  assert.deepEqual(next.citations, []);
  const lastTask = JSON.parse(harness.requests[1].messages.at(-1).content);
  assert.deepEqual(lastTask.sourceMaterials, []);
});

test("missing retrieval artifact still prevents any provider call or persistence write", async (t) => {
  const missing = mkdtempSync(join(tmpdir(), "learnly-p3-missing-"));
  t.after(() => rmSync(missing, { recursive: true, force: true }));
  const harness = createEvaluationHarness(mock(), { root: missing });
  await assert.rejects(harness.engine.process(request), (error) => error.code === "KNOWLEDGE_UNAVAILABLE" && error.status === 503);
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.writes(), 0);
});

test("calculation screening recognizes LaTeX and flags known wrong values/units without claiming entailment", () => {
  const screen = (content) => screenFacts({ blocks: [{ content }] });
  const correct = screen("V = I \\times R; I = 2\\,\\mathrm{A}; R = 20\\,\\Omega; V = 40\\,\\mathrm{V}");
  assert.equal(correct.formulaPresent, true);
  assert.equal(correct.current2A, true);
  assert.equal(correct.resistance20Ohm, true);
  assert.equal(correct.voltage40V, true);
  for (const answer of ["22 V", "40 A", "0.1 V"]) assert.equal(screen(answer).suspiciousVoltage, true);
});

test("evaluation sanitizer redacts credentials and authorization-like strings", () => {
  const secret = "private-credential-for-offline-test";
  const cleaned = sanitize({ nested: [`value=${secret}`, "Bearer private-header-value", "sk-or-v1-abcdefghijklmnopqrstuv"] }, { OPENROUTER_API_KEY: secret });
  assert.doesNotMatch(JSON.stringify(cleaned), /private-credential|private-header-value|abcdefghijklmnopqrstuv/u);
});
