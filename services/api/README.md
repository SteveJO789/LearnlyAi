# API Service

พื้นที่สำหรับ FastAPI modular monolith

Module baseline:

- `auth`, `users`
- `learning_sessions`, `input_processing`
- `assessments`, `learning_profiles`
- `ai_orchestrator`, `rag`
- `shared` สำหรับ config, database, errors และ logging

เริ่ม implementation ด้วย `/health/live`, `/health/ready`, Google OIDC และ mock learning vertical slice ก่อนเชื่อม AI provider จริง

