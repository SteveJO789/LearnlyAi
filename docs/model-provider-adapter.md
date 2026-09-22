# Model Provider Adapter

The Model Provider Adapter keeps model transport concerns out of Learnly AI's learning rules. The dependency direction is:

```text
Learning Engine
  → Tutor / AI Orchestrator
    → ModelProvider
      → MockModelProvider | OpenRouterModelProvider
```

Learning Engine and orchestrator code depend only on `ModelProvider`. They must not import OpenRouter request or response types. This lets configuration change the selected provider or model without changing the frontend or business logic.

## Supported providers

- `mock`: deterministic, offline Structured Tutor Output for local development, CI, and the First Vertical Slice. It requires no API key, never uses the network, and accepts an injected fixture or scenario in tests.
- `openrouter`: non-streaming OpenRouter Chat Completions transport using Node's built-in `fetch`.

There is no automatic OpenRouter-to-Mock fallback. Production requires an explicit `AI_PROVIDER` value, so a missing or invalid real-provider configuration fails fast.

## Configuration

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `AI_PROVIDER` | Production | `mock` outside production | `mock` or `openrouter` |
| `OPENROUTER_API_KEY` | OpenRouter | none | Bearer credential; never logged or returned in an error |
| `OPENROUTER_MODEL` | OpenRouter | none | OpenRouter model identifier |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | Base URL; `/chat/completions` is appended unless already present |
| `AI_PROVIDER_TIMEOUT_MS` | No | `30000` | Per-attempt transport timeout, from 1 to 300000 ms |
| `AI_PROVIDER_MAX_RETRIES` | No | `2` | Additional attempts after the first, from 0 to 10 |
| `OPENROUTER_SITE_URL` | No | none | Optional OpenRouter `HTTP-Referer` attribution |
| `OPENROUTER_APP_NAME` | No | none | Optional OpenRouter `X-OpenRouter-Title` attribution |

Local and CI use:

```dotenv
AI_PROVIDER=mock
```

OpenRouter uses:

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=replace-with-a-secret
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

Never commit a real API key.

## Usage and Issue #12 integration

Construct the provider at the application composition boundary and inject the interface into the Tutor Orchestrator:

```ts
import {
  createModelProvider,
  loadModelProviderConfig,
} from "../providers/create-model-provider.js";

const config = loadModelProviderConfig();
const provider = createModelProvider(config);
const response = await provider.generate(request);
```

`ModelRequest` carries provider-neutral messages (`system`, `user`, and `assistant`), temperature, maximum output tokens, text/JSON/JSON-Schema response format, correlation metadata, and an optional caller `AbortSignal`. `ModelResponse` contains only the provider name, model name, text content, finish reason, provider request ID, and normalized input/output/total token usage. It deliberately does not expose the raw OpenRouter envelope.

Issue #12 should inject `ModelProvider` into the Tutor Orchestrator rather than constructing or importing `OpenRouterModelProvider` in business logic. After `generate()` returns, the Tutor Orchestrator owns these steps:

1. Parse `response.content` as JSON.
2. Call `validateTutorOutput()` against the existing Tutor Output contract.
3. Reject invalid output with an application-level controlled error.
4. Only then return or persist the Tutor Output.

JSON parsing and `validateTutorOutput()` belong at this orchestration boundary because `ModelProvider` is a generic model transport. Coupling it to `learning-output.schema.json` would prevent reuse for other model tasks. The Mock provider's integration test proves its default output parses and passes the existing validator.

## Timeout and retry policy

Each OpenRouter attempt has its own timeout. The adapter makes at most `1 + AI_PROVIDER_MAX_RETRIES` attempts and uses bounded exponential backoff (250 ms, 500 ms, 1000 ms, capped at 2000 ms). Network failures, timeouts, and HTTP `408`, `429`, `500`, `502`, `503`, and `504` are retryable.

HTTP `400`, `401`, and `403`, invalid configuration, invalid request data, malformed successful responses, invalid JSON responses, and caller cancellation are not retried. Fetch, backoff sleep, and timeout scheduling are injectable so tests make no network calls and do not wait through real retry delays.

## Normalized errors

`ModelProviderError` exposes a stable code, safe message, provider name, retryability, and an HTTP status where safe. The original failure is retained as the internal `cause` for server-side debugging, but prompts, authorization headers, API keys, and provider response bodies are never copied into the public error.

| Code | Meaning |
|---|---|
| `PROVIDER_CONFIGURATION_ERROR` | Missing or invalid local provider configuration |
| `PROVIDER_AUTHENTICATION_ERROR` | OpenRouter returned `401` or `403` |
| `PROVIDER_RATE_LIMITED` | OpenRouter returned `429` |
| `PROVIDER_TIMEOUT` | Local attempt timeout or HTTP `408` |
| `PROVIDER_UNAVAILABLE` | Network failure or retryable service response |
| `PROVIDER_INVALID_RESPONSE` | Successful response was empty, malformed, or not valid JSON |
| `PROVIDER_REQUEST_FAILED` | Non-retryable provider rejection, invalid request, or caller cancellation |

Issue #12 should translate these codes into the API's application error envelope without passing through `cause`, provider response data, or secrets.
