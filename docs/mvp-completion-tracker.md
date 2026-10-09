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
| Retrieval relevance/history | #11 | lexical pilot + bounded follow-up implemented | broader corpus/vector retrieval | P3.1 | core TP4/TN3/FP0/FN0; reset/revocation tests | corpus/model coverage |
| Embeddings/pgvector ingestion and Top-K | #3 #11 | ยังไม่มี working implementation | chunks/vectors/metadata/queries | safe DB, approved source | Prisma contract ไม่มี Document/Chunk จริง | safe non-production DB; embedding model/budget |
| Adaptive tutoring | #39 | deterministic language/mode + stage/history prompts | real model teaching-quality review | #12 | 5 multi-turn regressions + language test pass | live quality not run yet |
| Assessment PRE/POST scoring/persistence | #13 | APIs, snapshot, deterministic scoring, atomic answers/profile implemented | broader question bank; real Auth/browser journey; release migration | #2 #3 | 6 real API/Prisma/DB groups PASS; HTTP/scoring tests | deploy after team merge |
| Learning profile/statistics | #13 #16 | owned APIs and Home/Profile UI implemented | browser/mobile QA; expanded curriculum evidence | Assessment | concurrent samples/PRE-POST comparison real DB PASS | develop-only CD |
| Text/PDF/image normalization | #15 | normalized persistent TEXT + engine materials implemented | PDF/image extraction/OCR, file validation/Storage | #2 #3 | NFC/math tests, real material RLS rollback PASS | OCR/dependency/runtime assets |
| Learning UI | #9 | stage, PRE/POST journey, actual 3 interactive widgets, structured blocks | provider-failure recovery, browser/mobile/keyboard QA | API contracts | rendering/calculator/contract tests; build PASS | browser evidence pending |
| Dashboard/History/Profile | #16 | real summary metrics/recent sessions/comparisons, /History alias | browser/mobile/empty/error interaction checks | #13 | new metrics APIs + rendering/client tests | develop-only CD |
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

### Milestone 2 — conversation-aware retrieval / adaptive instructions

- Milestone 1 local commit `8699721`, remote equivalent `6ba99c6`; tree hash เท่ากันทุกไฟล์
- Draft PR https://github.com/SteveJO789/LearnlyAi/pull/74 — ไม่ merge และไม่ปิด issues
- ตัด voltage/current-only match; transformer/battery/induction ไม่โยง Ohm อัตโนมัติ
- Follow-up ใช้ learner history สูงสุด 4 turns และ re-read review eligibility ทุกครั้ง; topic switch/thanks ไม่รับ citation เก่า
- Adaptive mode ACKNOWLEDGE/SIMPLIFY/HINT/GUIDE/STANDARD และภาษา th/en จาก current input/explicit request; stage/progress เป็น engine authority, ไม่ repair model output
- Regression 5 บทสนทนา + language override ผ่าน; แก้ Thai NFKC สระอำให้ตรวจ “คำใบ้” ได้
- API 220/220; persisted integration 8/8; core retrieval TP4/TN3/FP0/FN0 และ offline 13 records ตรงกับ expected retrieval
- Failures ที่แก้: lowercase Ω, query-port assertion ไม่รองรับ history, history test parse plain text เป็น JSON และ Thai NFKC keyword mismatch; rerun ผ่านโดยไม่ลด validators
- ผล offline ใหม่แยกด้วย `--output`; ไม่แก้ historical P3/P3.1 live evidence
- ข้อจำกัด: adaptive tests ตรวจ instruction/history/state ไม่พิสูจน์ model teaching quality; vector/assessment/upload ยังไม่ครบ
- Fetch อีกครั้ง: develop ยัง e2ddfdd; งานถัดไป canonical Prisma write-policy/migration consistency สำหรับ Assessment/Profile/Input APIs จริง

### Deployment policy ที่ยืนยันโดยผู้ใช้

- **CD เฉพาะ branch develop เท่านั้น**; integration/feature branches ต้อง skip เพื่อรักษา quota
- GitHub statuses ของ PR #74 เป็น success แต่ Vercel bot ระบุ Ignored/Skipped ซึ่งถูกต้องตาม policy ไม่ใช่ deployment proof
- ไม่แก้ skip setting และไม่ auto-merge เพื่อให้ได้ preview; ทดสอบ local/CI ก่อน แล้วให้ทีม review/merge เข้า develop ก่อน deployed smoke test
- Vercel connector ไม่มีสิทธิ์ scope webdev-bd06 (403); ไม่ retry unchanged และไม่เปลี่ยน access controls

### Milestone 3 — canonical persistence ownership foundation

