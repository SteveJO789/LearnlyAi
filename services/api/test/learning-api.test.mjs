import assert from "node:assert/strict";
import test from "node:test";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { ModelProviderError } from "../dist/modules/ai/providers/model-provider-errors.js";
import { OpenRouterModelProvider } from "../dist/modules/ai/providers/openrouter-model-provider.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";
import { createHarness, withTestServer } from "./learning-test-helpers.mjs";

// Exercise the default composition while guaranteeing no external provider calls.
process.env.AI_PROVIDER = "mock";

const body = { sessionId: "test-session", input: "แก้สมการ 2x + 4 = 10" };
const post = (url, data = body) => fetch(url, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
});

test("default mock HTTP vertical slice returns the canonical contract at both paths", async () => {
  await withTestServer({}, async (baseUrl) => {
    for (const path of ["/api/learning/respond", "/api/v1/learning/respond"]) {
      const response = await post(baseUrl + path);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("x-request-id"));
      const payload = await response.json();
      assert.deepEqual(Object.keys(payload), ["data"]);
      assert.deepEqual(validateTutorOutput(payload.data), { valid: true, errors: [] });
      assert.equal(payload.data.sessionId, body.sessionId);
      assert.equal(payload.data.stage, "LEARNING");
      assert.match(payload.data.blocks[0].content, /x = 3/);
    }
  });
});

test("HTTP to OpenRouter adapter to validation works with an injected offline transport", async () => {
  let calls = 0;
  const provider = new OpenRouterModelProvider(
    { apiKey: "test-only-key", model: "test-tutor-model", baseUrl: "https://openrouter.test/api/v1", maxRetries: 0 },
    { fetch: async (url, init) => {
      calls++;
      assert.equal(url, "https://openrouter.test/api/v1/chat/completions");
      const request = JSON.parse(init.body);
      assert.equal(request.response_format.type, "json_object");
      assert.match(request.messages[0].content, /Learnly AI Structured Tutor Output/);
      const output = mockTutorScenario({ messages: request.messages });
      return Response.json({
        id: "transport-request-id", model: "test-tutor-model",
        choices: [{ message: { content: JSON.stringify(output) }, finish_reason: "stop" }],
      });
    } },
  );
  await withTestServer({ modelProvider: provider }, async (baseUrl) => {
    const response = await post(baseUrl + "/api/learning/respond");
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(validateTutorOutput(payload.data), { valid: true, errors: [] });
    assert.equal(payload.data.sessionId, body.sessionId);
    assert.doesNotMatch(JSON.stringify(payload), /test-only-key|transport-request-id|test-tutor-model/);
  });
  assert.equal(calls, 1);
});

test("HTTP input validation returns 400 without invoking the model", async () => {
  const { engine, requests } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    for (const value of [
      { ...body, input: " " }, { input: body.input }, { ...body, input: 42 },
      { ...body, input: "x".repeat(8001) }, { ...body, stage: "REVIEW" },
      { ...body, action: "SKIP" }, { ...body, action: null }, [body],
    ]) {
      const response = await post(baseUrl + "/api/learning/respond", value);
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.equal(payload.error.code, "VALIDATION_ERROR");
      assert.equal(payload.error.requestId, response.headers.get("x-request-id"));
      assert.doesNotMatch(JSON.stringify(payload), /stack|userInput/);
    }
    assert.equal(requests.length, 0);
  });
});

test("invalid subjects identify /subject, preserve the active conversation, and never invoke the model", async () => {
  const { engine, persistence, requests } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const url = baseUrl + "/api/learning/respond";
    assert.equal((await post(url, { ...body, subject: "math" })).status, 200);
    const before = await persistence.sessions.findById(body.sessionId);
    const history = await persistence.messages.findBySessionId(body.sessionId);
    for (const subject of ["", " \t ", null, 42, [], {}, "x".repeat(129)]) {
      const response = await post(url, { ...body, subject });
      assert.equal(response.status, 400);
      const payload = await response.json();
      assert.equal(payload.error.code, "VALIDATION_ERROR");
      assert.equal(payload.error.details[0].path, "/subject");
      assert.equal(payload.error.requestId, response.headers.get("x-request-id"));
    }
    assert.equal(requests.length, 1);
    assert.deepEqual(await persistence.sessions.findById(body.sessionId), before);
    assert.deepEqual(await persistence.messages.findBySessionId(body.sessionId), history);
    // Subject is optional free text in the current contract, not a subject enum.
    assert.equal((await post(url, { ...body, subject: "robotics" })).status, 200);
    assert.equal((await post(url)).status, 200);
  });
});

test("missing sessionId identifies /sessionId and does not create a conversation", async () => {
  const { engine, persistence, requests } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const response = await post(baseUrl + "/api/learning/respond", { input: body.input, subject: "math" });
    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.error.code, "VALIDATION_ERROR");
    assert.equal(payload.error.details[0].path, "/sessionId");
    assert.equal(requests.length, 0);
    assert.deepEqual(await persistence.messages.findBySessionId(body.sessionId), []);
  });
});

