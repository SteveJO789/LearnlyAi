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
