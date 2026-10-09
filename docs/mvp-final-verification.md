# หลักฐานตรวจสอบ MVP (รายงานที่อัปเดตระหว่างทำงาน)

สถานะ: IN PROGRESS — ยังไม่ IMPLEMENTATION COMPLETE และยังไม่ RELEASED

รายละเอียด feature/issue/evidence และงานต่อไปอยู่ใน [ตัวติดตามงาน](mvp-completion-tracker.md)

## Architecture และ API

รักษา Next.js/React/TypeScript, Express modular monolith, Node 24/npm, Supabase Auth/PostgreSQL/Prisma/RLS, ModelProvider Mock/OpenRouter และ canonical Tutor Output
RAG P3.1 อยู่ใน develop แล้ว; ไม่มีการ cherry-pick ซ้ำ

## Test results/commands

รอบ 2026-10-09: Knowledge 50/50, API 208/208, persisted RAG offline integration 8/8, Knowledge/API/Web typechecks และ API compile ผ่าน; Web production build ผ่าน
Web tests พบ 0 tests จึงยังไม่ผ่าน acceptance criteria frontend regression; fresh runtime check PASS (source export, 9 deterministic files, fresh API 208/208, relocated runtime 4/4)
Real readiness check with existing API+Web environment: all checks `ok` หลังแก้ anonymous-role permission failure; ไม่อ่าน learner records และไม่เรียก AI
Fresh runtime export จับ source ก่อนการแก้ connectivity probe รอบสุดท้าย; probe ใหม่นี้มี typecheck/unit checks และ real SELECT 1 verification แยกต่างหาก ไม่อ้างว่า fresh export ตรวจ code รอบสุดท้ายแล้ว
คำสั่งทั้งหมดและ exit codes ถูกบันทึกโดย `node scripts/verify-mvp.mjs` ใน `.verification-results/summary.json` พร้อม individual logs
Prisma unscoped `migration check --json` พบ 4 integrity failures; เก็บผลเดิมและแก้ graph ต่อ ไม่ลด checks เพื่ออ้างว่า migration ผ่านครบ

Milestone 2: API **220/220**, persisted-RAG integration **8/8**, adaptive regressions **5 conversations + 1 language test** ผ่าน
Offline core retrieval TP4/TN3/FP0/FN0; 13 records รวม follow-ups ตรงกับ expected retrieval เป็น corpus/fixture ขนาดเล็ก ไม่ใช่ universal retrieval proof
ผลใหม่: [retrieval evidence](evidence/mvp-milestone2-rag-offline.json)
Draft PR https://github.com/SteveJO789/LearnlyAi/pull/74; ยังไม่ merge/ปิด issue

## Security

อ่าน policies จาก Supabase catalog แล้ว: ownership SELECT และ LearningSession/Message write policies มีอยู่; ส่วนฟีเจอร์ assessment/material/profile ยังขาด write policies
`services/api/scripts/verify-session-rls.sql` รันจริงผ่าน: owner read/write, cross-user read/update/insert ถูกปฏิเสธ และ reassignment ถูกปฏิเสธ; ROLLBACK แล้ว fixture users เหลือ 0
ทดสอบระดับ SQL ด้วย simulated JWT claims ไม่ใช่ full login/browser proof ไม่อ่าน/แก้ learner data เดิม
แก้ log ให้มีเฉพาะ request ID/phase, ปิด deployed development AI route และเพิ่ม bounded Auth/readiness checks; tests ผ่าน แต่ยังไม่ใช่ audit logging ทั้งระบบครบ

## Deployment

Base SHA e2ddfdd: GitHub statuses Vercel Web/API failure และชี้ build-rate-limit (ตรวจ 2026-10-09)
ไม่มี production release หรือ migration โดยงานนี้

## Limitations/blockers

- ไม่มี Supabase development branch; user อนุญาต project production สำหรับ tests จึงใช้ rollback fixtures ไม่ apply destructive migration หรือเปลี่ยน live learner data
- User approved live AI/embedding budget US$1 สำหรับ Goal นี้; ยังใช้ US$0 และต้องตรวจราคา/กำหนด worst-case ceiling ก่อนเรียก
- Corpus ที่ reviewed แล้วมี Ohm pilot; ไม่ปลอม content/license/review เพื่อให้ดูว่ารองรับทุกบท
- Local dependency copies ใช้เพื่อเริ่มทดสอบ; ไม่แทน fresh npm ci/clean Linux CI proof

## Release checklist

- [ ] ทุก feature/issue criterion มี working code และ evidence
- [ ] Unit/integration/contract/E2E/security checks ผ่าน
- [ ] Production Web/API builds ผ่าน
- [ ] Safe migrations + cross-user RLS ผ่าน
- [ ] Knowledge runtime packaging ผ่านจาก source ใหม่
- [ ] README/API/architecture/operations ตรงกับ implementation
- [ ] Preview deployment และ full user journey ผ่าน
- [ ] ไม่มี critical/high blocker
- [ ] Authorized production deployment + smoke tests ผ่าน ก่อนใช้คำว่า RELEASED
