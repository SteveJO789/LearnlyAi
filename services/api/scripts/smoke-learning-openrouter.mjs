import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";

import { createApp } from "../dist/app.js";
import { createModelProvider, loadModelProviderConfig } from "../dist/modules/ai/providers/create-model-provider.js";
import { isModelProviderError } from "../dist/modules/ai/providers/model-provider-errors.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";
import { InMemoryLearningPersistence } from "../dist/modules/learning/in-memory-repositories.js";

// Explicit live check, separate from npm test/CI. Credentials never enter the report.
// Pin the model verified by this slice; OPENROUTER_MODEL can select another model.
const environment = {
  ...process.env,
  AI_PROVIDER: "openrouter",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL?.trim() || "nvidia/nemotron-3-super-120b-a12b:free",
  AI_PROVIDER_TIMEOUT_MS: process.env.AI_PROVIDER_TIMEOUT_MS || "45000",
  AI_PROVIDER_MAX_RETRIES: process.env.AI_PROVIDER_MAX_RETRIES || "0",
};
const directory = new URL("../logs/", import.meta.url);
const reportPath = new URL("learning-openrouter-smoke.json", directory);
const report = {
  checkedAt: new Date().toISOString(),
  status: "FAILED",
  configuredModel: environment.OPENROUTER_MODEL,
  checks: { contract: false, conversationContext: false, persistedConversation: false },
  turns: [],
  generations: [],
  transport: [],
  outputDiagnostics: [],
};
let server;

try {
  const provider = createModelProvider(loadModelProviderConfig(environment), {
    openRouter: {
      async fetch(url, options) {
        const response = await globalThis.fetch(url, options);
        const envelope = await response.clone().json().catch(() => null);
        const choice = envelope?.choices?.[0];
        report.transport.push({
          status: response.status,
          model: typeof envelope?.model === "string" ? envelope.model : undefined,
          finishReason: typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined,
          contentLength: typeof choice?.message?.content === "string" ? choice.message.content.length : undefined,
          outputTokens: typeof envelope?.usage?.completion_tokens === "number" ? envelope.usage.completion_tokens : undefined,
          reasoningTokens: typeof envelope?.usage?.completion_tokens_details?.reasoning_tokens === "number"
            ? envelope.usage.completion_tokens_details.reasoning_tokens : undefined,
        });
        return response;
      },
    },
  });
  const persistence = new InMemoryLearningPersistence();
  const requests = [];
  // Observe provider-neutral metadata only; never store headers or raw envelopes.
  const observedProvider = {
    name: provider.name,
    async generate(request) {
      requests.push(request);
      try {
        const response = await provider.generate(request);
        report.generations.push({
          provider: response.provider,
          model: response.model,
          usage: response.usage,
          finishReason: response.finishReason,
        });
        let output;
        try {
          output = JSON.parse(response.content);
        } catch {
          report.outputDiagnostics.push({ validJson: false });
          return response;
        }
        const task = JSON.parse(request.messages.at(-1).content);
        const validation = validateTutorOutput(output);
        report.outputDiagnostics.push({
          validJson: true,
          validSchema: validation.valid,
          validationKeywords: [...new Set(validation.errors.map((error) => error.keyword))],
          sessionIdMatches: output?.sessionId === task.sessionId,
          responseIdMatches: output?.responseId === task.responseId,
          stageMatches: output?.stage === task.outputStage,
          progressMatches: output?.progress?.percent === task.progress.percent
            && output?.progress?.canAdvance === task.progress.canAdvance
            && output?.progress?.nextAction === task.progress.nextAction,
          citationCount: Array.isArray(output?.citations) ? output.citations.length : undefined,
        });
        return response;
      } catch (error) {
        if (isModelProviderError(error)) {
          // Adapter messages are normalized static diagnostics, not response bodies.
          report.providerFailure = { code: error.code, httpStatus: error.httpStatus, diagnostic: error.message };
        }
        throw error;
      }
    },
  };
  server = createApp({ modelProvider: observedProvider, learningPersistence: persistence }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = `http://127.0.0.1:${address.port}/api/learning/respond`;
  const sessionId = `live-smoke-${randomUUID()}`;
  const initialRequest = {
    sessionId,
    input: "แก้สมการ 2x + 4 = 10",
    learningGoal: "เข้าใจวิธีแก้สมการเชิงเส้น",
    subject: "math",
  };

  async function respond(request) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await response.json();
    if (response.status !== 200) {
      report.turns.push({
        request, status: response.status,
        error: { code: payload.error?.code, message: payload.error?.message },
      });
      throw new Error("LIVE_HTTP_FAILURE");
    }
    assert.deepEqual(validateTutorOutput(payload.data), { valid: true, errors: [] });
    assert.equal(payload.data.sessionId, sessionId);
    assert.equal(payload.data.stage, "LEARNING");
    assert.ok(payload.data.blocks.some((block) => block.type === "explanation"));
    report.turns.push({ request, status: response.status, tutorOutput: payload.data });
    console.log(JSON.stringify({
      turn: report.turns.length, status: response.status, stage: payload.data.stage,
      schemaVersion: payload.data.schemaVersion, blockTypes: payload.data.blocks.map((block) => block.type),
    }));
    return payload.data;
  }

  const first = await respond(initialRequest);
  const second = await respond({ sessionId, input: "ทำไมต้องลบ 4 ทั้งสองข้าง" });
  assert.notEqual(first.responseId, second.responseId);
  report.checks.contract = true;

  const secondPrompt = requests[1].messages;
  assert.equal(secondPrompt[1].role, "user");
  assert.equal(secondPrompt[1].content, initialRequest.input);
  assert.equal(secondPrompt[2].role, "assistant");
  assert.deepEqual(JSON.parse(secondPrompt[2].content), first);
  const secondTask = JSON.parse(secondPrompt.at(-1).content);
  assert.equal(secondTask.learningGoal, initialRequest.learningGoal);
  assert.equal(secondTask.subject, initialRequest.subject);
  report.checks.conversationContext = true;

  const messages = await persistence.messages.findBySessionId(sessionId);
  assert.deepEqual(messages.map((message) => message.role), ["USER", "TUTOR", "USER", "TUTOR"]);
  assert.deepEqual(messages[3].content, second);
  report.checks.persistedConversation = true;
  report.status = "PASS";
} catch (error) {
  report.failure = {
    code: isModelProviderError(error) ? error.code : "LIVE_SMOKE_FAILED",
    message: "The live check did not complete. Inspect the safe turn statuses in this report.",
  };
  console.error(JSON.stringify({ status: "FAILED", code: report.failure.code }));
  process.exitCode = 1;
} finally {
  if (server?.listening) {
    server.closeIdleConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await mkdir(directory, { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`Live OpenRouter check: ${report.status}. Evidence: logs/learning-openrouter-smoke.json`);
}
