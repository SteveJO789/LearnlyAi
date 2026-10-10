# ตัวติดตามการทำ MVP ให้ครบ

เริ่มตรวจ 2026-10-09 จาก `origin/develop` commit `e2ddfdd7788a5d20d66b496ee2917771b6ea3021` บน branch `integration/university-mvp-20261009` ใน worktree แยก งานเดิมและ stash ไม่ถูกแก้ไข เป้าหมายยัง ACTIVE; ยังไม่ IMPLEMENTATION COMPLETE หรือ RELEASED

สถานะล่าสุด 2026-10-10: PR #74 และ design PR #76 ถูกทีม merge แล้ว; งานใหม่ต่อจาก develop `5022c28` บน `integration/university-mvp-followup-20261009` โดยนำเฉพาะ recovery/embedding ใหม่มา ไม่ทำซ้ำ commits ที่ merge แล้ว

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
| Persistent sessions/history | #8 #9 #14 | Prisma + JWT-scoped persistence และ explicit FAILED recovery | real Auth/browser whole-flow และ ambiguous interaction retries | Auth/DB | persisted integration 10/10; recovery RLS/atomic rollback จริง | public migration/browser proof |
| P3.1 curated RAG integration | #11 #12 | merged แล้ว | fresh integrated regression and packaging | reviewed Knowledge | ancestor checks; code present | corpus มี concept เดียว |
| Retrieval relevance/history | #11 | lexical pilot + bounded follow-up implemented | broader corpus/vector retrieval | P3.1 | core TP4/TN3/FP0/FN0; reset/revocation tests | corpus/model coverage |
| Embeddings/pgvector ingestion and Top-K | #3 #11 | chunking และ embedding adapter มีแล้ว; storage/Top-K ยังขาด | canonical chunk/vector model, ingestion, queries, live embeddings | pgvector pack, approved source | targeted tests 4/4; pgvector extension มีจริง | npm trust repair approval |
| Adaptive tutoring | #39 | mode/language/history; แก้ source-example borrowing และ premature numeric confirmation | independent educator review และ broader curriculum | #12 | 5 multi-turn regressions; live รอบแก้ 13/13 schema/citation/state | corpus/model coverage; บางคำใบ้ยาวเกิน preference |
| Assessment PRE/POST scoring/persistence | #13 | APIs, snapshot, deterministic scoring, atomic answers/profile implemented | broader question bank; real Auth/browser journey; release migration | #2 #3 | 6 real API/Prisma/DB groups PASS; HTTP/scoring tests | deploy after team merge |
| Learning profile/statistics | #13 #16 | owned APIs and Home/Profile UI implemented | browser/mobile QA; expanded curriculum evidence | Assessment | concurrent samples/PRE-POST comparison real DB PASS | develop-only CD |
| Text/PDF/image normalization | #15 | normalized persistent TEXT + engine materials implemented | PDF/image extraction/OCR, file validation/Storage | #2 #3 | NFC/math tests, real material RLS rollback PASS | OCR/dependency/runtime assets |
| Learning UI | #9 | stage, PRE/POST journey, 3 interactive widgets, structured blocks, explicit failure recovery | browser/mobile/keyboard QA | API contracts | rendering/client tests + persisted recovery + real recovery RLS | browser evidence pending |
| Dashboard/History/Profile | #16 | real summary metrics/recent sessions/comparisons, /History alias | browser/mobile/empty/error interaction checks | #13 | new metrics APIs + rendering/client tests | develop-only CD |
| Reliability/security | #14 | readiness ที่ระบุขอบเขตจริง, bounded Auth, safe logs, dev route ปิด, recovery | full browser security journey; production schema readiness | core integration | API 237/237; real cross-user/guard/rollback fixtures | deployment logs/access |
| Release readiness | #14/all | ยังไม่ครบ | full migration replay/public migration review, E2E, deployed smoke | all above | local Web/API builds ผ่าน; latest develop Web green/API red | npm repair, Vercel logs 403, public schema ยังเก่า |

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

### Milestone 6 — กู้คืน session หลัง provider failure

