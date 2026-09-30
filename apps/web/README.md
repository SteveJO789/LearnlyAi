# Web Application

พื้นที่สำหรับ Next.js + React + TypeScript frontend

หน้าหลักของ MVP:

- `/` Landing
- `/login` Continue with Google
- `/dashboard` Recent sessions และ progress
- `/learn/new` Create/upload material
- `/learn/[sessionId]` Guided learning session
- `/history` Session history
- `/profile` Learning profile

Frontend ต้องพัฒนากับ API/JSON mock ตาม `docs/api-contract.md` และ `contracts/learning-output.schema.json` ได้ โดยไม่เรียก AI provider โดยตรง

## Environment setup

คัดลอก `.env.example` เป็น `.env.local` ภายในโฟลเดอร์นี้ `NEXT_PUBLIC_API_BASE_URL` คือ base URL ของ Backend API v1 และต้องลงท้ายด้วย `/api/v1`

```bash
cp .env.example .env.local
npm run dev
```
