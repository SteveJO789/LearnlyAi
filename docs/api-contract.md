# HTTP API Contract — implemented vs planned (2026-10-09)

Base path: `/api/v1`

Contract นี้ตั้งใจให้ Frontend ทำ mock server และ Backend implement แยกกันได้ หากเปลี่ยน field หรือ behavior ต้องอัปเดตเอกสารและ consumer tests ใน PR เดียวกัน

## Conventions

- JSON ใช้ `camelCase`; ใช้ชื่อ column จริงตาม canonical Prisma contract (ปัจจุบัน quoted camelCase)
- ID เป็น opaque string/UUID; client ห้าม parse ความหมายจาก ID
- เวลาใช้ ISO 8601 UTC เช่น `2026-09-12T13:00:00Z`
- Frontend authentication uses Supabase Auth. Protected learning-session endpoints require `Authorization: Bearer <supabase-access-token>`; the API derives the current user from the token and never accepts a client-supplied `userId`.

### Success Envelope

```json
{
  "data": {}
}
```

### Error Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อมูลที่ส่งมาไม่ถูกต้อง",
    "requestId": "req_01J...",
    "details": []
  }
}
```

## Authentication (implemented in Supabase, not Express)

Browser uses `supabase.auth.signInWithOAuth({provider: "google"})`, `signInWithPassword`, `signUp`, `signOut`, `getUser`, and `getSession`. Callback: `/auth/callback`; after login: `/Home`; email registration verification: `/verify-email`.

The old Express endpoints `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout` are NOT implemented. Protected API endpoints require `Authorization: Bearer <Supabase access token>`.

Profile data is currently synced and updated through browser Supabase client against RLS-protected `User`, not a custom Express profile endpoint.

## Learning Sessions

Implemented on the MVP completion branch: sessions/history/interactions, text materials, assessment creation/retrieval/submission and learning profile/progress. PDF/image extraction remains unfinished. History returns up to 100 items, not pagination.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/learning-sessions` | สร้าง session |
| GET | `/learning-sessions` | History list, capped at 100; pagination not implemented |
| GET | `/learning-sessions/{sessionId}` | อ่าน session และ progress |
| POST | `/learning-sessions/{sessionId}/materials` | Text normalization/persistence; PDF/image remains planned |
| POST | `/learning-sessions/{sessionId}/interactions` | ส่งคำตอบ/ขอคำใบ้/ตอบ guided question |
| POST/GET | `/learning-sessions/{sessionId}/assessments/{phase}` | Create/retrieve PRE, POST or TRANSFER |
| POST | `/learning-sessions/{sessionId}/assessments/{phase}/submissions` | Deterministic scoring and owned answer/profile persistence |

### Create Session

Request:

```json
{
  "title": "วงจรไฟฟ้ากระแสตรง",
  "learningGoal": "เข้าใจกฎของโอห์มและคำนวณวงจรพื้นฐาน"
}
```

Response `201`:

```json
{
  "data": {
    "id": "lsn_01J...",
    "title": "วงจรไฟฟ้ากระแสตรง",
    "state": "INPUT",
    "progressPercent": 0,
    "createdAt": "2026-09-12T13:00:00Z"
  }
}
```

### Add Material

- Text: `application/json` พร้อม `{"type":"TEXT","text":"x² + 4 = 10"}`. Maximum 8000 characters; NFC and LF normalization preserve mathematical notation. Control characters/blank input are rejected.
- Returns 201 with `materialId`, `type=TEXT`, `status=READY`, `normalizedText`, SHA-256 `contentHash`, `mimeType=text/plain`, UTF-8 `sizeBytes`.
- Text is learner material, not reviewed trusted Knowledge. Stored material access is scoped to the owner; no raw learning input is placed in Create-page URLs.
- PDF/Image extraction and multipart upload remain unfinished; do not assume 202 asynchronous processing exists.

Normalized material ภายใน backend:

