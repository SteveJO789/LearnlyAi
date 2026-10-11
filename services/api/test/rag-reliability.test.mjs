import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MockModelProvider } from "../dist/modules/ai/providers/mock-model-provider.js";
import { OpenRouterModelProvider } from "../dist/modules/ai/providers/openrouter-model-provider.js";
import { mockTutorScenario } from "../dist/modules/ai/mock-tutor-scenario.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";
import { createEvaluationHarness, screenFacts } from "../evaluation/rag/helpers.mjs";

const input = { sessionId: "p3-1-regression", userInput: "Explain Ohm's law." };
const fixture = (mutate) => new MockModelProvider({ scenario: (request) => {
  const output = mockTutorScenario(request);
  mutate?.(output, request);
  return output;
} });
const system = (harness) => harness.requests.at(-1).messages[0].content;

test("P3.1 live dataset preserves repeated first-attempt gates and includes both acknowledgement languages", () => {
  const scenarios = JSON.parse(readFileSync(new URL("../evaluation/rag/scenarios-p3_1.json", import.meta.url), "utf8")).scenarios;
  for (const id of ["R1", "R2", "R3", "R5", "S1"]) assert.equal(scenarios.find((scenario) => scenario.id === id).repetitions, 3);
  for (const id of ["R6", "R7", "M1", "M2", "U1", "A1"]) assert.ok(scenarios.some((scenario) => scenario.id === id));
  assert.equal(scenarios.find((scenario) => scenario.id === "M2").followUp.input, "Thanks.");
  assert.equal(scenarios.find((scenario) => scenario.id === "A1").input, "ขอบคุณ");
  assert.equal(scenarios.reduce((total, scenario) => total + scenario.repetitions * (scenario.followUp ? 2 : 1), 0), 24);
});

test("engine binds all schema-valid metadata echoes without granting the provider workflow authority", async () => {
  const harness = createEvaluationHarness(fixture((output) => {
    output.sessionId = "foreign-session"; output.responseId = "replayed-response";
    output.stage = "COMPLETED";
    output.progress = { percent: 100, canAdvance: false, nextAction: "ANSWER" };
  }));
  const output = await harness.engine.process(input);
  const task = JSON.parse(harness.requests[0].messages.at(-1).content);
  assert.equal(output.sessionId, input.sessionId);
  assert.equal(output.responseId, task.responseId);
  assert.equal(output.stage, "LEARNING");
  assert.deepEqual(output.progress, { percent: 25, canAdvance: true, nextAction: "CONTINUE" });
  assert.equal(validateTutorOutput(output).valid, true);
  const session = await harness.persistence.sessions.findById(input.sessionId);
  assert.equal(session.stage, "EXPLAIN");
  assert.equal(session.lifecycleState, "ACTIVE");
  assert.deepEqual(session.progress, output.progress);
  assert.deepEqual((await harness.persistence.messages.findBySessionId(input.sessionId))[1].content, output);
  // An ordinary second turn still cannot advance the learning state.
  await harness.engine.process({ ...input, userInput: "Continue explaining." });
  assert.equal((await harness.persistence.sessions.findById(input.sessionId)).stage, "EXPLAIN");
});

for (const [name, mutate] of [
  ["missing progress", (output) => { delete output.progress; }],
  ["wrongly typed progress", (output) => { output.progress.canAdvance = "true"; }],
  ["invalid action enum", (output) => { output.progress.nextAction = "SKIP"; }],
  ["blank session", (output) => { output.sessionId = " "; }],
  ["unknown metadata property", (output) => { output.progress.hacked = true; }],
  ["invalid educational content", (output) => { output.blocks[0].content = null; }],
  ["wrong schema version", (output) => { output.schemaVersion = "2.0"; }],
]) {
  test(`metadata binding never repairs ${name}`, async () => {
    const harness = createEvaluationHarness(fixture(mutate));
    await assert.rejects(harness.engine.process(input), { code: "AI_INVALID_OUTPUT" });
    assert.deepEqual(await harness.persistence.messages.findBySessionId(input.sessionId), []);
  });
}

