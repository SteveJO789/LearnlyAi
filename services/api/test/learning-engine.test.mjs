import assert from "node:assert/strict";
import test from "node:test";
import { AIBoundaryError } from "../dist/modules/ai/ai-boundary-error.js";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { ModelProviderError } from "../dist/modules/ai/providers/model-provider-errors.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";
import { LearningError } from "../dist/modules/learning/learning-errors.js";
import { createHarness, sampleRequest } from "./learning-test-helpers.mjs";

test("valid input returns canonical validated output and commits a complete turn", async () => {
  const { engine, persistence, requests } = createHarness();
  const output = await engine.process({ ...sampleRequest, learningGoal: "Solve linear equations", subject: "math" });
  assert.deepEqual(validateTutorOutput(output), { valid: true, errors: [] });
  assert.equal(output.sessionId, sampleRequest.sessionId);
  assert.equal(output.stage, "LEARNING");
  assert.match(output.blocks[0].content, /x = 3/);
  assert.deepEqual(output.citations, []);
  const session = await persistence.sessions.findById(sampleRequest.sessionId);
  assert.equal(session.stage, "EXPLAIN");
  assert.equal(session.state, "LEARNING");
  assert.equal(session.lifecycleState, "ACTIVE");
  assert.equal(session.version, 1);
  assert.equal(session.learningGoal, "Solve linear equations");
  const messages = await persistence.messages.findBySessionId(sampleRequest.sessionId);
  assert.deepEqual(messages.map((message) => message.role), ["USER", "TUTOR"]);
  assert.deepEqual(messages[1].content, output);
  assert.equal(requests[0].responseFormat.type, "json_object");
});

for (const [name, change] of [
  ["empty input", { userInput: "" }],
  ["whitespace input", { userInput: " \n\t " }],
  ["non-string input", { userInput: 42 }],
  ["oversized input", { userInput: "x".repeat(8001) }],
  ["blank session", { sessionId: " " }],
  ["null action", { action: null }],
  ["invalid action", { action: "SKIP" }],
  ["blank goal", { learningGoal: " " }],
]) {
  test(`${name} is rejected before the provider or persistence is used`, async () => {
    const { engine, persistence, requests } = createHarness();
    await assert.rejects(engine.process({ ...sampleRequest, ...change }), (error) => error instanceof LearningError && error.code === "VALIDATION_ERROR");
    assert.equal(requests.length, 0);
    assert.equal(await persistence.sessions.findById(sampleRequest.sessionId), null);
  });
}

for (const [name, mutate] of [
  ["valid JSON", (output) => JSON.stringify(output)],
  ["malformed JSON", () => "{not valid JSON"],
  ["schema-invalid JSON", (output) => { delete output.blocks; return output; }],
  ["unknown block citationId", (output) => { output.blocks[0].citationIds = ["missing-source"]; return output; }],
  ["fabricated source", (output) => { output.citations = [{ id: "fake", title: "Invented", sourceType: "USER_MATERIAL" }]; return output; }],
  ["wrong sessionId", (output) => { output.sessionId = "another-session"; return output; }],
  ["wrong responseId", (output) => { output.responseId = "replayed-response"; return output; }],
  ["wrong stage", (output) => { output.stage = "COMPLETED"; return output; }],
  ["model-controlled progress", (output) => { output.progress.percent = 100; return output; }],
]) {
  test(`orchestration ${name === "valid JSON" ? "accepts" : "rejects"} ${name}`, async () => {
    const { engine, persistence } = createHarness({ scenario: (request) => mutate(mockTutorScenario(request)) });
    if (name === "valid JSON") {
      assert.equal((await engine.process(sampleRequest)).schemaVersion, "1.0");
    } else {
      await assert.rejects(engine.process(sampleRequest), (error) => error instanceof AIBoundaryError && error.code === "AI_INVALID_OUTPUT");
      assert.deepEqual(await persistence.messages.findBySessionId(sampleRequest.sessionId), []);
      assert.equal((await persistence.sessions.findById(sampleRequest.sessionId)).lifecycleState, "FAILED");
    }
  });
}