```json
{
  "materialId": "mat_01J...",
  "type": "PDF",
  "status": "READY",
  "normalizedText": "...",
  "metadata": {
    "originalFilename": "lesson.pdf",
    "pageCount": 3
  }
}
```

### Tutor Interaction

Request:

```json
{
  "action": "RESPOND",
  "message": "เพราะแรงดันเท่ากับกระแสคูณความต้านทาน"
}
```

Response payload ใน `data` ต้องผ่าน [learning-output.schema.json](../contracts/learning-output.schema.json) และกฎอ้างอิง citation ของ server-side validator ก่อนส่งออกจาก backend ดู field, block, renderer และ versioning guidance ที่ [Tutor Output Contract](tutor-output-contract.md)

### Current persistent-session implementation

The following authenticated endpoints are implemented and persisted through PostgreSQL:

- `POST /api/v1/learning-sessions`
- `GET /api/v1/learning-sessions`
- `GET /api/v1/learning-sessions/{sessionId}`
- `POST /api/v1/learning-sessions/{sessionId}/interactions`

Session ownership is derived from the verified Supabase user ID. The frontend must not send a `userId`.

Session detail now includes owned `materials` in addition to `messages`. Text-intake sessions enter PRE_TEST until PRE is submitted. ASSESS cannot ADVANCE to completion before POST is submitted. These gates reject before model calls or state/message writes. Legacy direct-session development flows retain their existing startup behavior.

### Assessment (implemented on completion branch)

Create with `POST /learning-sessions/{sessionId}/assessments/PRE`:

```json
{ "topic": "ohms-law", "language": "th" }
```

Topics currently supported by original numeric exercise templates: `linear-equations`, `ohms-law`; languages `th`/`en` (default th). This bounded exercise bank is not a claim of full curriculum coverage or reviewed Knowledge provenance.
PRE is created before learning (DIAGNOSE or EXPLAIN version 0). POST requires ASSESS; TRANSFER requires PRACTICE/ASSESS. A subsequent phase must match the existing PRE topic. Existing phase creation is idempotent when topic/language match; changes return 409.

The 201 `data` contains `id`, `sessionId`, `phase`, `topic`, `language`, `questions`, `score`, `maxScore`, `submittedAt`. Each question has `id`, `prompt`, `format=NUMBER`, optional `unit`; private grading rules and submission hashes are omitted. `score`/`submittedAt` are null before submission. `GET` also returns submitted `answers` (empty before submission).

Submit with `POST /learning-sessions/{sessionId}/assessments/PRE/submissions`:

```json
{ "answers": [{ "questionId": "ohms-law:v1:PRE:1", "answer": 40 }, { "questionId": "ohms-law:v1:PRE:2", "answer": 2 }, { "questionId": "ohms-law:v1:PRE:3", "answer": 20 }] }
```

Use IDs/operands from the issued assessment, not these illustrative numbers. All three finite numeric answers are required; unknown/duplicate/missing IDs and client scoring fields return 400. Integer exercise scores are computed by code, never an LLM. A transaction saves score, answers and (POST/TRANSFER) the learning profile. Identical retries, including answer reordering, return the saved result without duplicate writes; changed submitted answers return 409 `ASSESSMENT_CONFLICT`. Foreign/unknown sessions return the same 404. Unsupported/malformed legacy snapshots return 503 `ASSESSMENT_UNAVAILABLE`.

Public database writes to server-managed scores/progress/tutor messages require a transaction-local trusted API context plus ownership RLS. See [server-write decision](adr/assessment-server-writes.md). No client-supplied header/body/JWT metadata enables this context.

## Learning Engine Development Slice

`POST /learning/respond` is a local development slice at `/api/v1/learning/respond`, with an alias at `/api/learning/respond`. It is disabled by default. Local developers may explicitly enable it with `APP_ENV=development` and `LEARNING_DEV_ROUTE_ENABLED=true`; it is always disabled when `NODE_ENV=production` or `VERCEL` is set. Both paths then return `404 NOT_FOUND` before provider execution. The MVP uses authenticated persistent learning-session interaction endpoints.

