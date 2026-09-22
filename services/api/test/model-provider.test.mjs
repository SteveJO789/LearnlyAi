import assert from "node:assert/strict";
import test from "node:test";

import {
  createModelProvider,
  createModelProviderFromEnvironment,
  loadModelProviderConfig,
} from "../dist/modules/ai/providers/create-model-provider.js";
import { ModelProviderError } from "../dist/modules/ai/providers/model-provider-errors.js";
import { MockModelProvider } from "../dist/modules/ai/providers/mock-model-provider.js";
import { OpenRouterModelProvider } from "../dist/modules/ai/providers/openrouter-model-provider.js";
import { validateTutorOutput } from "../dist/modules/ai/tutor-output-validator.js";

const modelRequest = {
  messages: [
    { role: "system", content: "Return a structured tutor response." },
    { role: "user", content: "Help me understand Ohm's law." },
    { role: "assistant", content: "Let us start with voltage." },
  ],
  temperature: 0.2,
  maxOutputTokens: 512,
  responseFormat: {
    type: "json_schema",
    name: "tutor_output",
    strict: true,
    schema: { type: "object" },
  },
  metadata: { correlationId: "request-123" },
};

const successfulEnvelope = {
  id: "generation-123",
  model: "openai/gpt-4.1-mini",
  choices: [
    {
      message: { content: '{"answer":"Voltage drives current."}' },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 20,
    completion_tokens: 8,
    total_tokens: 28,
  },
};

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createOpenRouterProvider(fetchImplementation, overrides = {}) {
  return new OpenRouterModelProvider(
    {
      apiKey: "test-openrouter-key",
      model: "openai/gpt-4.1-mini",
      baseUrl: "https://openrouter.test/api/v1",
      timeoutMs: 1_000,
      maxRetries: 0,
      ...overrides,
    },
    {
      fetch: fetchImplementation,
      sleep: async () => {},
    },
  );
}

async function expectProviderError(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof ModelProviderError);
    assert.equal(error.code, code);
    return true;
  });
}

test("MockModelProvider returns deterministic output without invoking fetch", async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Mock provider must not use the network");
  };

  try {
    const provider = new MockModelProvider();
    const first = await provider.generate(modelRequest);
    const second = await provider.generate(modelRequest);

    assert.deepEqual(first, second);
    assert.equal(first.provider, "mock");
    assert.equal(first.model, "mock-tutor-v1");
    assert.deepEqual(first.usage, {
      inputTokens: 24,
      outputTokens: 96,
      totalTokens: 120,
    });
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MockModelProvider output parses and passes the Tutor Output contract", async () => {
  const response = await new MockModelProvider().generate(modelRequest);
  const parsed = JSON.parse(response.content);

  assert.deepEqual(validateTutorOutput(parsed), { valid: true, errors: [] });
});

test("MockModelProvider accepts an injected fixture scenario", async () => {
  const fixture = { scenario: "controlled-test-output" };
  const provider = new MockModelProvider({ scenario: () => fixture });

  assert.deepEqual(JSON.parse((await provider.generate(modelRequest)).content), fixture);
});

test("OpenRouterModelProvider maps normalized request options and safe headers", async () => {
  let capturedUrl;
  let capturedInit;
  const provider = new OpenRouterModelProvider(
    {
      apiKey: "test-openrouter-key",
      model: "openai/gpt-4.1-mini",
      baseUrl: "https://openrouter.test/api/v1",
      timeoutMs: 1_000,
      maxRetries: 0,
      siteUrl: "https://learnly.example",
      appName: "Learnly AI",
    },
    {
      fetch: async (url, init) => {
        capturedUrl = url;
        capturedInit = init;
        return jsonResponse(successfulEnvelope);
      },
      sleep: async () => {},
    },
  );

  await provider.generate(modelRequest);

  assert.equal(capturedUrl, "https://openrouter.test/api/v1/chat/completions");
  assert.equal(capturedInit.method, "POST");
  assert.equal(capturedInit.headers.Authorization, "Bearer test-openrouter-key");
  assert.equal(capturedInit.headers["HTTP-Referer"], "https://learnly.example");
  assert.equal(capturedInit.headers["X-OpenRouter-Title"], "Learnly AI");
  assert.deepEqual(JSON.parse(capturedInit.body), {
    model: "openai/gpt-4.1-mini",
    messages: modelRequest.messages,
    temperature: 0.2,
    max_tokens: 512,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "tutor_output",
        strict: true,
        schema: { type: "object" },
      },
    },
  });
});