test("response policy bounds blocks, sentences, examples and question/quiz counts without changing the public contract", async () => {
  const harness = createEvaluationHarness(fixture());
  await harness.engine.process(input);
  const prompt = system(harness);
  for (const rule of ["at most 3 blocks", "at most 3 short sentences", "at most 1 worked example", "at most 1 guided question", "at most 1 quiz item", "do not add a quiz or a new exercise unless requested"]) assert.ok(prompt.includes(rule));
  assert.equal(harness.requests[0].maxOutputTokens, 2048);
});

for (const [name, mutate, accepted] of [
  ["plain-text-only citation", (output) => {
    output.blocks[0].content += ` Citation: [${output.citations[0].id}] citationIds: [source-id]`;
    output.blocks[0].citationIds = []; output.citations = [];
  }, false],
  ["top-level citation with only prose linkage", (output) => {
    output.blocks[0].content += ` (${output.citations[0].id})`;
    delete output.blocks[0].citationIds;
  }, false],
  ["missing citation", (output) => { output.citations = []; delete output.blocks[0].citationIds; }, false],
  ["proper structured citation", () => {}, true],
]) {
  test(`${name} is ${accepted ? "accepted" : "rejected"} using real reviewed Knowledge`, async () => {
    const harness = createEvaluationHarness(fixture(mutate));
    if (accepted) {
      const output = await harness.engine.process(input);
      assert.equal(output.blocks[0].citationIds[0], output.citations[0].id);
      assert.ok(output.citations[0].id.includes("@0.2.0:"));
    } else {
      await assert.rejects(harness.engine.process(input), { code: "AI_INVALID_OUTPUT" });
      assert.deepEqual(await harness.persistence.messages.findBySessionId(input.sessionId), []);
    }
    assert.match(system(harness), /Citations belong ONLY in the top-level citations array/);
    assert.match(system(harness), /Never embed that relationship in a content string/);
  });
}

for (const question of ["Who invented Ohm's law and in what exact year?"]) {
  test(`captured prompt limits attribution and absent-detail answers for: ${question}`, async () => {
    const harness = createEvaluationHarness(fixture());
    await harness.engine.process({ ...input, userInput: question });
    assert.equal(harness.retrievals[0].found.length, 1);
    const prompt = system(harness);
    assert.match(prompt, /Every substantive claim in a cited block must be supported by that passage/);
    assert.match(prompt, /Do not combine external\/general model knowledge/);
    assert.match(prompt, /explicitly say that the supplied reference does not establish that detail/);
    assert.match(prompt, /Do not add unsupported equations, historical facts/);
    const passage = JSON.parse(harness.requests[0].messages.at(-1).content).sourceMaterials[0].content;
    assert.ok(passage.includes("V = IR"));
    assert.doesNotMatch(passage, /ε|inventor|1827/u);
  });
}

for (const [language, question, answer] of [
  ["English", "If current is 2 A and resistance is 20 Ω, what is the voltage?", "For an ohmic resistor at constant temperature: V = IR. With I = 2 A and R = 20 Ω, V = 2 × 20 = 40 V. Check: 40 V / 20 Ω = 2 A."],
  ["Thai", "ถ้ากระแสไฟฟ้า 2 A และความต้านทาน 20 Ω แรงดันไฟฟ้าเท่าไร", "เมื่อตัวต้านทานเป็นโอห์มมิกและอุณหภูมิคงที่ ใช้ V = IR โดย I = 2 A และ R = 20 Ω ได้ V = 2 × 20 = 40 V ตรวจสอบ 40 V / 20 Ω = 2 A"],
]) {
  test(`${language} calculation delivers the requested 40 V with structured linkage on three deterministic trials`, async () => {
    for (let trial = 1; trial <= 3; trial++) {
      const harness = createEvaluationHarness(fixture((output) => { output.blocks[0].content = answer; }));
      const output = await harness.engine.process({ ...input, userInput: question });
      const signals = screenFacts(output);
      for (const key of ["formulaPresent", "current2A", "resistance20Ohm", "voltage40V"]) assert.equal(signals[key], true);
      assert.equal(signals.suspiciousVoltage, false);
      assert.equal(validateTutorOutput(output).valid, true);
      assert.equal(output.blocks[0].citationIds[0], output.citations[0].id);
      assert.match(system(harness), /server-selected teachingPolicy language/);
      assert.match(system(harness), /Reference language and previous assistant language never override this policy/);
      const task = JSON.parse(harness.requests[0].messages.at(-1).content);
      assert.equal(task.studentInput, question);
      assert.equal(task.teachingPolicy.language, language === 'English' ? 'en' : 'th');
    }
  });
}

