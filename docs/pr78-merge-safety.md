# PR #78: ตรวจความปลอดภัยก่อนรวมเข้า develop

ตรวจใหม่วันที่ 2026-10-11 จาก develop `4c2e0a7` และ PR HEAD เดิม `fc6d4c6` โดยไม่ merge, deploy, เปลี่ยน production schema หรือแก้ข้อมูลผู้ใช้จริง

## รายการที่ต้องจัดการตามความสำคัญ

| ความสำคัญ | รายการ | ผลล่าสุด / สิ่งที่ต้องทำ |
|---|---|---|
| Critical | ฐานข้อมูลปัจจุบันไม่มี FileUpload/KnowledgeChunk และคอลัมน์ assessment ใหม่ | ปิดฟีเจอร์ใหม่โดยค่าเริ่มต้น; ตรวจ catalog จริงแล้ว |
| Critical | Create บังคับ pre-test ที่ฐานข้อมูลยังใช้ไม่ได้ | แก้ให้ข้อความใช้ interaction/message เดิม แล้วไป Chat เมื่อ assessment ปิด |
| Critical | migration marker ปัจจุบัน c7 ไม่ตรง tip f099 | ตรวจ forward SQL ใน clone ปัจจุบันผ่าน; ยังต้องทดสอบ Prisma executor/marker จริงในฐานทดสอบก่อนอนุมัติ apply |
| High | private bucket ยังไม่มี และ live Storage ยังไม่ได้ทดสอบ | upload/review/recovery/cleanup/download/File History ปิดทั้งหมดก่อนสร้าง context หรืออ่าน bytes |
| High | live Auth → Prisma → Chat/History/Profile baseline ยังไม่ได้ตรวจในรอบนี้ | ต้อง smoke ด้วยบัญชีทดสอบที่ได้รับอนุญาต; offline tests ไม่แทน live proof |
| High | deployed Vercel function tracing/size/memory ยังไม่ยืนยัน | local build/schema/glob/runtime ผ่าน; ไม่มี deployment หรือใช้ quota ในรอบนี้ |
| Medium | Settings preferences/privacy/delete-account ยังเป็น prototype | ไม่อยู่ใน fixes รอบ merge safety; ห้ามถือว่า MVP ทั้งหมดเสร็จ |

PR คงเป็น **Draft / NOT READY** จน baseline live Prisma/Auth smoke และรายการที่อาจกระทบ deployed baseline ได้รับการตรวจโดย reviewer. ฟีเจอร์ที่ปิดอยู่ไม่ใช่หลักฐานว่าเปิดใช้งานจริงได้แล้ว

## Feature flags

มีจุดอ่าน config กลางที่ `services/api/src/shared/features.ts`; รับเฉพาะค่า `true` ตัวพิมพ์เล็กจาก operator environment. ไม่มี client/user metadata override

| ตัวแปร API | ค่าเริ่มต้น | เปิดเมื่อ |
|---|---|---|
| LEARNLY_ASSESSMENTS_ENABLED | false | schema/Prisma marker/executor, grants/RLS, scoring/profile และ owned text material writes ผ่านฐานทดสอบ |
| LEARNLY_FILE_UPLOADS_ENABLED | false | assessment เปิด และ private bucket/policies/Storage→DB→review→learn→history รวม cancel/race/cleanup ผ่าน |
| KNOWLEDGE_RETRIEVAL_MODE | lexical | vector ต้องตั้ง `vector` เอง พร้อม model/dimensions/threshold/Top-K, reviewed index และ current marker ที่ตรวจแล้ว |

API `GET /api/v1/capabilities` (`/api/capabilities` ผ่าน Next rewrite) ส่ง boolean สองค่าแบบ no-store ไม่มี secrets หรือการเชื่อม DB/Storage. หน้าเว็บอ่าน runtime config จาก API. ขณะโหลด/ผิดพลาด UI ปิดฟีเจอร์ใหม่ และข้อความยังใช้เส้นทางเดิมได้. API authenticate ก่อนคืน `503 FEATURE_DISABLED`, ไม่สร้าง DB/Storage/extractor/scoring context. หน้า Home/Profile ไม่เรียก assessment endpoints เมื่อปิด; History session เดิมยังอ่านได้; direct Assessment route แสดงยังไม่เปิดใช้งาน

ข้อความเริ่มเรียนผ่าน authenticated interactions และบันทึก USER/TUTOR messages ก่อนนำไป Chat. ไม่มีคะแนน/mastery ปลอม; เมื่อปิด assessment ไม่มีการอ่านตาราง assessment ระหว่างเปลี่ยน stage. Engine ยังควบคุม stage/progress และ strict output/citation validation เหมือนเดิม

## ฐานข้อมูลและ migration

