# API Service

พื้นที่สำหรับ Node.js + Express.js + TypeScript modular monolith โดยใช้ Zod สำหรับ validation และ Prisma สำหรับ database access/migration

Module baseline:

- `auth`, `users`
- `learning_sessions`, `input_processing`
- `assessments`, `learning_profiles`
- `ai_orchestrator`, `rag`
- `shared` สำหรับ config, database, errors และ logging

Current implementation includes health endpoints, standalone learning engine slice and JWT-protected persistent learning-session routes. Supabase Auth manages Google/email login; Express validates its Bearer tokens. `/health/ready` is currently API-only, not a DB probe.

Frontend และ Backend ใช้ TypeScript ร่วมกัน แต่ต้องสื่อสารผ่าน HTTP/shared contracts ไม่ import business implementation ข้าม service

การตั้งค่าและขอบเขตของ Model Provider Adapter อยู่ที่ [`docs/model-provider-adapter.md`](../../docs/model-provider-adapter.md)

The standalone Learning Engine slice is implemented at `POST /api/learning/respond` and `POST /api/v1/learning/respond`. It uses the existing Tutor Output contract with AJV validation, stage-specific prompts, and in-memory repository adapters. See [Learning Engine Core](../../docs/learning-engine-core.md) for mock startup commands, sample requests/responses, tests, and the Prisma/auth integration ports.

`npm run test:openrouter` explicitly runs a real two-turn provider smoke check with an environment API key and records validated evidence under the ignored `logs/` directory. It is separate from offline `npm test` and CI. `npm run start:env` starts the built API with optional local `.env` loading.

## Environment setup

คัดลอก `.env.example` เป็น `.env` ภายในโฟลเดอร์นี้ แล้วแทนที่ placeholder เฉพาะค่าที่ต้องใช้ `.env` จะไม่ถูก commit เข้า repository

```bash
npm ci
cp .env.example .env
npm run dev
```

`npm run dev`, `npm run start:env` และ `npm run test:openrouter` โหลดค่าจาก `services/api/.env` ส่วน production ควรกำหนดค่าผ่าน platform environment settings โดยตรง

Prisma skill metadata สำหรับเครื่องมือ AI ไม่จำเป็นต่อ runtime หากต้องการสร้าง metadata สำหรับการพัฒนา ให้เรียก `npm run skills:sync` เอง โดยโฟลเดอร์ที่สร้างขึ้นจะถูก ignore โดย Git

## Runtime Knowledge packaging

API builds prepare the reviewed Ohm's Law 0.2.0 pilot from tracked source. Install
the locked `knowledge/` dependencies alongside API dependencies first.
See [runtime preparation and Vercel packaging](../../docs/runtime-knowledge-deployment.md)
for commands, exact files, CI checks, `KNOWLEDGE_ROOT`, and the fresh-export smoke.
# MVP verification (2026-10-09)

The completion branch implements text material persistence, numeric PRE/POST/TRANSFER creation/submission, protected learning profile/progress and transaction-local API-write guards. Run `node scripts/assessment-fixture-sql.mjs <unique-schema> <synthetic-user-a> <synthetic-user-b>` to render rollback-only RLS checks. `--persistent` is ONLY for an explicitly authorized isolated fixture needed by `node scripts/verify-assessment-db.mjs ...`; inspect SQL and cleanup with `--cleanup` after the verifier exits, including failure. Never point the verifier at public tables, expose an RPC setter for `learnly.api_write`, or log real tokens. See `docs/adr/assessment-server-writes.md` and the tracker for boundaries.

Before deploying this source, review/apply the new canonical app migrations in a safe authorized environment. Do not replay legacy destructive user cleanup from the stale `db` ref. CD remains develop-only; feature branches are intentionally skipped.

For a NEW database, `20261010T0331_fresh_supabase_mvp_baseline` provides a generated current-schema baseline with complete RLS and explicit application table grants. Read-only `prisma db migrate --show --from @empty --to d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397` selects this path. The older eight-migration path has a verified missing-policy precondition failure; do not rewrite its historical hashes or use it to bootstrap a fresh database. An EXISTING database must migrate from its inspected real marker, never replay this fresh baseline. The Supabase descriptor/Auth realm remains managed externally; no custom Auth tables or role changes are introduced. See `docs/evidence/mvp-fresh-baseline-verification.json`. Render isolated rollback verification with `node scripts/render-historical-migration-verification.mjs --path=fresh`; execution requires an authorized database environment.

`node ../../scripts/verify-mvp.mjs` from this directory runs deterministic checks, API/persisted-RAG tests, Web typecheck/build and source-only Knowledge packaging. Install locked dependencies in `services/api`, `apps/web`, and `knowledge` first using npm. Reports go to repository `.verification-results/` (ignored).

The in-memory `/api/v1/learning/respond` and `/api/learning/respond` endpoints are disabled by default and always unavailable on Vercel/production. For explicit local experiments only, set `APP_ENV=development` and `LEARNING_DEV_ROUTE_ENABLED=true`. Real Web usage goes through Bearer-authenticated `/api/v1/learning-sessions`.

`/health/ready` returns 503 if DB connectivity, reviewed Knowledge or Auth configuration fails; it does not validate OAuth, RLS or model availability. `node scripts/check-readiness.mjs` prints the same sanitized dependency status and closes the database connection.

`npm run test:persistent` verifies router/Auth/engine/citations/Prisma persistence integration with offline service simulations. Actual PostgreSQL ownership checks are separately reproducible with `scripts/verify-session-rls.sql`: inspect the fixed synthetic UUIDs for collisions, run only with authorized DB access, and retain its final rollback/zero-fixture result. It changes no existing learner records.
