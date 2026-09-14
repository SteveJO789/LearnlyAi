# API Service

พื้นที่สำหรับ Node.js + Express.js + TypeScript modular monolith โดยใช้ Zod สำหรับ validation และ Prisma สำหรับ database access/migration

Module baseline:

- `auth`, `users`
- `learning_sessions`, `input_processing`
- `assessments`, `learning_profiles`
- `ai_orchestrator`, `rag`
- `shared` สำหรับ config, database, errors และ logging

เริ่ม implementation ด้วย `/health/live`, `/health/ready`, Google OIDC และ mock learning vertical slice ก่อนเชื่อม AI provider จริง

Frontend และ Backend ใช้ TypeScript ร่วมกัน แต่ต้องสื่อสารผ่าน HTTP/shared contracts ไม่ import business implementation ข้าม service