Read-only catalog จริงยืนยัน marker `c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665`, profile `3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2`. มี ownership RLS ผ่าน User.authUserId และ manual session/message write policies. SourceMaterial/Assessment/Profile มี SELECT แต่ยังไม่มี authenticated write grants ที่ฟีเจอร์ใหม่ต้องใช้. ไม่มี private bucket `learnly-materials`, FileUpload และ KnowledgeChunk

เส้นทาง forward: เริ่มจาก marker ที่อ่านจริง c7 → 20261009T1032_session_ownership_contract → assessment writes → text material pipeline → private Storage → durable uploads → journal guard → learner review → reviewed vectors → cleanupAt (tip f099). ห้ามใช้ fresh baseline ทับฐานเดิม ห้าม replay migrations ที่ ledger ระบุว่าใช้แล้ว ห้าม sign/ปลอม marker เพื่อข้าม drift

`render-current-database-verification.mjs` clone เฉพาะ definitions/indexes/checks/FKs/policies/grants ของ 7 ตาราง ไม่มีข้อมูลจริง; guard marker/collision; ใส่ผู้ใช้/session สมมติที่ app ID ไม่ตรง auth ID; รัน canonical suffix SQL/pre-post checks; ตรวจ preservation/cross-user RLS แล้ว rollback. PASS และ fixture_removed=true. ไม่ได้รัน Prisma migration executor และไม่เขียน marker/ledger จริง

Fresh rollback fixture: 7 migrations, 105 SQL steps, 194 canonical checks PASS. การ replay historical chain ตั้งแต่ศูนย์แบบ legacy ล้มที่ policy precheck `20261007T1022_auth_rls_alignment / AIRequest.ai_request_select_own.drop` เพราะชื่อ policy เก่าไม่ตรง generated baseline. เก็บความล้มเหลวไว้และไม่แก้ applied history; ใช้ fresh baseline สำหรับฐานใหม่ และ suffix จาก marker จริงสำหรับฐานเดิม. Initial current-clone verifier มี record/SQL alias ชื่อ k ชนกัน; แก้เป็น ck และรันผ่านจริงแล้ว

ทั้ง fixtures ถูก rollback แล้ว ตรวจ marker c7 ไม่เปลี่ยน. SQL/RLS pass ไม่ใช่ production approval. ก่อน apply ต้องตรวจ drift/manual policies กับ executor จริงในฐานทดสอบ ตรวจ backup/restore และให้ผู้ใช้อนุมัติ migration bundle ที่ review แล้ว

## ผลทดสอบที่รันจริง

| คำสั่ง/การตรวจ | ผล |
|---|---|
| API npm run test (รวม production build) | 329/329, skipped 0 |
| API npm run test:persistent | 15/15, offline Auth/DB ports |
| Web npm run test | 37/37 |
| API/Web npm run lint | PASS |
| Web npm run build | PASS; 17 static pages รวม dynamic Chat/Assessment |
| npm exec -- prisma migration check | PASS, ไม่ apply |
| PostgreSQL fresh/current fixtures | PASS/rollback/removed; historical replay failure แยกบันทึกด้านบน |
| Vercel configs กับ schema ทางการ | PASS ผ่าน existing AJV (ไม่ตรวจ URI formats/meta-schema draft-04); includeFiles 157 < 256 |
| runtime glob tests | PASS: Knowledge/PDF/OCR workers/dependencies/models มีจริง |

CI ของ final pushed HEAD ต้องตรวจอีกครั้งหลัง push; historical CI240 ไม่ใช้แทน final-head proof. `.github/workflows` ไม่มีการเปลี่ยน; Web/API CD ยัง `{ "**": false, "develop": true }`. Node 24.x. dependencies ใหม่ใน PR คง exact pinned versions; ไม่มี dependency upgrade ใน fixes รอบนี้

ไม่ได้รัน: live Google/email/browser login/logout, password mutation, actual Prisma/JWT/Storage journey, mobile/keyboard E2E, deployed Vercel smoke/trace/RSS หรือ paid OpenRouter calls. Scanned PDF OCR, broader reviewed curriculum และ receipt retention policy ยังมีข้อจำกัดตามเอกสารเดิม

## ขั้นตอน review ใน GitHub

เปิด PR #78 → Files changed ตรวจ feature gates/Create/capabilities และ fixture → Checks ตรวจ final SHA ตรง commit ที่จะรวม → อ่านเอกสารนี้/หลักฐาน. คง Draft จน baseline live smoke และข้อกังวล compatibility ถูกยืนยัน. หลังผู้ใช้อนุมัติ merge ต้องคง flags=false และ lexical จน post-merge infrastructure gates ผ่าน ห้ามเปิดฟีเจอร์หรือ apply production migrationsเพราะ CI สีเขียวเพียงอย่างเดียว