for (const thanks of ["Thanks.", "ขอบคุณ"]) {
  test(`acknowledgement policy stays brief with no current Knowledge citation: ${thanks}`, async () => {
    const harness = createEvaluationHarness(fixture((output, request) => {
      const task = JSON.parse(request.messages.at(-1).content);
      if (!task.sourceMaterials.length) output.blocks = [{ id: "ack", type: "explanation", content: thanks === "Thanks." ? "You're welcome!" : "ยินดีครับ" }];
    }));
    await harness.engine.process(input);
    const output = await harness.engine.process({ ...input, userInput: thanks });
    assert.equal(harness.retrievals[1].found.length, 0);
    assert.deepEqual(output.citations, []);
    assert.equal(output.blocks.length, 1);
    assert.match(system(harness), /one brief acknowledgement block/);
    assert.match(system(harness), /do not introduce a new lesson, exercise or recap/);
  });
}

for (const content of ["{truncated-private-text", "VALID_JSON"]) {
  test(`length finish reason rejects even ${content === "VALID_JSON" ? "parseable" : "unparseable"} JSON with safe diagnostics`, async () => {
    const provider = { name: "fixture", generate: async (request) => ({ provider: "fixture", model: "fixture",
      content: content === "VALID_JSON" ? JSON.stringify(mockTutorScenario(request)) : content,
      finishReason: "length", usage: { inputTokens: 3000, outputTokens: 2048 } }) };
    const harness = createEvaluationHarness(provider);
    await assert.rejects(harness.engine.process(input), (error) => {
      assert.equal(error.code, "AI_INVALID_OUTPUT");
      assert.equal(error.diagnostics.subtype, "MODEL_OUTPUT_TRUNCATED");
      assert.equal(error.diagnostics.finishReason, "length");
      assert.equal(error.diagnostics.outputTokens, 2048);
      assert.ok(error.diagnostics.outputCharacters > 0);
      assert.doesNotMatch(JSON.stringify(error), /TRUNCATED|2048|private-text/);
      return true;
    });
  });
}

test("invalid nontruncated JSON has a distinct safe internal subtype", async () => {
  const harness = createEvaluationHarness({ name: "fixture", generate: async () => ({ provider: "fixture", model: "fixture", content: "private-raw-json", finishReason: "stop" }) });
  await assert.rejects(harness.engine.process(input), (error) => {
    assert.equal(error.diagnostics.subtype, "MODEL_OUTPUT_INVALID_JSON");
    assert.equal(error.diagnostics.finishReason, "stop");
    assert.doesNotMatch(JSON.stringify(error), /private-raw-json/);
    assert.equal(error.cause, undefined);
    return true;
  });
});

test("OpenRouter empty length output retains safe truncation diagnostics without retry or raw body", async () => {
  let calls = 0;
  const provider = new OpenRouterModelProvider({ apiKey: "offline-only", model: "fixture", maxRetries: 2 }, {
    fetch: async () => { calls++; return new Response(JSON.stringify({ choices: [{ message: { content: "" }, finish_reason: "length" }],
      usage: { prompt_tokens: 2700, completion_tokens: 2048 } }), { status: 200 }); },
  });
  const harness = createEvaluationHarness(provider);
  await assert.rejects(harness.engine.process(input), (error) => {
    assert.equal(error.diagnostics.subtype, "MODEL_OUTPUT_TRUNCATED");
    assert.equal(error.diagnostics.outputCharacters, 0);
    assert.equal(error.diagnostics.outputTokens, 2048);
    assert.doesNotMatch(JSON.stringify(error), /offline-only|choices|TRUNCATED/);
    return true;
  });
  assert.equal(calls, 1);
});