- ย้าย manual SQL เดิมไป `services/api/scripts/historical-sql/` พร้อมเก็บเนื้อหาเดิม ไม่ให้ Prisma ตีความเป็น migration space
- เพิ่ม canonical LearningSession INSERT/UPDATE และ Message INSERT ownership policies; regenerate contract ด้วย Prisma CLI
- สร้าง migration `20261009T1032_session_ownership_contract` จาก tip c7b3938 ไป 909232e อย่างชัดเจน; มี grants ที่จำเป็นและ 3 policies
- `migration plan` seed Supabase extension snapshot/head จาก descriptor จริง โดยไม่มี Auth schema migration operations; ไม่สร้างระบบ Auth เอง
- Prisma unscoped `migration check --json`: **All checks passed**; API typecheck/compile และ tests **220/220** ผ่านกับ regenerated contract
- ทดสอบ operations/grants ใหม่จริงใน schema แยก `learnly_mvp_ownership_verify` โดย clone เฉพาะโครงสร้าง User/LearningSession/Message ว่าง; เพิ่ม FK/RLS และตรวจ owner/cross-user/reassignment
- ผลจริง: checks passed, ROLLBACK, `schema_removed=true`; ไม่อ่าน learner rows และไม่ ALTER public tables
- ขอบเขตหลักฐาน: ตรวจ new migration operations กับ empty clones ไม่ใช่ replay historical baseline/data migrations ครบทั้ง graph และยังไม่ได้ apply migration ใหม่ลง public production schema
- CLI default origin `db` ยังชี้ baseline เก่า d7a4d82; first generated plan จึง fork/มี placeholders — เก็บ draft ผิดไว้ใน ignored evidence แล้ว regenerate ด้วย `--from c7b3938` ไม่ apply draft
- Release gate: inspect actual production migration history/marker before applying any package; ห้าม replay legacy destructive data cleanup อัตโนมัติ
- งานถัดไป: Assessment question snapshot/scoring/owned persistence และ Learning Profile APIs/UI (#13/#16)

### Assessment implementation เริ่มแล้ว (ยังไม่ complete)

- สร้าง deterministic exercises สำหรับ linear equations และ Ohm calculations ด้วย original templates; ไม่อ้างว่าเป็น reviewed Knowledge
- Question seed ผูกกับ assessment ID/topic/phase; pre/post snapshot ทำซ้ำได้และคะแนนไม่ใช้ LLM
- Validate finite numeric answers, issued question IDs, duplicate/missing answers และ reject client score metadata; public question DTO ไม่มี grading rule/answer key
- Scoring tests 3/3 + API typecheck ผ่าน; ยังต้องทำ snapshot persistence, owned submission transaction, server-owned score protection, Learning Profile endpoints และ UI
- Local milestone mapping: 8699721→remote6ba99c6, 7bf96bf→remote96e79e4, 6b0ddc5→remote3aab5fb; trees ตรงกันทุก milestone

### Milestone 5 — Assessment/Profile integration and text intake

- Implemented creation/retrieval/submission for PRE/POST/TRANSFER, immutable generated numeric snapshots, deterministic scoring and exact-retry receipts; client score fields rejected
- Real Prisma adapter keeps ownership/RLS active; one transaction writes score + answers + profile. Per-user advisory lock prevents concurrent topic updates from losing samples
- New restrictive API-write guards prevent direct owned progress/tutor-message edits through Data API; assessment/profile writes require both ownership and transaction-local API context
- Real API→Prisma→PostgreSQL verification: 6 groups PASS (score/answers, concurrent mastery, comparisons, retry, isolation/tamper protection, rollback). Signed test identities/Auth transport injected; not real OAuth/login
- Fixture COMMIT initially rejected by automatic approval review; user explicitly authorized isolated fixture creation + cleanup. Schema created only for tests, then deleted; `fixture_removed=true` verified. No public production tables or learner records changed
- New TEXT material API persists normalized input with NFC/LF, content hash and byte size. Superscript math survives; arbitrary control characters rejected. Material is USER_MATERIAL, never reviewed Knowledge
- Material RLS rollback test PASS; owned text persisted, another learner cannot read/write it, all fixture objects removed
- Create persists text -> Assessment PRE -> Chat reads input from owned materials; raw input no longer appears in new Create URLs. PRE must be submitted before learning and POST before completion; legacy standalone/direct flows retained
- New Home/Profile metrics, strengths/weak points/latest sample sizes, recent sessions and paired scores use authenticated APIs; /History preserves Cake page via redirect
- Assessment UI has labels, numeric validation, loading/errors/retry/idempotent resubmission; Chat shows stage; all 3 interactive components now compute with editable controls
- Final milestone checks: Knowledge 50/50; API 230/230; persisted learning/RAG integration 9/9; frontend client/render/simulation 12/12; all typechecks/builds pass. Fresh source-only export: deterministic 9 Knowledge files, API 230/230 and relocated runtime 4/4 PASS
- CI run153 (head de6a68c) passed on Linux with fresh installs/source packaging: https://github.com/SteveJO789/LearnlyAi/actions/runs/37920597651 . Current changes require a new CI run; do not reuse that run as current-head proof
- Pending: browser/mobile/keyboard E2E; provider-failure recovery; PDF/image/OCR; embedding/pgvector; full historical migration replay; release/public migration and deployed smoke after team merge into develop
- Next implementation: file input + retrieval persistence after publishing/reviewing this milestone. Live AI budget remains US$0 of approved US$1
- Local npm still blocked by NVM4306 (untrusted delegated npm-cli.js, npm package 11.19.0). Do not invoke the delegated script indirectly or blindly trust it; verify provenance/repair before installing PDF/OCR dependencies