test("supplied material citations survive validation, and changed metadata is rejected", async () => {
  const citation = { id: "material-1", title: "Algebra notes", sourceType: "USER_MATERIAL", page: 1 };
  for (const tamper of [false, true]) {
    const { engine } = createHarness({
      materials: { findBySessionId: async () => [{ citation, content: "Apply equal operations to both sides." }] },
      scenario: (request) => {
        const output = mockTutorScenario(request);
        output.citations = [{ ...citation, title: tamper ? "Fabricated title" : citation.title }];
        output.blocks[0].citationIds = [citation.id];
        return output;
      },
    });
    if (tamper) await assert.rejects(engine.process(sampleRequest), { code: "AI_INVALID_OUTPUT" });
    else assert.deepEqual((await engine.process(sampleRequest)).citations, [citation]);
  }
});

for (const [providerCode, expectedCode] of [
  ["PROVIDER_UNAVAILABLE", "AI_UNAVAILABLE"],
  ["PROVIDER_AUTHENTICATION_ERROR", "AI_UNAVAILABLE"],
  ["PROVIDER_TIMEOUT", "AI_TIMEOUT"],
  ["PROVIDER_RATE_LIMITED", "AI_RATE_LIMITED"],
  ["PROVIDER_INVALID_RESPONSE", "AI_INVALID_OUTPUT"],
  ["PROVIDER_REQUEST_FAILED", "AI_REQUEST_FAILED"],
]) {
  test(`${providerCode} becomes a safe application error`, async () => {
    const raw = new ModelProviderError({ code: providerCode, message: "secret-api-key raw-provider-body", provider: "test", retryable: true, cause: new Error("secret-stack") });
    const { engine } = createHarness({ scenario: () => { throw raw; } });
    await assert.rejects(engine.process(sampleRequest), (error) => {
      assert.ok(error instanceof AIBoundaryError);
      assert.equal(error.code, expectedCode);
      assert.equal(error.cause, raw);
      assert.doesNotMatch(error.message + JSON.stringify(error), /secret|raw-provider/);
      return true;
    });
  });
}