test("two HTTP turns preserve the conversation, learning goal, and subject in the next model request", async () => {
  const { engine, persistence, requests } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const url = baseUrl + "/api/learning/respond";
    const firstResponse = await post(url, { ...body, subject: "math", learningGoal: "เข้าใจวิธีแก้สมการเชิงเส้น" });
    assert.equal(firstResponse.status, 200);
    const first = (await firstResponse.json()).data;
    const followup = "ทำไมต้องลบ 4 ทั้งสองข้าง";
    const secondResponse = await post(url, { sessionId: body.sessionId, input: followup });
    assert.equal(secondResponse.status, 200);
    const second = (await secondResponse.json()).data;
    assert.notEqual(first.responseId, second.responseId);
    const prompt = requests[1].messages;
    assert.equal(prompt[1].content, body.input);
    assert.deepEqual(JSON.parse(prompt[2].content), first);
    const task = JSON.parse(prompt.at(-1).content);
    assert.equal(task.studentInput, followup);
    assert.equal(task.learningGoal, "เข้าใจวิธีแก้สมการเชิงเส้น");
    assert.equal(task.subject, "math");
    assert.equal(task.stage, "EXPLAIN");
    assert.equal(task.outputStage, "LEARNING");
    const history = await persistence.messages.findBySessionId(body.sessionId);
    assert.deepEqual(history.map((message) => message.role), ["USER", "TUTOR", "USER", "TUTOR"]);
    assert.deepEqual(history[3].content, second);
  });
});

test("invalid JSON, unsupported content type, and excessive body size use safe envelopes", async () => {
  const { engine, requests } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const url = baseUrl + "/api/learning/respond";
    for (const [contentType, text, status, code] of [
      ["application/json", '{"secret":"private-token",', 400, "VALIDATION_ERROR"],
      ["text/plain", "private-token", 415, "UNSUPPORTED_MEDIA_TYPE"],
      ["application/json", JSON.stringify({ ...body, input: "x".repeat(1024 * 1024) }), 413, "PAYLOAD_TOO_LARGE"],
    ]) {
      const response = await fetch(url, { method: "POST", headers: { "content-type": contentType }, body: text });
      assert.equal(response.status, status);
      const payload = await response.json();
      assert.equal(payload.error.code, code);
      assert.ok(payload.error.requestId);
      assert.doesNotMatch(JSON.stringify(payload), /private-token|SyntaxError|stack/);
    }
    assert.equal(requests.length, 0);
  });
});

for (const [name, scenario] of [
  ["invalid JSON", () => "private-token invalid-json"],
  ["invalid schema", (request) => ({ ...mockTutorScenario(request), blocks: [] })],
  ["unresolved citation", (request) => {
    const output = mockTutorScenario(request);
    output.blocks[0].citationIds = ["secret-citation-id"];
    return output;
  }],
]) {
  test(`${name} returns AI_INVALID_OUTPUT and persists no rejected content`, async () => {
    const { engine, persistence } = createHarness({ scenario });
    await withTestServer({ learningEngine: engine }, async (baseUrl) => {
      const response = await post(baseUrl + "/api/learning/respond");
      assert.equal(response.status, 502);
      const payload = await response.json();
      assert.equal(payload.error.code, "AI_INVALID_OUTPUT");
      assert.deepEqual(payload.error.details, []);
      assert.doesNotMatch(JSON.stringify(payload), /private-token|secret-citation-id|keyword|stack|cause/);
    });
    assert.deepEqual(await persistence.messages.findBySessionId(body.sessionId), []);
  });
}

for (const [providerCode, code, status] of [
  ["PROVIDER_TIMEOUT", "AI_TIMEOUT", 504],
  ["PROVIDER_RATE_LIMITED", "AI_RATE_LIMITED", 429],
  ["PROVIDER_UNAVAILABLE", "AI_UNAVAILABLE", 503],
  ["PROVIDER_AUTHENTICATION_ERROR", "AI_UNAVAILABLE", 503],
]) {
  test(`${providerCode} has a normalized HTTP status and no raw provider data`, async () => {
    const { engine } = createHarness({ scenario: () => {
      throw new ModelProviderError({ code: providerCode, message: "private-api-key raw-provider-debug", provider: "openrouter", retryable: true, cause: new Error("private-token") });
    } });
    await withTestServer({ learningEngine: engine }, async (baseUrl) => {
      const response = await post(baseUrl + "/api/learning/respond");
      assert.equal(response.status, status);
      const payload = await response.json();
      assert.equal(payload.error.code, code);
      assert.doesNotMatch(JSON.stringify(payload), /private|provider-debug|openrouter|cause|stack/);
      assert.equal(payload.error.requestId, response.headers.get("x-request-id"));
    });
  });
}

test("repository failures return a generic 500 without internal details", async () => {
  const { engine, persistence } = createHarness();
  persistence.commit = async () => { throw new Error("private-database-url internal-stack"); };
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const response = await post(baseUrl + "/api/learning/respond");
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.error.code, "INTERNAL_ERROR");
    assert.doesNotMatch(JSON.stringify(payload), /private-database-url|internal-stack/);
  });
});

test("HTTP ADVANCE moves EXPLAIN to PRACTICE and ordinary turns keep the current stage", async () => {
  const { engine, persistence } = createHarness();
  await withTestServer({ learningEngine: engine }, async (baseUrl) => {
    const url = baseUrl + "/api/learning/respond";
    assert.equal((await post(url, { ...body, action: "ADVANCE" })).status, 400);
    assert.equal((await post(url)).status, 200);
    const response = await post(url, { ...body, input: "ขอแบบฝึกหัด", action: "ADVANCE" });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.blocks[0].type, "quiz");
    assert.equal((await persistence.sessions.findById(body.sessionId)).stage, "PRACTICE");
    await post(url);
    assert.equal((await persistence.sessions.findById(body.sessionId)).stage, "PRACTICE");
  });
});