- เพิ่ม protected `POST /learning-sessions/{id}/recovery` รับ `{}` เท่านั้น เจ้าของกู้คืนได้เฉพาะ FAILED; stage/progress เดิมไม่เปลี่ยน และ version เพิ่มหนึ่งครั้ง
- เปลี่ยนสถานะและบันทึก SYSTEM event ใน transaction เดียว; event ไม่เข้าบทสนทนา AI และไม่บันทึก/ซ่อม rejected model output
- Chat retry กู้คืนเมื่อผู้ใช้กดเอง รวมกรณีเปิดหน้า FAILED session ใหม่; ไม่มี automatic provider retry หรือค่าใช้จ่าย AI ในการ recovery
- Integration 10/10, frontend 13/13 และ API/Web typechecks PASS
- Complete recovery milestone checks PASS: Knowledge 50/50, API 230/230, Web/API production builds, fresh source-only runtime packaging (9 deterministic files) and relocated runtime 4/4; [evidence](evidence/mvp-recovery-local-checks.json). Embedding modules added afterward have separate targeted tests, not this full-suite evidence
- PostgreSQL/RLS จริงแบบ BEGIN/ROLLBACK ผ่าน ownership, API-write guard, cross-user isolation, stale version, stage preservation และ event failure rollback; `fixture_removed=true` ไม่แก้ public tables/ข้อมูลผู้ใช้จริง
- CI run154 สำหรับ published head c16ec50 ผ่าน: https://github.com/SteveJO789/LearnlyAi/actions/runs/37957856223 . ยังไม่ใช่ CI proof ของ recovery commit ใหม่
- npm 11.19.0 registry signature/integrity ผ่าน แต่ installed runtime บางไฟล์ต่างจาก official archive; เตรียม same-version repair/backup ใน ignored `.verification/npm-repair/` และขออนุมัติ เพราะเป็น software/trust state นอก repository
- Supabase pgvector 0.8.2 ติดตั้งใน extensions schema แล้ว (read-only inventory); ยังไม่สร้าง production Knowledge tables หรือเรียก paid embeddings
- งานถัดไป: embedding/chunking และ Top-K integration; PDF/image/OCR รอ npm repair approval. Live budget ใช้ US$0 จาก US$1

### Retrieval foundation (กำลังทำ ยังไม่ครบ pipeline)

- เพิ่ม deterministic reviewed-passage chunking: NFC/LF, paragraph/formula ไม่ถูกตัด, content/passsage hashes, document/version/source metadata และ page=null เมื่อไม่มีข้อมูลหน้า
- เพิ่ม real OpenRouter embedding adapter: จำกัด input/batch/timeout/response bytes, ตรวจ model/index/dimension/finite nonzero vector และปิดบัง raw provider errors; ไม่มี Mock fallback ใน runtime
- Tests 4/4 และ API compile PASS โดย injected transport ไม่ใช่ paid live embedding evidence
- Prisma 8 PSL เวอร์ชันที่ติดตั้งไม่รองรับ `Unsupported("extensions.vector")` (ตรวจใน ignored scratch contract เท่านั้น); ต้องใช้ pgvector extension pack ตาม public Prisma contract API ไม่สร้างตารางแยกนอก canonical migration
- Storage/Top-K/runtime wiring และ live quality ยังไม่ implemented/verified; รอ dependency installation หลัง npm repair approval ก่อนเพิ่ม extension pack/PDF/OCR libraries

### Milestone 7 — live adaptive verification และ follow-up จาก develop ล่าสุด

