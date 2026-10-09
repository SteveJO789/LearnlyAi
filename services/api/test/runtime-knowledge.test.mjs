import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { LocalReviewedKnowledgeReader, OHMS_LAW_CONCEPT_ID } from "../dist/modules/knowledge/reviewed-knowledge-reader.js";
import { LocalKnowledgeRetriever } from "../dist/modules/knowledge/local-knowledge-retriever.js";
import { MockModelProvider } from "../dist/modules/ai/providers/mock-model-provider.js";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";
import { InMemoryLearningPersistence } from "../dist/modules/learning/in-memory-repositories.js";
import { createLearningEngine } from "../dist/modules/learning/create-learning-engine.js";
import { withTestServer } from "./learning-test-helpers.mjs";

const root = fileURLToPath(new URL("../runtime-knowledge/", import.meta.url));
const pilotPath = "build/concepts/physics/electricity/ohms-law.json";
const passageId = `${OHMS_LAW_CONCEPT_ID}@0.2.0:teaching-v1`;
const post = (base) => fetch(`${base}/api/learning/respond`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ sessionId: "prepared-runtime-smoke", input: "Explain Ohm's law", subject: "physics" }),
});

test("prepared real runtime release is reviewed Ohm's Law 0.2.0 and supports match/no-match", async () => {
  const document = JSON.parse(readFileSync(join(root, pilotPath), "utf8"));
  assert.equal(document.id, OHMS_LAW_CONCEPT_ID);
  assert.equal(document.version, "0.2.0");
  assert.equal(document.status, "reviewed");
  assert.equal(document.review.math_physics_reviewed, true);
  assert.equal(document.review.language_reviewed, true);
  assert.equal(document.curation, undefined);
  const reader = new LocalReviewedKnowledgeReader(root);
  assert.equal((await reader.readPilot()).passageId, passageId);
  const retriever = new LocalKnowledgeRetriever(reader);
  assert.equal((await retriever.retrieve({ studentInput: "Explain Ohm's law" }))[0].conceptVersion, "0.2.0");
  assert.deepEqual(await retriever.retrieve({ studentInput: "Explain photosynthesis" }), []);
});

test("default module-relative runtime works from an unrelated cwd through engine, mock, HTTP and citations", async () => {
  // Separate process test files make this cwd/environment change local to this test runner.
  const previousCwd = process.cwd();
  const previousRoot = process.env.KNOWLEDGE_ROOT;
  try {
    process.chdir(tmpdir());
    delete process.env.KNOWLEDGE_ROOT;
    const engine = createLearningEngine({ modelProvider: new MockModelProvider({ scenario: mockTutorScenario }) });
    await withTestServer({ learningEngine: engine }, async (base) => {
      const response = await post(base);
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.deepEqual(validateTutorOutput(data), { valid: true, errors: [] });
      assert.equal(data.citations[0].id, passageId);
      assert.deepEqual(data.blocks[0].citationIds, [passageId]);
      assert.doesNotMatch(JSON.stringify(data), /normalized\/|raw\/|Detailed Provenance/u);
    });
  } finally {
    process.chdir(previousCwd);
    if (previousRoot === undefined) delete process.env.KNOWLEDGE_ROOT;
    else process.env.KNOWLEDGE_ROOT = previousRoot;
  }
});

for (const mode of ["missing", "invalid"]) {
  test(`${mode} prepared artifact returns HTTP 503 with zero model calls/persistence writes`, async (t) => {
    const scratch = mkdtempSync(join(tmpdir(), "learnly-runtime-failure-"));
    t.after(() => rmSync(scratch, { recursive: true, force: true }));
    if (mode === "invalid") {
      cpSync(root, scratch, { recursive: true });
      writeFileSync(join(scratch, pilotPath), "{invalid JSON");
    }
    let modelCalls = 0;
    let writes = 0;
    const persistence = new InMemoryLearningPersistence();
    const originalCommit = persistence.commit.bind(persistence);
    persistence.commit = async (...args) => { writes++; return originalCommit(...args); };
    await withTestServer({ knowledgeRoot: scratch, learningPersistence: persistence,
      modelProvider: { generate: async () => { modelCalls++; throw new Error("unexpected model call"); } },
    }, async (base) => {
      const response = await post(base);
      assert.equal(response.status, 503);
      const { error } = await response.json();
      assert.equal(error.code, "KNOWLEDGE_UNAVAILABLE");
      assert.deepEqual(error.details, []);
      assert.doesNotMatch(JSON.stringify(error), /ENOENT|learnly-runtime|ohms-law\.json|stack/u);
    });
    assert.equal(modelCalls, 0);
    assert.equal(writes, 0);
    assert.equal(await persistence.sessions.findById("prepared-runtime-smoke"), null);
    assert.deepEqual(await persistence.messages.findBySessionId("prepared-runtime-smoke"), []);
  });
}
