# ตัวติดตามการทำ MVP ให้ครบ

เริ่มตรวจ 2026-10-09 จาก `origin/develop` commit `e2ddfdd7788a5d20d66b496ee2917771b6ea3021` บน branch `integration/university-mvp-20261009` ใน worktree แยก งานเดิมและ stash ไม่ถูกแก้ไข เป้าหมายยัง ACTIVE; ยังไม่ IMPLEMENTATION COMPLETE หรือ RELEASED

## หลักฐานจาก Phase 0

- Fetch ล่าสุด: develop `e2ddfdd`; main `1396fdd`; ไม่มี PR เปิดอยู่ ณ เวลาตรวจ
- `git merge-base --is-ancestor c2eed66 origin/develop` และ `59058b1` exit 0 ทั้งคู่: RAG ถูก merge ผ่าน PR #73 แล้ว ไม่ cherry-pick ซ้ำ
- issues เปิด #2 #3 #9 #11 #12 #13 #14 #15 #16 #39; ใช้ acceptance criteria ร่วมกับโค้ดจริง ไม่ใช้คำบรรยายเก่าเป็นหลักฐานว่าฟีเจอร์สำเร็จ
- อ่าน README, architecture, API/data contracts, Prisma contract/migration graph, API composition, persistence, auth, RAG, Web routes, CI และ Vercel config แล้ว
- Supabase project LearnlyAI มีอยู่และไม่มี development branch; อ่าน pg_policies เท่านั้น ไม่อ่านข้อมูลผู้ใช้และไม่เขียน schema/data
- ตาราง Assessment/AssessmentAnswer/LearningProfile/SourceMaterial มี SELECT policy แต่ยังไม่มี write policies ที่จำเป็นสำหรับฟีเจอร์ใหม่
- LearningSession/Message write policies อยู่ใน manual SQL และฐานข้อมูลจริง แต่ขาดใน canonical Prisma contract: fresh migration consistency ต้องแก้และทดสอบ
- Vercel Web/API ของ base SHA ล้มเหลวทั้งคู่ โดย status ชี้ `build-rate-limit`; ยังไม่ใช่ deployed integration proof

## Feature matrix

| Feature | Issue | สถานะจริง | Acceptance criteria ที่ยังขาด | Dependencies | Verification evidence | Blocker |
|---|---|---|---|---|---|---|
| Supabase Google/email login, verification, callback | #5 #6 (approved) | มี implementation; รักษาไว้ | regression และ real browser flow รอบนี้ | Supabase Auth | auth middleware tests มีอยู่; ต้อง rerun | isolated test accounts/preview |
| Profile sync/edit | #2 #16 | Web เรียก Supabase User จริง | mastery, avatar Storage, UX tests | User RLS | apps/web/lib/user-profile.ts | safe test DB |
| Persistent sessions/history | #8 #9 #14 | Prisma + JWT-scoped persistence จริง | whole-flow tests, failed-session recovery, retry correctness | Auth/DB | learning-sessions-router, PrismaLearningPersistence | real RLS fixture environment |
| P3.1 curated RAG integration | #11 #12 | merged แล้ว | fresh integrated regression and packaging | reviewed Knowledge | ancestor checks; code present | corpus มี concept เดียว |
| Retrieval relevance/history | #11 | lexical pilot | false positives, follow-up context, deterministic tests | P3.1 | voltage alone currently matches Ohm | ไม่มี |
| Embeddings/pgvector ingestion and Top-K | #3 #11 | ยังไม่มี working implementation | chunks/vectors/metadata/queries | safe DB, approved source | Prisma contract ไม่มี Document/Chunk จริง | safe non-production DB; embedding model/budget |
| Adaptive tutoring | #39 | stage prompts/history มีอยู่ | simpler hints, guided teaching, language, >=5 multi-turn scenarios | #12 | prompts and engine tests | live quality budget |
| Assessment PRE/POST scoring/persistence | #13 | model definitions เท่านั้น | creation/submission/scoring/profile/API/UI | #2 #3 | contract.prisma | safe DB migrations |
| Learning profile/statistics | #13 #16 | planned | mastery, strengths/weaknesses, pre/post history | Assessment | no endpoints | safe DB |
| Text/PDF/image normalization | #15 | text chat; upload ไม่ครบ | extraction/OCR/type/size/security/storage/engine input | #2 #3 | Create currently text only | OCR/runtime assets; safe Storage |
| Learning UI | #9 | persisted chat/structured blocks | stage, recovery, interactive/hint tests, mobile/accessibility | API contracts | Chat/[sessionId] | browser evidence pending |
| Dashboard/History/Profile | #16 | history real; other progress incomplete | real recent/mastery/pre-post + empty/error/loading | #13 | Account/History exists; /History absent | no feature API yet |
| Reliability/security | #14 | partial | readiness dependencies, auth timeout, log safety, public dev route | core integration | defects identified in app/auth/router | none for local fixes |
| Release readiness | #14/all | incomplete | builds, fresh install/DB/E2E/preview/issue criteria | all above | CI configured; latest hosted status failed | Vercel build limit, no safe DB yet |