Request:

```json
{
  "sessionId": "test-session",
  "input": "แก้สมการ 2x + 4 = 10",
  "learningGoal": "เข้าใจวิธีแก้สมการเชิงเส้น",
  "subject": "math",
  "action": "RESPOND"
}
```

`sessionId` and `input` are required nonblank strings with limits of 128 and 8000 characters. Optional `learningGoal` and `subject` are nonblank strings up to 1000 and 128 characters. `action` is optional (`RESPOND` by default, or `ADVANCE`). Unknown fields and null values are rejected. The JSON body limit is 1 MiB; requests must use `application/json`.

`subject` is free text, not a fixed category enum. Invalid type, blank text, and values over its length limit return `400 VALIDATION_ERROR` with `details[].path = "/subject"`. These input failures occur before model generation and do not fail or modify an existing session.

An unknown session starts at internal stage `EXPLAIN`. `RESPOND` retains its stage; `ADVANCE` moves one allowed step. Output `stage` continues to use the canonical Tutor Output enum, so both internal `EXPLAIN` and `PRACTICE` return `LEARNING`.

Response `200` places the entire validated Tutor Output directly in `data`, including `schemaVersion`, `responseId`, `sessionId`, `stage`, `blocks`, `progress`, and `citations`. There is no extra Tutor Output format. Errors use the standard error envelope and an `x-request-id` header. Invalid model output returns `502 AI_INVALID_OUTPUT`; provider failures are normalized to safe 429/502/503/504 errors.

See [Learning Engine Core](learning-engine-core.md) for the complete sample response, stage mapping, error codes, terminal-session behavior, and Prisma/auth integration ports.

## Profile

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/users/me/learning-profile` | Latest assessed topic samples, strengths/weak points |
| GET | `/users/me/progress` | Owned session totals/progress and PRE/POST comparisons |

Learning profile returns `mastery` keyed by topic: `{percent,assessmentId,sampleQuestions,assessedAt}`, `strengths`, `weakPoints`, `updatedAt`. Empty profile: `{mastery:{},strengths:[],weakPoints:[],updatedAt:null}`. Latest submitted POST/TRANSFER sample per topic is used; >=80% is a strong result, <50% needs practice. These are small assessment samples, not a calibrated global mastery estimate.
Progress returns `sessionCount`, `completedSessionCount`, `averageProgressPercent` and up to 100 comparison rows `{sessionId,topic,prePercent,postPercent,deltaPercent}`. Missing paired phases use null, never invented zero scores. Web forwards these via `/api/users/me/...` with the Supabase Bearer token.

## Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Process ทำงานอยู่ ไม่ตรวจ external dependency |
| GET | `/health/ready` | Database connectivity, reviewed runtime Knowledge and Auth configuration; 200 ready / 503 not_ready |

Readiness returns `data.status` and `data.checks` containing `api`, `database`, `knowledge`, `authConfiguration` with `ok`/`failed` values. Probes have a 3-second deadline. Database connectivity uses `SELECT 1` on the configured application connection and reads no learner records; it does not prove RLS, schema compatibility or migration correctness. Auth configuration does not prove OAuth login or Auth service availability. No paid provider call is made. Liveness remains independent of all these dependencies.

## Status Codes

| Status | Meaning |
|---|---|
| 200/201/202 | สำเร็จ/สร้างแล้ว/รับไปประมวลผล |
| 400 | Request หรือ state transition ไม่ถูกต้อง |
| 401 | ยังไม่ login หรือ session หมดอายุ |
| 403 | Login แล้วแต่ไม่มีสิทธิ์ |
| 404 | ไม่พบ resource ภายใต้ current user |
| 409 | Duplicate/idempotency conflict |
| 413/415 | ไฟล์ใหญ่เกินไป/ชนิดไฟล์ไม่รองรับ |
| 422 | Schema validation ไม่ผ่าน |
| 429 | Rate limited |
| 502/503/504 | AI/dependency failure แบบควบคุมได้ |