- PR #74 merge a7cd027 และ PR #76 design merge 5022c28 ตรวจจาก GitHub/Git จริง; คง design ใหม่และไม่มี auto-merge โดย agent
- Live รอบแรก: 5 conversations/13 turns ผ่าน schema/citation/state แต่ตรวจพบ HINT ยืมตัวเลขจาก reference example และ GUIDE ยืนยันตัวเลขโดยไม่ทราบ givens; เก็บ raw evidence เดิมแยก ไม่อ้างว่า quality ผ่านทั้งหมด
- แก้เฉพาะ adaptive instructions: ไม่ถือ reference example เป็นโจทย์ learner; ต้องขอ givens ก่อนยืนยันตัวเลข ไม่แก้ schema/validator/stage authority
- Live รอบหลังแก้: 13/13 schema, retrieval expectation, exact citation linkage และ engine binding; ตรวจคำใบ้/feedback แล้วสองข้อบกพร่องข้างต้นไม่เกิดในรอบนี้ ยังต้อง educator review และ corpus coverage เพิ่ม
- ค่าใช้จ่าย OpenRouter ที่รายงานรวม 26 calls **US$0.0214265**; กันงบสะสม **US$0.31889835** จากเพดาน US$1; no retry, ledger จองงบก่อน request และไม่คืน reservation เมื่อ response กำกวม
- [Live summary](evidence/mvp-adaptive-live-verification.json); raw synthetic evaluation outputs/ledger เก็บใน ignored paths ไม่เขียนทับ P3/P3.1 historical evidence
- พบ architecture regression test failure จาก embedding transport อยู่ใน Knowledge module; ย้าย HTTP adapter ไป AI/providers และคง Knowledge port เป็น pure interface รวม hashing ที่จำเป็นเท่านั้น หลังแก้ API **237/237** ผ่าน
- Latest develop + follow-up Web typecheck/tests **13/13** และ production build ผ่าน; API typecheck/compile ผ่าน; recovery integration 10/10 และ SQL/RLS evidence ไม่เปลี่ยน
- develop 5022c28: Vercel Web status success, API failure; connector 403 และ browser initialization ล้มเหลว ยังไม่มี build log/cause ที่ยืนยัน จึงไม่เดาสาเหตุหรือ redeploy เพื่อเผา quota
- อ่าน public catalog ซ้ำ: Assessment ยังไม่มี topic/snapshot/submissionHash; Assessment/Answer/Profile/SourceMaterial มี SELECT policies เท่านั้น ยังไม่มี API-write policies ใหม่ ไม่มี public migration โดย agent
- กำลังรอคำตอบเรื่องซ่อม npm ส่วนกลางและข้อความ Vercel build error; ทำ historical migration verification และส่วนที่ไม่ต้องติดตั้ง dependency ต่อได้

### Milestone 8 — Fresh database baseline / ตรวจพบข้อบกพร่อง historical replay

- PR #78 เปิดและ CI run162 ผ่านสำหรับ remote 6fd9d8b: https://github.com/SteveJO789/LearnlyAi/actions/runs/38020135720 . ยังไม่ใช่ proof ของ milestones หลังจาก head นี้
- main ถูกทีม merge develop ผ่าน PR #77 เป็น 0602e0c; agent ไม่ merge/main/deploy และยังคง CD เฉพาะ develop
- Legacy 8-migration SQL replay ล้มเหลวที่ policy drop precheck: snapshot 075d335 อ้าง policies 10 ตัว แต่ migration ก่อนหน้าไม่สร้าง policies เหล่านั้น; graph integrity PASS ไม่พิสูจน์ replay ได้ เก็บผล failed และ rollback แล้ว fixture_removed=true
- สร้างทางเลือก baseline ใหม่จาก @empty→d17a8bc ด้วย Prisma CLI โดยไม่แก้ historical hashes: current tables/FKs/indexes/RLS + explicit app table grants, ไม่มี legacy Auth tables/data cleanup หรือ global role mutation
- Actual PostgreSQL rollback test: **68 SQL steps / 126 canonical pre/post checks PASS**, owner legacy identity อ่านได้/foreign user อ่านไม่ได้; fixture_removed=true
- Read-only db migrate --show เลือก fresh app baseline + existing Supabase descriptor record; ยังไม่ execute Prisma marker/history หรือ public production migration
- [หลักฐาน](evidence/mvp-fresh-baseline-verification.json); existing DB ต้องใช้ verified current marker ไม่ replay fresh baseline
- เพิ่ม routing max_price/no provider fallback ใน paid evaluation runner เพื่อให้ราคา endpoint ไม่เกินราคาใช้คำนวณ reservation; offline budget tests 3/3 ผ่าน ไม่เรียก paid model เพิ่ม

