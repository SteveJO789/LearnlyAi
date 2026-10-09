# Data Model — current contract + planned scope (2026-10-09)

> Source of truth: [`services/api/src/prisma/contract.prisma`](../services/api/src/prisma/contract.prisma). Supabase Auth owns identity and login sessions; old application OAuthAccount/AppSession tables are not part of current contract.

## Entity Relationship

```mermaid
erDiagram
    USERS ||--o{ LEARNING_SESSIONS : learns
    LEARNING_SESSIONS ||--o{ SOURCE_MATERIALS : receives
    LEARNING_SESSIONS ||--o{ MESSAGES : contains
    LEARNING_SESSIONS ||--o{ ASSESSMENTS : measures
    ASSESSMENTS ||--o{ ASSESSMENT_ANSWERS : contains
    USERS ||--|| LEARNING_PROFILES : has
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits
    LEARNING_SESSIONS ||--o{ AI_REQUESTS : records
```

## Core Tables

### `users`

- `id` UUID PK
- `email` text nullable/indexed
- `display_name` text
- `avatar_url` text nullable
- `created_at`, `updated_at`

### Supabase authentication mapping

- `User.authUserId` is unique and maps to Supabase Auth user UUID; current app profile sync uses the same UUID as `User.id`.
- Google provider identity, email/password credentials, email verification and session management belong to Supabase Auth.
- User-owned operations are scoped to verified JWT identity and database RLS (`auth.uid()`).
- `oauth_accounts` and `app_sessions` were old plans, not actual current tables.

### `learning_sessions`

- `id` UUID PK
- `user_id` UUID FK → users
- `title`, `learning_goal`
- `state` enum/check constraint
- `progress_percent`
- `version` integer สำหรับ optimistic concurrency
- `created_at`, `updated_at`, `completed_at`
- Index `(user_id, created_at DESC)`

### `source_materials`

- `id` UUID PK
- `learning_session_id` UUID FK
- `type` (`TEXT`, `PDF`, `IMAGE`)
- `status` (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`)
- `storage_key` nullable
- `normalized_text` nullable
- `content_hash`, `mime_type`, `size_bytes`
- `metadata` jsonb

### `messages`

- `id` UUID PK
- `learning_session_id` UUID FK
- `role` (`USER`, `TUTOR`, `SYSTEM`)
- `content` jsonb ตาม contract
- `created_at`

### `assessments` / `assessment_answers`

- Assessment: session, phase (`PRE`, `POST`, `TRANSFER`), score, max_score, submitted_at
- Answer: assessment, question_id, response, is_correct, awarded_score
- Unique assessment ต่อ `(learning_session_id, phase)` ตามกติกา MVP

### `learning_profiles`

- `user_id` UUID PK/FK
- `mastery` jsonb
- `strengths` jsonb
- `weak_points` jsonb
- `updated_at`

### `documents` / `document_chunks`

- Document เก็บ title, source URI, trust level, checksum และ metadata
- Chunk เก็บ document/page/sequence, content, embedding `vector(n)` และ metadata
- Vector dimension ต้องกำหนดจาก embedding model ผ่าน migration ไม่ hard-code หลายค่าปะปน
- เพิ่ม vector index หลังมีข้อมูลและทดสอบ query plan

### `ai_requests`

- `id`, `learning_session_id`, `request_id`
- provider/model, operation, status, latency, token usage, error code
- prompt/output อาจเก็บเฉพาะ redacted snapshot ตาม retention policy
- ห้ามเก็บ API key, cookie, OAuth code หรือ raw token

## Ownership Rule

ทุก repository/query ที่อ่าน resource ของผู้ใช้ต้องรับ `current_user_id` และ scope query ด้วย owner เสมอ การตรวจว่ามี ID อยู่ก่อนแล้วค่อยเช็ก owner ภายหลังอาจทำให้ข้อมูลรั่วผ่าน 404/403 behavior

## Implementation notes

Assessment, LearningProfile, and SourceMaterial contracts are defined but their full application flows remain unfinished (#13, #15, #16). Live RAG vector retrieval remains #11. Current avatar update may store a Base64 data URL in User.avatarUrl: migrate binary objects to Supabase Storage instead. Use the checked-in Prisma 8 contract and app migration workflow, not an assumed `schema.prisma` file.

## Migration Rule

- ใช้ Prisma 8 contract + repository migrations โดยตรวจ database migration state ก่อน deploy
- Migration ต้อง rollback ได้เมื่อสมเหตุสมผล
- Test database ต้องสร้างจาก migration เดียวกับ production ไม่ใช้ schema ที่เขียนแยก