test("OpenRouterModelProvider normalizes successful content and token usage", async () => {
  const provider = createOpenRouterProvider(async () => jsonResponse(successfulEnvelope));
  const response = await provider.generate(modelRequest);

  assert.deepEqual(response, {
    provider: "openrouter",
    model: "openai/gpt-4.1-mini",
    content: '{"answer":"Voltage drives current."}',
    finishReason: "stop",
    requestId: "generation-123",
    usage: {
      inputTokens: 20,
      outputTokens: 8,
      totalTokens: 28,
    },
  });
});

test("OpenRouterModelProvider rejects missing content", async () => {
  const provider = createOpenRouterProvider(async () =>
    jsonResponse({ choices: [{ message: { content: "" } }] }),
  );

  await expectProviderError(() => provider.generate(modelRequest), "PROVIDER_INVALID_RESPONSE");
});

test("OpenRouterModelProvider rejects malformed response envelopes", async () => {
  let calls = 0;
  const provider = createOpenRouterProvider(
    async () => {
      calls += 1;
      return jsonResponse({ choices: [] });
    },
    { maxRetries: 2 },
  );

  await expectProviderError(() => provider.generate(modelRequest), "PROVIDER_INVALID_RESPONSE");
  assert.equal(calls, 1);
});

test("OpenRouterModelProvider rejects invalid JSON response bodies", async () => {
  const provider = createOpenRouterProvider(
    async () => new Response("{not-json", { status: 200 }),
  );

  await expectProviderError(() => provider.generate(modelRequest), "PROVIDER_INVALID_RESPONSE");
});

test("OpenRouterModelProvider never exposes its API key in HTTP errors", async () => {
  const apiKey = "highly-sensitive-test-key";
  const provider = createOpenRouterProvider(
    async () => jsonResponse({ error: `rejected ${apiKey}` }, 401),
    { apiKey },
  );

  await assert.rejects(() => provider.generate(modelRequest), (error) => {
    assert.ok(error instanceof ModelProviderError);
    assert.equal(error.code, "PROVIDER_AUTHENTICATION_ERROR");
    assert.equal(error.httpStatus, 401);
    assert.equal(error.message.includes(apiKey), false);
    assert.equal(JSON.stringify(error).includes(apiKey), false);
    return true;
  });
});

test("OpenRouterModelProvider retries every configured transient HTTP status", async (t) => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    await t.test(String(status), async () => {
      let calls = 0;
      const delays = [];
      const provider = new OpenRouterModelProvider(
        {
          apiKey: "test-key",
          model: "test-model",
          baseUrl: "https://openrouter.test/api/v1",
          maxRetries: 1,
        },
        {
          fetch: async () => {
            calls += 1;
            return calls === 1 ? jsonResponse({}, status) : jsonResponse(successfulEnvelope);
          },
          sleep: async (milliseconds) => {
            delays.push(milliseconds);
          },
        },
      );

      await provider.generate(modelRequest);
      assert.equal(calls, 2);
      assert.deepEqual(delays, [250]);
    });
  }
});

