# HTTP API Contract (MVP Baseline)

Base path: `/api/v1`

Contract นี้ตั้งใจให้ Frontend ทำ mock server และ Backend implement แยกกันได้ หากเปลี่ยน field หรือ behavior ต้องอัปเดตเอกสารและ consumer tests ใน PR เดียวกัน

## Conventions

- JSON ใช้ `camelCase`; database column ใช้ `snake_case`
- ID เป็น opaque string/UUID; client ห้าม parse ความหมายจาก ID
- เวลาใช้ ISO 8601 UTC เช่น `2026-09-12T13:00:00Z`
- Protected endpoint ใช้ application session cookie

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

## Authentication

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/auth/google` | Public |
| GET | `/auth/google/callback` | Public |
| GET | `/auth/me` | Required |
| POST | `/auth/logout` | Required |

`GET /auth/me`

```json
{
  "data": {
    "id": "usr_01J...",
    "displayName": "Cake",
    "email": "student@example.com",
    "avatarUrl": "https://..."
  }
}
```

## Learning Sessions

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/learning-sessions` | สร้าง session |
| GET | `/learning-sessions` | History แบบ pagination |
| GET | `/learning-sessions/{sessionId}` | อ่าน session และ progress |
| POST | `/learning-sessions/{sessionId}/materials` | ส่ง text หรือ upload PDF/image |
| POST | `/learning-sessions/{sessionId}/interactions` | ส่งคำตอบ/ขอคำใบ้/ตอบ guided question |
| POST | `/learning-sessions/{sessionId}/assessments/{phase}/submissions` | ส่ง pre/post-test (`phase=pre|post`) |

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
  "action": "ANSWER",
  "message": "เพราะแรงดันเท่ากับกระแสคูณความต้านทาน",
  "clientRequestId": "2e97f0f1-71df-4f94-a57a-e1f2846e0d23"
}
```

Response payload ใน `data.tutorOutput` ต้องผ่าน [learning-output.schema.json](../contracts/learning-output.schema.json)

## Profile

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/users/me/learning-profile` | Mastery, strengths และ weak points |
| GET | `/users/me/progress` | Summary สำหรับ dashboard |

## Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health/live` | Process ทำงานอยู่ ไม่ตรวจ external dependency |
| GET | `/health/ready` | ตรวจ DB และ dependency ที่จำเป็นต่อ request |

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

