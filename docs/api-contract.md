# HTTP API Contract — implemented vs planned (2026-10-09)

Base path: `/api/v1`

Contract นี้ตั้งใจให้ Frontend ทำ mock server และ Backend implement แยกกันได้ หากเปลี่ยน field หรือ behavior ต้องอัปเดตเอกสารและ consumer tests ใน PR เดียวกัน

## Conventions

- JSON ใช้ `camelCase`; database column ใช้ `snake_case`
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

Implemented: POST/GET `/learning-sessions`, GET `/learning-sessions/{sessionId}`, POST `/learning-sessions/{sessionId}/interactions`. Others in the table below are planned. Current history returns up to 100 items, not pagination.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/learning-sessions` | สร้าง session |
| GET | `/learning-sessions` | History list, capped at 100; pagination not implemented |
| GET | `/learning-sessions/{sessionId}` | อ่าน session และ progress |
| POST | `/learning-sessions/{sessionId}/materials` | PLANNED (not implemented): PDF/image/text upload |
| POST | `/learning-sessions/{sessionId}/interactions` | ส่งคำตอบ/ขอคำใบ้/ตอบ guided question |
| POST | `/learning-sessions/{sessionId}/assessments/{phase}/submissions` | PLANNED (not implemented): pre/post assessment |

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

- Text: `application/json` พร้อม `type=text` และ `text`
- PDF/Image: `multipart/form-data` พร้อม `file`
- Backend ต้องตอบ `202` ได้เมื่อ processing ทำต่อแบบ asynchronous/polling

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
  "message": "เพราะแรงดันเท่ากับกระแสคูณความต้านทาน",
  "clientRequestId": "2e97f0f1-71df-4f94-a57a-e1f2846e0d23"
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

File/PDF/image materials and assessment submission endpoints remain planned work.

## Learning Engine Development Slice

`POST /learning/respond` is implemented at `/api/v1/learning/respond`, with an alias at `/api/learning/respond`. This standalone development slice uses in-memory persistence and currently does not require authentication. It does not replace the planned authenticated learning-session interaction endpoints.

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
| GET | `/users/me/learning-profile` | PLANNED (not implemented) |
| GET | `/users/me/progress` | PLANNED (not implemented) |

## Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Process ทำงานอยู่ ไม่ตรวจ external dependency |
| GET | `/health/ready` | Current implementation checks API only, not database/dependencies |

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