test("unexpected provider errors are normalized and never exposed by the engine", async () => {
  const { engine } = createHarness({ scenario: () => { throw new Error("private-token provider-debug"); } });
  await assert.rejects(engine.process(sampleRequest), (error) => {
    assert.equal(error.code, "AI_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(error) + error.message, /private-token|provider-debug/);
    return true;
  });
});

test("history, goal, and subject are reused, while ordinary responses stay at EXPLAIN", async () => {
  const { engine, persistence, requests } = createHarness();
  const first = await engine.process({ ...sampleRequest, learningGoal: "Algebra", subject: "math" });
  const second = await engine.process({ ...sampleRequest, userInput: "ทำไมต้องลบทั้งสองข้าง?" });
  assert.notEqual(first.responseId, second.responseId);
  assert.deepEqual(requests[1].messages.slice(1, 3).map((message) => message.role), ["user", "assistant"]);
  assert.equal(JSON.parse(requests[1].messages[2].content).responseId, first.responseId);
  const task = JSON.parse(requests[1].messages.at(-1).content);
  assert.equal(task.learningGoal, "Algebra");
  assert.equal(task.subject, "math");
  assert.equal(task.stage, "EXPLAIN");
  assert.equal((await persistence.sessions.findById(sampleRequest.sessionId)).version, 2);
});

test("separate session IDs never share conversation history", async () => {
  const { engine, requests } = createHarness();
  await engine.process(sampleRequest);
  await engine.process({ ...sampleRequest, sessionId: "other-session" });
  assert.equal(requests[1].messages.length, 2);
});

test("explicit advances follow all five stages and REVIEW completes the session", async () => {
  const { engine, persistence } = createHarness({ initialStage: "DIAGNOSE" });
  const stages = ["DIAGNOSE", "EXPLAIN", "PRACTICE", "ASSESS", "REVIEW"];
  const contractStages = ["PRE_TEST", "LEARNING", "LEARNING", "POST_TEST", "COMPLETED"];
  for (let index = 0; index < stages.length; index++) {
    const result = await engine.process({ ...sampleRequest, action: index ? "ADVANCE" : "RESPOND" });
    assert.equal(result.stage, contractStages[index]);
    const session = await persistence.sessions.findById(sampleRequest.sessionId);
    assert.equal(session.stage, stages[index]);
    assert.equal(session.state, contractStages[index]);
    assert.equal(session.lifecycleState, index === 4 ? "COMPLETED" : "ACTIVE");
  }
  await assert.rejects(engine.process(sampleRequest), { code: "SESSION_INACTIVE" });
  assert.equal((await persistence.messages.findBySessionId(sampleRequest.sessionId)).length, 10);
});

test("cannot advance an unknown session or one whose progress forbids advance", async () => {
  const { engine, persistence, requests } = createHarness();
  await assert.rejects(engine.process({ ...sampleRequest, action: "ADVANCE" }), { code: "INVALID_STAGE_TRANSITION" });
  assert.equal(requests.length, 0);
  await engine.process(sampleRequest);
  const session = await persistence.sessions.findById(sampleRequest.sessionId);
  session.progress.canAdvance = false;
  await persistence.sessions.save(session);
  await assert.rejects(engine.process({ ...sampleRequest, action: "ADVANCE" }), { code: "INVALID_STAGE_TRANSITION" });
  assert.equal(requests.length, 1);
});

test("failure retains the successful stage and history and prevents more terminal-session calls", async () => {
  let fail = false;
  const { engine, persistence, requests } = createHarness({ scenario: (request) => fail ? "bad-json" : mockTutorScenario(request) });
  await engine.process(sampleRequest);
  fail = true;
  await assert.rejects(engine.process({ ...sampleRequest, action: "ADVANCE" }), { code: "AI_INVALID_OUTPUT" });
  const session = await persistence.sessions.findById(sampleRequest.sessionId);
  assert.equal(session.stage, "EXPLAIN");
  assert.equal(session.state, "LEARNING");
  assert.equal(session.lifecycleState, "FAILED");
  assert.equal((await persistence.messages.findBySessionId(sampleRequest.sessionId)).length, 2);
  await assert.rejects(engine.process(sampleRequest), { code: "SESSION_INACTIVE" });
  assert.equal(requests.length, 2);
});

test("concurrent requests commit one complete turn and reject stale work", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let arrived = 0;
  const { engine, persistence } = createHarness({ scenario: async (request) => {
    if (++arrived === 2) release();
    await gate;
    return mockTutorScenario(request);
  } });
  const results = await Promise.allSettled([engine.process(sampleRequest), engine.process(sampleRequest)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "SESSION_CONFLICT");
  assert.equal((await persistence.messages.findBySessionId(sampleRequest.sessionId)).length, 2);
  assert.equal((await persistence.sessions.findById(sampleRequest.sessionId)).version, 1);
});

test("a stale provider failure cannot mark a concurrently committed session FAILED", async () => {
  let releaseFailure;
  const failureGate = new Promise((resolve) => { releaseFailure = resolve; });
  let firstArrived;
  const firstGate = new Promise((resolve) => { firstArrived = resolve; });
  let calls = 0;
  const { engine, persistence } = createHarness({ scenario: async (request) => {
    if (++calls === 1) { firstArrived(); await failureGate; throw new Error("provider failed"); }
    return mockTutorScenario(request);
  } });
  const failure = assert.rejects(engine.process(sampleRequest), { code: "AI_UNAVAILABLE" });
  await firstGate;
  await engine.process(sampleRequest);
  releaseFailure();
  await failure;
  assert.equal((await persistence.sessions.findById(sampleRequest.sessionId)).lifecycleState, "ACTIVE");
  assert.equal((await persistence.messages.findBySessionId(sampleRequest.sessionId)).length, 2);
});