### Milestone 9 — รักษา ownership/history ของข้อมูลบัญชีเก่า

- Aggregate audit พบ User.id ≠ authUserId 1 แถว โดยไม่อ่าน/แสดงตัวตนหรือข้อมูล learner; historical backfill รองรับกรณีนี้ แต่ API/Profile lookup เดิมสมมติ id=Auth UID
- Backend resolve owned application User.id ผ่าน authUserId ภายใต้ JWT-bound Prisma/RLS เดิม ก่อนใช้ FK filters สำหรับ sessions/recovery/materials/assessments/profile; ไม่เปลี่ยน verified Auth identity หรือข้อมูลจริง
- Browser profile sync/read/edit/theme lookup ใช้ authUserId; คง primary key, ชื่อและ custom avatar ของบัญชีเก่า และคง convention ของบัญชีใหม่
- Simulated persistent integration **11/11**, frontend **16/16**, API **239/239**, API/Web typechecks/compile และ Web production build PASS
- Fresh source-only export + relocated runtime PASS: API239/239 และ runtime4/4; snapshot ก่อนเพิ่ม native routing price guard ซึ่งมี budget tests3/3 แยก ไม่อ้างว่า export ตรวจ price guard ใหม่แล้ว
- ยังไม่ใช่ actual OAuth/browser E2E หรือ live deployed repair; production schema/API deploy และ npm repair approvals/log access ยังเป็น blockers

### Milestone 10 — History ใช้ผลสอบจริง

- Goal ถูกพักตามคำสั่ง แล้วสถานะกลับมา ACTIVE ก่อนทำงานต่อ; เก็บงาน WIP เดิมและทำให้ครบ
- แทน empty prototype testResults array ด้วย owned progress API comparisons; default History แสดง Chat จริงและอยู่หลัง RequireAuth
- PRE/POST แสดง 0/null ต่างกัน, delta เป็นจุดเปอร์เซ็นต์, วันที่เป็น session updatedAt จริง ไม่ปลอมว่าเป็นวันสอบ; กรองวันที่และ links ใช้ session IDs ที่ encode
- Sessions/results load แยกกัน มี loading/error/retry; คง Cake layout พร้อม responsive columns และ labels/ARIA
- Frontend **20/20**, typecheck และ final production build PASS; [หลักฐาน](evidence/mvp-history-verification.json). ไม่อ้าง browser interaction/mobile visual proof
- CI run163 ของ head24317df ผ่านก่อน milestone นี้: https://github.com/SteveJO789/LearnlyAi/actions/runs/38022572450
- Read-only production Prisma verify: exit4 / verificationOk=false, Hash mismatch; marker storageHash=c7b3938 ก่อน 3 app deltas ไป d17a8bc ไม่มีการเปลี่ยน marker/schema/data
- งานถัดไป:ตรวจ migration path จาก actual marker และ release preparation; PDF/OCR/pgvector dependencies ยังรอ npm repair approval และ Vercel API error log ยังไม่มีสิทธิ์อ่าน

### Milestone 11 — คำตอบตัวเลขไม่หลุดภาษา/บริบท

