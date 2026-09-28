# Learning Engine Core

This sprint implements an independent learning vertical slice:

```text
POST /api/learning/respond
  -> LearningEngine.process()
  -> build context and stage policy
  -> TutorOrchestrator -> Prompt Builder -> ModelProvider
  -> parse JSON -> AJV and citation validation -> request binding checks
  -> atomic session/message commit -> Structured Tutor Output
```

The same route is available at `/api/v1/learning/respond` to match the API baseline. The default local provider is `mock`; `openrouter` uses the existing provider factory and environment configuration. Neither the engine nor the orchestrator imports OpenRouter transport or database implementations.

## Run the slice

Use the repository's Node.js 24 runtime. No database, OAuth setup, or external API key is required for mock mode. From the repository root in PowerShell:

```powershell
Set-Location services/api
$env:AI_PROVIDER = "mock"
npm.cmd run build
npm.cmd start
```

In another terminal:

```powershell
$body = @{
  sessionId = "test-session"
  input = "แก้สมการ 2x + 4 = 10"
  learningGoal = "เข้าใจวิธีแก้สมการเชิงเส้น"
  subject = "math"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/api/learning/respond" `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```

Response shape (the two generated IDs vary):

```json
{
  "data": {
    "schemaVersion": "1.0",
    "responseId": "generated-response-id",
    "sessionId": "test-session",
    "stage": "LEARNING",
    "blocks": [
      {
        "id": "blk_explain",
        "type": "explanation",
        "title": "Mock explanation",
        "content": "เริ่มจาก 2x + 4 = 10 ลบ 4 ทั้งสองข้างได้ 2x = 6 แล้วหารทั้งสองข้างด้วย 2 ได้ x = 3 ตรวจคำตอบ: 2(3) + 4 = 10"
      }
    ],
    "progress": { "percent": 25, "canAdvance": true, "nextAction": "CONTINUE" },
    "citations": []
  }
}
```

The mock has a deterministic worked explanation for this sample equation and fixed algebra practice/assessment questions. Other input receives a clearly labelled generic mock response. Real tutoring requires `AI_PROVIDER=openrouter`; configure it using [Model Provider Adapter](model-provider-adapter.md). `npm start` reads inherited environment variables. `npm run start:env` additionally loads an optional `services/api/.env` using Node's built-in environment-file support; no dotenv dependency or database initialization is needed.

## Live OpenRouter check

From `services/api`, with `OPENROUTER_API_KEY` already available in the environment or the ignored `.env` file:

```powershell
$env:OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
npm.cmd run test:openrouter
```

This explicit command builds the API and runs `scripts/smoke-learning-openrouter.mjs`. It always selects the OpenRouter provider and uses the configured model, defaulting to the model above when `OPENROUTER_MODEL` is absent. It is separate from `npm test` and CI. There is no mock fallback. The script runs a temporary server on a random localhost port, so it does not restart or change an existing server on port 8000.

The smoke check sends the sample equation, then `ทำไมต้องลบ 4 ทั้งสองข้าง` in the same session. Both outputs must pass the unchanged Tutor Output contract, include explanation blocks, and use distinct response IDs. It also verifies that the second provider request contains the saved first turn and retains goal/subject, and that the in-memory repository contains four messages in `USER → TUTOR → USER → TUTOR` order.

It writes the latest result to the ignored local file `services/api/logs/learning-openrouter-smoke.json`. This contains validated outputs, token counts, transport metadata, and boolean validation diagnostics. It never records credentials, headers, raw provider envelopes, reasoning text, rejected model content, or complete prompts. A failed check exits with code 1 and records safe failure codes instead of disguising the failure as a successful mock response.

To run the regular API with the same real provider:

```powershell
$env:AI_PROVIDER = "openrouter"
$env:OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
npm.cmd run build
npm.cmd run start:env
```

Use the same HTTP request and Tutor Output consumer as mock mode. No Learning Engine logic changes are needed to switch providers. API keys belong only in local environment configuration, never in request JSON or committed files.

### Verified on 2026-09-27

The live two-turn check passed with `nvidia/nemotron-3-super-120b-a12b:free`: both HTTP responses were `200`, both outputs used schema version `1.0` and public stage `LEARNING`, the first explanation solved `x = 3`, and the follow-up explained preserving equality by subtracting the same value from both sides. Contract, conversation context, and four-message persistence checks all passed. The latest local report contains the complete validated responses.

Earlier live attempts were correctly rejected with controlled `502 AI_INVALID_OUTPUT`. In particular, the random `openrouter/free` router selected a reasoning model that exhausted the 2048-token budget and returned `finish_reason: "length"` with no final content. Reasoning can consume the same budget as visible output, as documented in [OpenRouter Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens). The smoke check therefore pins a known model by default. Live generation remains nondeterministic; this result proves the integration path, not guaranteed output quality or availability for every model. The validator remains mandatory on every turn.

## Domain and transitions

The core owns separate concepts:

- Session lifecycle `state`: `ACTIVE`, `COMPLETED`, `FAILED`.
- Teaching `stage`: `DIAGNOSE`, `EXPLAIN`, `PRACTICE`, `ASSESS`, `REVIEW`.
- Public `TutorOutput.stage`: the unchanged enum from the version 1.0 output contract.

`LearningResult` is an alias for `ValidatedTutorOutput`, not a second output format. Its TypeScript view is in `services/api/src/modules/ai/tutor-output.ts`; the canonical runtime schema remains `contracts/learning-output.schema.json`.

| Internal stage | Tutor Output stage | Workflow percent | Next interaction |
|---|---|---:|---|
| `DIAGNOSE` | `PRE_TEST` | 0 | `SUBMIT_ASSESSMENT` |
| `EXPLAIN` | `LEARNING` | 25 | `CONTINUE` |
| `PRACTICE` | `LEARNING` | 50 | `ANSWER` |
| `ASSESS` | `POST_TEST` | 75 | `SUBMIT_ASSESSMENT` |
| `REVIEW` | `COMPLETED` | 100 | `null` |

Unknown session IDs are created by the slice on their first successful response, starting at `EXPLAIN`. A provider failure on the first turn records a `FAILED` session with no messages. To exercise the full sequence, construct `DefaultLearningEngine` with `initialStage: "DIAGNOSE"`.

`RESPOND` is the default action and retains the current teaching stage. `ADVANCE` moves exactly one stage forward in the above sequence, only for an existing `ACTIVE` session whose saved `progress.canAdvance` is true. Clients cannot supply a stage, skip steps, or change progress. There is no automatic advancement inferred from student text, percentage, or model output.

MVP advancement is explicit and does not grade answers. Workflow percentages represent position in this sequence, not measured understanding. Active stages allow manual advancement; `REVIEW` produces a final recap, sets `canAdvance: false`, and completes the session after successful validation and persistence. Deterministic scoring and pedagogical gates can replace this policy later.

After an AI boundary failure, the session becomes `FAILED` and retains the last successful stage, progress, and messages. Both `FAILED` and `COMPLETED` are terminal for this slice; subsequent calls return `SESSION_INACTIVE`. Use a new session ID to restart. Failed or stale turns never add rejected output to conversation history.

The original session API/persistence baseline uses workflow values such as `INPUT` in `LearningSession.state`. That baseline is separate from this core's lifecycle. No Prisma or auth files are changed by this sprint. The future adapter must reconcile the existing storage fields with lifecycle and teaching stage rather than treating these enums as interchangeable.

## Ports and composition

`DefaultLearningEngine` depends on:

- `TutorOrchestrator`: produces only branded, validated Tutor Output.
- `LearningPersistence.sessions`: `LearningSessionRepository.findById()` and `save()`.
- `LearningPersistence.messages`: `MessageRepository.add()` and `findBySessionId()`.
- `LearningPersistence.commit()`: atomically checks the expected version and saves a session plus all turn messages.
- Optional `SourceMaterialRepository`: supplies citation metadata and text for this session. Without it, source materials and citations are empty. There is no retrieval/vector pipeline in this sprint.

`InMemoryLearningSessionRepository`, `InMemoryMessageRepository`, and `InMemoryLearningPersistence` support offline development. Reads and writes clone values to prevent callers from changing saved data. Conversation history uses committed insertion order, including when timestamps match; only the most recent 20 messages enter the prompt.

`commit()` must use create-if-absent when `expectedVersion` is `null`, compare-and-set otherwise, and increment the version by exactly one. Returning `false` means a concurrent turn won; the engine returns `SESSION_CONFLICT` without overwriting its state or messages. An AI failure also uses this version check, so it cannot mark a concurrently committed session as failed.

Zeya can implement Prisma-backed session/message repositories and `LearningPersistence.commit()` with a database transaction, then inject them into `createApp({ learningPersistence })`. The model call happens before commit and outside any database transaction. Preserve message order, uniqueness, and defensive-copy semantics. No engine changes are required to replace the in-memory implementation.

Best can add authentication and ownership enforcement at the HTTP/repository boundary. Scope persistence operations to the authenticated user before they reach these ports, including both commit and history reads. This development route currently has no auth, ownership, or durable storage, and its in-memory state is local to one app instance and resets on restart.

Application composition is in `create-learning-engine.ts`. `createApp()` also accepts an injected `learningEngine` or `modelProvider` for integration tests and future composition.

## AI validation and errors

The prompt builder includes the canonical schema, stage-specific instructions, engine-owned identifiers/progress, optional goal/subject, prior conversation, and supplied sources. It requests `json_object` format through the provider-neutral interface; server-side AJV validation remains mandatory regardless of provider formatting support.

The orchestrator rejects malformed JSON, schema violations, duplicate IDs, unresolved block citation references, incorrect session/response IDs, incorrect public stage, model-controlled progress, and citations not matching supplied source metadata. Accepted output is not repaired or rewritten to hide an invalid provider response.

| Error code | HTTP status | Meaning |
|---|---:|---|
| `VALIDATION_ERROR` | 400 | Invalid body, empty/oversized fields, invalid action, or unknown fields |
| `INVALID_STAGE_TRANSITION` | 400 | Cannot advance from the current state/stage |
| `SESSION_INACTIVE` | 409 | Completed or failed session |
| `SESSION_CONFLICT` | 409 | Concurrent version mismatch |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Request is not `application/json` |
| `PAYLOAD_TOO_LARGE` | 413 | JSON body exceeds 1 MiB |
| `AI_INVALID_OUTPUT` | 502 | Invalid provider response or request binding |
| `AI_REQUEST_FAILED` | 502 | Provider rejected the generation request |
| `AI_UNAVAILABLE` | 503 | Provider unavailable, authentication/configuration failure during generation, or unexpected generation failure |
| `AI_TIMEOUT` | 504 | Provider timed out after its configured retries |
| `AI_RATE_LIMITED` | 429 | Provider rate limit after its configured retries |
| `INTERNAL_ERROR` | 500 | Other internal failure, including persistence |

Startup provider configuration errors still fail fast. HTTP errors use the API's safe `{ error: { code, message, requestId, details } }` envelope and return an `x-request-id` header. AI error details stay empty; provider messages, response bodies, schema diagnostics, secrets, and stacks never enter that envelope. Causes are retained inside the AI boundary error for internal debugging only. Invalid AI output is a server boundary failure, not a client 422 validation error.

## Verification

From `services/api`:

```powershell
npm.cmd run lint
npm.cmd test
```

The test script builds the API and copies the same schema used by development into `dist/contracts`. Unit and HTTP integration tests cover success, request validation, JSON/schema/citation failures, provider error normalization, output/request binding, stage transitions, history isolation, atomic commits, concurrent requests, and an OpenRouter transport stub. All model generation in these tests is offline; no OpenRouter, Supabase, Prisma connection, or Google OAuth is needed.

The current suite has 97 passing tests. Failure coverage explicitly includes empty input, missing session ID, invalid subject type/blank/oversized value, provider exceptions, malformed JSON, and schema-invalid output. Invalid subject values return `400` with `/subject` and leave an existing conversation unchanged. `subject` remains optional free text under the current request contract; there is no category enum, so a nonblank label such as `robotics` is accepted. Offline two-turn HTTP tests also verify stored history, goal, and subject in the next prompt. Local verification used Node.js 25.2.1; the repository and CI target Node.js 24.x.

The engine core is now ready for team integration through the existing ports. Supabase JWT/current-user handling and Prisma persistence remain the Best/Zeya workstreams; RAG, scoring, and additional product features are outside this sprint.
