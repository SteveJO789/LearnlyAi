# หลักฐานตรวจสอบ MVP

สถานะล่าสุด 2026-10-10: **กำลังทำ — ยังไม่ IMPLEMENTATION COMPLETE และยังไม่ RELEASED**

PR #74 และ design PR #76 ถูก merge โดยทีมแล้ว งานใหม่อยู่บน `integration/university-mvp-followup-20261009` จาก develop `5022c28` งานเดิมใน primary checkout/stash ยังอยู่ครบ

## ฟีเจอร์และหลักฐาน

| ฟีเจอร์ / issue | สิ่งที่ทำงานแล้ว | สิ่งที่ยังขาด |
|---|---|---|
| Auth / #5 #6 | รักษา Supabase Google/email/verification, callback→Home, Bearer verification; auth regression ผ่าน | real login/browser journey รอบล่าสุด |
| Session / #8 #9 #14 | Prisma persistence/history, stage/progress จาก engine, explicit FAILED recovery พร้อม atomic event | browser retry และ ambiguous network receipt |
| RAG / #11 #12 | Reviewed Ohm pilot, runtime packaging, history-aware retrieval, exact citations และ strict schema | broader reviewed corpus, vector storage/Top-K |
| Embeddings / #3 #11 | chunking แบบรักษาสูตร/paragraph/hash/provenance และ real OpenRouter transport มี limits/validation | pgvector contract pack, ingestion/storage, live embedding test |
| Adaptive tutor / #39 | 5 multi-turn offline scenarios; live 5 conversations/13 turns หลังแก้สอง teaching defects ผ่าน schema/citation/state | educator review, broader model/topic coverage |
| Assessment / #13 | PRE/POST/TRANSFER, immutable snapshots, deterministic scoring, answer receipts และ atomic profile update | broader exercise bank, real Auth/browser และ public migration |
| Profile/History / #16 | owned metrics/mastery/latest samples/PRE-POST comparisons ผ่าน API และ UI | browser/mobile/keyboard QA |
| Input / #15 | TEXT validation/NFC/LF/hash/persistence, คง x² และ USER_MATERIAL identity | PDF/image/OCR/file validation/private Storage |
| Learning UI / #9 | Create→PRE→Chat→POST, structured blocks, stage/progress, 3 interactive widgets | complete browser E2E และ uploads |
| Release / #14 | local builds/tests และ source-only Knowledge packaging ผ่าน | public schema update, API deploy failure diagnosis, deployed smoke |

รายละเอียด acceptance criteria/dependencies อยู่ใน [ตัวติดตามงาน](mvp-completion-tracker.md) ไม่มี issue ถูกปิดเพียงเพราะเขียนโค้ด

## สถาปัตยกรรมและ API

คง Next.js/React/TypeScript, Express modular monolith, Node 24/npm, Supabase Auth/PostgreSQL/Prisma/RLS, ModelProvider Mock/OpenRouter และ canonical Tutor Output ไม่มี Docker/Azure/custom authentication sessions

เพิ่ม protected assessment/profile/progress/material APIs ตาม [API contract](api-contract.md) และ `POST /learning-sessions/{id}/recovery` รับ `{}` เท่านั้น กู้คืนเฉพาะ session FAILED ของเจ้าของ โดย stage/progress เดิมไม่เปลี่ยนและ version เพิ่ม การเปลี่ยนสถานะกับ SYSTEM event อยู่ใน transaction เดียว; operational event ไม่เข้าประวัติที่ส่งให้ AI ไม่มีการซ่อม rejected output หรือ retry model อัตโนมัติ

แยก embedding HTTP transport ไว้ใน AI/providers; Knowledge ใช้ pure embedding port และ deterministic reviewed chunking ยังไม่อ้างว่า vector pipeline ทำงานครบ

## ผลทดสอบและคำสั่ง

- ล่าสุดบน develop 5022c28 + follow-up: API **237/237**, persisted session/RAG integration **10/10**, frontend **13/13**, API/Web typechecks/compile และ Web production build ผ่าน
- Complete recovery milestone ก่อนเพิ่ม embedding/live runner: Knowledge **50/50**, API **230/230**, frontend **13/13**, source-only export **9 deterministic Knowledge files** และ relocated runtime **4/4** ผ่าน [ผลเต็ม](evidence/mvp-recovery-local-checks.json)
- Latest published PR #74 CI run154 ผ่านบน Linux: [GitHub Actions](https://github.com/SteveJO789/LearnlyAi/actions/runs/37957856223) ไม่ใช้ run นี้เป็น CI proof ของ follow-up ใหม่
- คำสั่งทั่วไป: `node scripts/verify-mvp.mjs`; API compile `node node_modules/typescript/bin/tsc -p tsconfig.json`, tests `node --test test/*.test.mjs`
- Persistent integration: `node --experimental-test-module-mocks --test test/persisted-rag.integration.mjs` จาก services/api
- Frontend: `node scripts/run-tests.mjs` และ `node node_modules/next/dist/bin/next build` จาก apps/web
- Fresh packaging: `node scripts/verify-fresh-runtime.mjs` จาก services/api; ใช้ source export แต่คัดลอก locked local dependencies จึงไม่แทน fresh npm install proof