- เขียน regressions ก่อนแก้ พบ 2 failures จริง: “40 V” หลังบทสนทนาไทยเลือก English/STANDARD และไม่ retrieve reviewed context เดิม
- เพิ่ม bounded numeric reply recognition (ไม่คำนวณ/ให้คะแนน), ใช้ล่าสุดของ learner เพื่อเลือกภาษา, GUIDE feedback และ context anchor ที่ยังต้อง reread review eligibility; topic reset/explicit English/Thanks ยังชนะ history
- เพิ่ม server-selected teachingPolicy ใน task prompt; ไม่เปลี่ยน Tutor Output schema/engine authority และไม่ซ่อม model-authored blocks/citations
- Live numeric 3 rounds/9 calls: พบ language drift แล้วแก้; พบ method confirmation ที่ไม่ทราบ reasoning แล้วแก้ รอบสุดท้ายตอบไทยกับ numeric และ English acknowledgement ได้ แต่ยังมี recap เล็กน้อย
- Current full live regression 5 conversations/13 turns: schema/citation/engine binding/retrieval expectation 13/13; generic hint ยังสมมติว่าปัญหาต้องหา V จาก I/R ทั้งที่ learner ไม่ให้โจทย์ จึงไม่อ้าง all teaching quality PASS
- Goal รวม 48 paid calls reported **US$0.02957363572**, conservative reservations **US$0.5915484** จาก US$1; [หลักฐาน](evidence/mvp-numeric-followup-verification.json). No retry/native price ceiling, CI offline
- API **244/244**, persistent integration **11/11**, compile/typecheck และ fresh source export244/244 + relocated runtime4/4 PASS; Web20/20/build เดิมไม่มี frontend code changes รอบนี้
- CI164 ของ History head6a4ff2c ผ่านก่อน numeric milestone: https://github.com/SteveJO789/LearnlyAi/actions/runs/38025240138
- Read-only db migrate --show จาก actual c7b3938 ไป d17a8bc เลือก 3 app deltas + Supabase descriptor; ไม่เลือก fresh baseline ไม่ apply/sign production

### Milestone 12 — vector retrieval และการตรวจฐานข้อมูลจริง

- Resume ตามคำสั่งผู้ใช้; งานต่อจาก file foundation แล้วเข้าสู่ PDF/OCR และ vector retrieval โดยรักษาขอบเขต MVP เดิม
- เพิ่ม bounded conversation-aware semantic retrieval และ JWT-bound Prisma Top-K query โดย filter model/dimensions/subject/language และ cosine threshold; database candidate ไม่มีอำนาจสร้าง trusted citations
- Re-read reviewed source หลัง external IO และเทียบ chunk/passage/content/provenance hashes รวม exact source URLs/licenses; ปฏิเสธ stale/revoked/forged results และคืน teaching passage เต็ม
- Compile เคย fail เพราะใช้ raw scalar returns แทน returnsRow; แก้แล้วผ่าน Architecture test เคย fail เพราะวาง Prisma adapter ใน Knowledge boundary; ย้ายไป prisma โดยไม่ลดข้อกำหนดการทดสอบ
- API **255/255**, vector-specific **6/6**, persistent simulated integration **11/11** และ compile PASS
- Actual PostgreSQL/pgvector SQL assertions ผ่าน Top-K/ties/filters/threshold/hostile model string/RLS/read-only privileges ใน BEGIN/ROLLBACK; `fixture_removed=true` ไม่แก้ public tables/ข้อมูล learner ไม่ใช่ actual Auth→Prisma vector execution หรือ live embedding quality
- CI175 ของ previous file head9c587f PASS; ไม่ใช่ CI proof ของ milestone ใหม่ [หลักฐาน](evidence/mvp-vector-search-verification.json)
- Canonical pgvector contract/ingestion/runtime wiring และ PDF/OCR ยังไม่ครบ npm repair approval ยัง pending; ไม่มี paid calls เพิ่ม ไม่ reset งบ US$1
- งานถัดไป: real file extraction/OCR และ canonical vector persistence หลัง dependency installation ใช้ได้; เอกสารรายละเอียด [vector integration](vector-retrieval-integration.md)

### File foundation (ยังไม่ complete input pipeline)

- เพิ่ม header/MIME/size/hash/filename checks และ PNG dimension cap; ไม่อ้างว่าตรวจ full file content/extraction แล้ว
- เพิ่ม real user-JWT private Storage transport (HTTPS/no redirect/no upsert, owned prefix, immutable verified bytes, safe errors); runtime ยังไม่ wired และ private bucket/RLS ยังไม่ created/verified
- Targeted tests5/5, API compile และ full offline API249/249 PASS; HTTP transport injected ไม่ใช่ actual Storage upload proof
- [ขอบเขตและงานที่ขาด](file-input-foundation.md); PDF/image decoder/OCR/pgvector dependencies ยังติด npm repair approval ไม่ bypass trust gate
- CI171 ของ numeric heade14722c ผ่านก่อน file foundation: https://github.com/SteveJO789/LearnlyAi/actions/runs/38027199110