test("OpenRouterModelProvider retries transient network failures", async () => {
  let calls = 0;
  const delays = [];
  const provider = new OpenRouterModelProvider(
    {
      apiKey: "test-key",
      model: "test-model",
      maxRetries: 1,
    },
    {
      fetch: async () => {
        calls += 1;
        if (calls === 1) {
          throw new TypeError("connection reset");
        }
        return jsonResponse(successfulEnvelope);
      },
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    },
  );

  await provider.generate(modelRequest);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("OpenRouterModelProvider stops after the configured maximum attempts", async () => {
  let calls = 0;
  const delays = [];
  const provider = new OpenRouterModelProvider(
    {
      apiKey: "test-key",
      model: "test-model",
      maxRetries: 2,
    },
    {
      fetch: async () => {
        calls += 1;
        return jsonResponse({}, 503);
      },
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    },
  );

  await expectProviderError(() => provider.generate(modelRequest), "PROVIDER_UNAVAILABLE");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("OpenRouterModelProvider does not retry non-transient client errors", async (t) => {
  for (const status of [400, 401, 403]) {
    await t.test(String(status), async () => {
      let calls = 0;
      const provider = new OpenRouterModelProvider(
        { apiKey: "test-key", model: "test-model", maxRetries: 2 },
        {
          fetch: async () => {
            calls += 1;
            return jsonResponse({}, status);
          },
          sleep: async () => {
            assert.fail("Non-transient failures must not back off");
          },
        },
      );

      await assert.rejects(() => provider.generate(modelRequest));
      assert.equal(calls, 1);
    });
  }
});

test("OpenRouterModelProvider converts a transport timeout without real delays", async () => {
  let calls = 0;
  let scheduledMilliseconds;
  const provider = new OpenRouterModelProvider(
    {
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 321,
      maxRetries: 0,
    },
    {
      fetch: async (_url, init) => {
        calls += 1;
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      },
      sleep: async () => {},
      scheduleTimeout: (callback, milliseconds) => {
        scheduledMilliseconds = milliseconds;
        queueMicrotask(callback);
        return 1;
      },
      cancelTimeout: () => {},
    },
  );

  await expectProviderError(() => provider.generate(modelRequest), "PROVIDER_TIMEOUT");
  assert.equal(calls, 1);
  assert.equal(scheduledMilliseconds, 321);
});

test("OpenRouterModelProvider retries a local transport timeout", async () => {
  let calls = 0;
  let scheduledTimeouts = 0;
  const delays = [];
  const provider = new OpenRouterModelProvider(
    {
      apiKey: "test-key",
      model: "test-model",
      timeoutMs: 321,
      maxRetries: 1,
    },
    {
      fetch: async (_url, init) => {
        calls += 1;

        if (calls === 1) {
          return new Promise((_resolve, reject) => {
            init.signal.addEventListener(
              "abort",
              () => reject(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        }

        return jsonResponse(successfulEnvelope);
      },
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      scheduleTimeout: (callback) => {
        scheduledTimeouts += 1;
        if (scheduledTimeouts === 1) {
          queueMicrotask(callback);
        }
        return scheduledTimeouts;
      },
      cancelTimeout: () => {},
    },
  );

  const response = await provider.generate(modelRequest);

  assert.equal(response.provider, "openrouter");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("factory selects Mock without validating irrelevant OpenRouter configuration", () => {
  const provider = createModelProviderFromEnvironment({
    AI_PROVIDER: "mock",
    AI_PROVIDER_TIMEOUT_MS: "not-an-integer",
  });

  assert.ok(provider instanceof MockModelProvider);
});

test("non-production environment defaults explicitly to Mock for local development and CI", () => {
  const provider = createModelProviderFromEnvironment({ NODE_ENV: "test" });

  assert.ok(provider instanceof MockModelProvider);
});

test("factory selects OpenRouter and injects its fetch dependency", () => {
  const fetchImplementation = async () => jsonResponse(successfulEnvelope);
  const provider = createModelProvider(
    {
      provider: "openrouter",
      openRouter: {
        apiKey: "test-key",
        model: "test-model",
      },
    },
    { openRouter: { fetch: fetchImplementation } },
  );

  assert.ok(provider instanceof OpenRouterModelProvider);
});

test("configuration rejects an unknown provider", () => {
  assert.throws(
    () => loadModelProviderConfig({ AI_PROVIDER: "unknown" }),
    (error) => error instanceof ModelProviderError && error.code === "PROVIDER_CONFIGURATION_ERROR",
  );
});

test("configuration rejects missing OpenRouter API key", () => {
  assert.throws(
    () =>
      createModelProviderFromEnvironment({
        AI_PROVIDER: "openrouter",
        OPENROUTER_MODEL: "test-model",
      }),
    (error) => error instanceof ModelProviderError && error.code === "PROVIDER_CONFIGURATION_ERROR",
  );
});

test("configuration rejects missing OpenRouter model", () => {
  assert.throws(
    () =>
      createModelProviderFromEnvironment({
        AI_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "test-key",
      }),
    (error) => error instanceof ModelProviderError && error.code === "PROVIDER_CONFIGURATION_ERROR",
  );
});

test("production never silently falls back to Mock", () => {
  assert.throws(
    () => loadModelProviderConfig({ APP_ENV: "production" }),
    (error) => error instanceof ModelProviderError && error.code === "PROVIDER_CONFIGURATION_ERROR",
  );
});