Live OpenRouter ใช้โมเดลที่ตั้งไว้ deepseek/deepseek-v4.1-flash รอบแรก 13/13 ผ่านโครงสร้าง แต่พบ HINT ยืมตัวเลข source example และ GUIDE ยืนยัน 40 V โดยไม่รู้ givens เก็บผลเดิมไว้แล้วแก้ adaptive instructions รอบหลังแก้ 13/13 ผ่าน schema, retrieval expectation, citation identity/linkage และ engine binding; agent inspection พบสองพฤติกรรมดังกล่าวแก้ได้ในรอบนี้

ค่าใช้จ่ายที่รายงานรวม 26 calls **US$0.0214265**, reservation สะสม **US$0.31889835** จากเพดาน US$1 มี lock/ledger, จองก่อน request, max 13 attempts/run และ no retry [หลักฐาน live](evidence/mvp-adaptive-live-verification.json) Paid eval แยกจาก CI; CI ใช้ injected Mock transport ตรวจ budget gate โดยไม่เสียเงิน ยังไม่ได้เรียก live embeddings

ข้อจำกัด: ไม่ใช่ educator review หรือ curriculum-wide quality proof; hint บางครั้งให้สอง hints กับหนึ่งคำถาม แม้ prompt ขอคำใบ้สั้นหนึ่งข้อ Raw evidence อยู่ใน ignored evaluation/results/rag/local และไม่เขียนทับ historical P3/P3.1 evidence

## Database และ security

[Assessment DB evidence](evidence/mvp-assessment-db-verification.json): 6 API→Prisma→PostgreSQL groups ผ่าน scoring/answers/idempotency, concurrent topic updates, paired comparisons, cross-user isolation/direct-write denial และ atomic rollback ใช้ locally signed synthetic identities; ไม่ใช่ Supabase OAuth จริง

Persistent fixture schema ที่ผู้ใช้อนุมัติถูกลบแล้วและ fixture_removed=true ตรวจยืนยัน Material และ [recovery RLS](evidence/mvp-recovery-rls-verification.json) ทดสอบจริงด้วย BEGIN/ROLLBACK ใน empty clones; ไม่แก้ public tables หรือข้อมูล learner จริง Recovery ผ่าน ownership, API-write guard, stale version, stage preservation และ event failure rollback

Canonical migrations ถูกเตรียมแล้วและ unscoped migration integrity checks ผ่าน หลังแก้ข้อผิดพลาดเดิม หลักฐานนี้ยังไม่ใช่ historical migration replay ทั้ง graph หรือการ apply ลง public production schema อย่า replay legacy destructive cleanup จาก stale db ref; ตรวจ migration history/marker ก่อน release

อ่าน public catalog ล่าสุด: Assessment ยังไม่มี topic/snapshot/submissionHash; Assessment/Answer/Profile/SourceMaterial ยังมี SELECT policies เท่านั้น จึงเป็น release blocker สำหรับฟีเจอร์ใหม่ ไม่ถือว่า fixture ที่ผ่านเท่ากับ production schema พร้อม

ปิด development AI routes บน deployment/default runtime, จำกัด Auth/readiness deadlines, log เฉพาะ safe request ID/phase และรักษา RLS ownership/API-write guards Readiness ตรวจ DB SELECT 1, runtime Knowledge และ Auth configuration เท่านั้น ไม่พิสูจน์ OAuth, schema migration หรือ model availability

## Deployment และ blockers

- ผู้ใช้กำหนด **CD เฉพาะ develop**; feature/integration deployments ต้อง skip ไม่มีการแก้ policy หรือ auto-merge โดย agent
- Latest develop 5022c28: Vercel Web status success แต่ API status failure [deployment ที่ล้มเหลว](https://vercel.com/webdev-bd06/learnly-ai/FHNjigF9xi5ye7V9Pp1WutiRaetQ) ยังไม่ทราบ cause ที่ยืนยัน
- Vercel connector ไม่มีสิทธิ์ scope webdev-bd06 (403), CLI ไม่ติดตั้ง และ browser tool initialization ล้มเหลว รอ redacted build error; ไม่เดาสาเหตุหรืออ้าง deployed success
- NVM4306 บล็อก npm เพราะ delegated script ไม่ trusted; official npm archive ผ่าน signature/hash แต่ installed runtime files บางส่วนต่าง เตรียม same-version repair + backup แล้ว รออนุมัติการเปลี่ยน software/trust state นอก repository ไม่ bypass security gate
- ไม่มี non-production DB branch ใช้ได้ User อนุญาต isolated fixture/cleanup ใน production project แต่ยังไม่อนุญาต destructive public migration/live user-data changes
- Corpus reviewed มี Ohm pilot; ไม่สร้าง educational content/license/review status เพื่อทำให้ดูว่า scope ครบ

## รายการก่อน release

- [ ] ทุก applicable issue criterion มี working feature และหลักฐาน
- [ ] PDF/image/OCR/private Storage และ pgvector ingestion/Top-K ครบ
- [ ] Login→Create→Input/Upload→Learn→Assess→History→Profile ผ่าน real browser/mobile/keyboard E2E
- [ ] Historical migration replay และ ownership controls ตรวจใน safe environment
- [ ] Public migration ผ่าน review/authorization และ production schema compatible
- [ ] Fresh CI/typechecks/production builds ของ follow-up ผ่าน
- [ ] API deploy failure แก้จาก verified build log และ deployed smoke ผ่าน
- [ ] เอกสาร/environment/operations ตรงกับ code จริง
- [ ] ไม่มี critical/high release blocker
- [ ] Authorized deployment และ real production smoke ผ่าน ก่อนใช้คำว่า RELEASED