## ลำดับงานที่ลงมือ

1. ปิด endpoint ทดลอง AI บน deployment/default runtime และหยุด logging raw dependency errors
2. เพิ่ม dependency readiness และ bounded Auth failures
3. rerun Phase 1, แก้ retrieval/adaptive behavior พร้อม regression scenarios
4. Assessment/profile backend -> UI, input pipeline, vector persistence, migration/E2E/release verification

## หลักเกณฑ์หลักฐาน

PASS = รันผ่านจริงกับ source ปัจจุบัน; NOT RUN = ยังไม่รัน; BLOCKED = ต้องพึ่งสิ่งภายนอก; tests ที่ใช้ transport/DB จำลองไม่ถือเป็น real Supabase RLS proof
ไม่แก้หลักฐาน live เดิม ไม่ลด schema/citation validators และไม่เรียก costly models โดยไม่มีงบ ไม่ apply production migration หรือปิด issue ที่ acceptance criteria ยังไม่ครบ

## Milestones

- Phase 0 audit: issues/branches/contracts/configuration checked; app migration graph verification continues. Unscoped Prisma check found 4 integrity failures (manual orphan space and missing Supabase extension migration artifacts); original failure retained in evidence.
- First security patch: disabled default/deployed in-memory AI routes, bounded Auth verification at 5 seconds, 503 on Auth outage/rate limit, removed raw exception logging, added 3-second dependency readiness, preserved custom profile avatar when starting new sessions.
- Tests on current patch: Knowledge 50/50; API 208/208; authenticated persisted RAG integration 8/8; Knowledge/API/Web typechecks and API compile pass; Web production build passes. Web `node --test` discovers **0** tests, so frontend regression remains missing.
- Real PostgreSQL RLS: `scripts/verify-session-rls.sql` passed owner read/write, cross-user session/message read/update/insert rejection and owner reassignment rejection. Transaction rolled back; remaining fixture users = 0. This uses simulated JWT claims at SQL level, not an actual login/browser test.
- Fresh source-only/relocated Knowledge check: PASS (387 seconds); deterministic 9 files, fresh API 208/208 and relocated runtime 4/4. This exports current source and copies installed dependencies, not fresh npm installation proof.
- Real readiness initially failed: API-only local env lacks publishable key; including Web env fixes Auth configuration. Anonymous-role DB probe failed SQLSTATE 42501; fixed connectivity probe to use `SELECT 1` on configured app connection, without reading tables or changing role. Real check now all `ok`; application queries remain Prisma/JWT-scoped.
- Declared already-installed pg 8.22.0 and @types/pg 8.20.4 explicitly for the connectivity probe; no version upgrade/download. Documentation: https://node-postgres.com/apis/client
- Prisma `migration check --space app --json` passes; this does not remove the 4 unscoped integrity findings or prove fresh database bootstrap.
- User authorized production project for tests: use rollback-contained synthetic data; no destructive production migrations or live-user changes.
- User approved total live AI/embedding budget **US$1** for this MVP run; spent by this Goal so far US$0. Verify prices/reserve worst-case cost before requests; no live calls yet.
- Supabase security advisor: leaked password protection disabled (WARN); account/plan setting remains unmodified. See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
