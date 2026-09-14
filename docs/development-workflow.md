# กระบวนการพัฒนา

## Branch Strategy

```text
main
  ↑ release/integration PR
develop
  ↑ reviewed feature PR
feature/* | fix/* | docs/*
```

- `main` เป็น demo/release ที่ผ่าน integration test
- `develop` เป็นฐานรวมงานของ sprint
- ห้าม push เข้า `main` หรือ `develop` โดยตรง
- สร้าง branch จาก `develop` และควร sync ก่อนเปิด PR

ตัวอย่าง:

- `feature/6-google-oidc`
- `feature/8-session-api`
- `feature/9-learning-session-ui`
- `feature/12-ai-orchestrator`

## Vertical Slice First

เป้าหมาย integration แรก:

```text
Google Login → Create Session → Mock Input → Mock Structured Tutor Output
→ Render Lesson → Save Session → History
```

ทีมสามารถพัฒนาขนานกันผ่าน shared contracts โดย AI จริง, OCR จริง และ RAG จริงยังเป็น adapter/mock ได้ใน slice แรก

## Pull Request Requirements

PR พร้อม merge เมื่อ:

- เชื่อม Issue ด้วย `Closes #...` หรือ `Refs #...`
- Build/lint/test ที่เกี่ยวข้องผ่าน
- Acceptance Criteria ครบ
- ไม่มี secret, API key, OAuth credential หรือ `.env` จริง
- มี reviewer อย่างน้อย 1 คนและไม่ใช่ผู้เขียนเอง
- API/DB/Schema change มี contract หรือ migration ใน PR เดียวกัน
- มี screenshot/video สำหรับ UI change และตัวอย่าง request/response สำหรับ API change
- error/loading/unauthorized state ถูกพิจารณาตามขอบเขตงาน

## Definition of Done

- Implementation ทำงานตาม Acceptance Criteria
- มี unit/contract/integration test ตาม boundary ที่เปลี่ยน
- ผ่าน review และแก้ comment แล้ว
- ทำงานร่วมกับ `develop` ล่าสุด
- documentation และ environment example เป็นปัจจุบัน
- feature ถูกตรวจบน vertical slice หรือมี mock ที่ consumer ใช้ได้

## Review Pairing

| Author area | Reviewer ที่แนะนำ |
|---|---|
| Frontend/UX | Backend owner เพื่อตรวจ contract |
| Auth/User | Steve หรือ Seiya เพื่อตรวจ security/data |
| Session/Data | Best หรือ Steve เพื่อตรวจ ownership/state |
| AI/RAG | Frontend owner เพื่อตรวจ renderer contract |

## Project Status

`Backlog → Ready → In Progress → In Review → Testing → Done`

จำกัดงาน `In Progress` คนละ 1 งานหลัก เพื่อให้ PR มีขนาดเล็กและลดงานค้าง

