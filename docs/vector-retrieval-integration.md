# การค้นหาด้วยเวกเตอร์ — canonical index และ runtime แบบเปิดใช้ชัดเจน

อัปเดต 2026-10-11: เพิ่ม canonical `KnowledgeChunk`, generated pgvector migration/codec, reviewed-only RLS/grants และ atomic Prisma publication แล้ว เส้นทางเรียนที่ยืนยันตัวตนใช้ตัวค้นหาเวกเตอร์จริงเมื่อกำหนด `KNOWLEDGE_RETRIEVAL_MODE=vector` ค่าเริ่มต้นยังเป็น lexical และไม่มี automatic fallback/publication/paid call ข้อความด้านล่างเป็นหลักฐานตาม milestone ก่อนหน้า ดู [ผลล่าสุด](evidence/mvp-vector-publication-verification.json)

การเปิดโหมดเวกเตอร์ต้องมี `OPENROUTER_API_KEY`, `KNOWLEDGE_EMBEDDING_MODEL=openai/text-embedding-3-small`, ค่า threshold `KNOWLEDGE_VECTOR_MIN_SIMILARITY` ที่กำหนดชัดเจน 0–1 และ optional `KNOWLEDGE_VECTOR_TOP_K` 1–8 (default 3) ต้องเตรียม migration/index ให้ตรงก่อนเปิด ไม่มี threshold default ที่อ้างว่าผ่าน curriculum-wide calibration

ตัวนำเข้า `publishReviewedKnowledge` อ่าน curated reader เท่านั้น → normalize/chunk → validate embedding dimensions/hash/provenance → อ่าน review ซ้ำ → serialized transaction แทนที่หนึ่ง document ผ่าน `PrismaVectorPublication` แหล่งอ้างอิงเก็บชื่อ/URL/license เดิม และ `page=null` สำหรับ Markdown ไม่ประดิษฐ์เลขหน้า ไม่มี HTTP publication endpoint นักเรียน/anon ไม่มี write grant/policy คำสั่ง CLI สำหรับ operator ยังต้องทำ

App migration ระบุ `extensions.vector(1536)` และปฏิเสธหากไม่มี type นี้ ไม่ย้าย extension ของ Supabase; generated extension baseline ของ package ใช้ `CREATE EXTENSION IF NOT EXISTS vector` ซึ่งต้องตรวจตำแหน่ง schema ก่อนใช้บนฐานข้อมูลใหม่ ไม่มีการ apply production ในรอบนี้

ล่าสุด API **308/308**, simulated persistent **14/14**, build/typecheck/migration integrity ผ่าน Actual rollback fixtures ตรวจ canonical migration 7 postconditions + captured publication/search SQL + RLS ทั้ง synthetic และ reuse actual embedding ที่เคยตรวจไว้; fresh 6 packages/103 SQL steps/190 checks ผ่าน ไม่มี paid call เพิ่ม Readiness ปัจจุบันตรวจ connectivity/local reviewed artifacts/auth config เท่านั้น ยังไม่ตรวจ vector index/provider และยังไม่มี deployed vector/browser proof

อัปเดต 2026-10-10: เพิ่ม `VectorKnowledgeRetriever` และ `PrismaVectorSearch` จริง ไม่ใช้ lexical result เป็นผลเวกเตอร์จำลอง โดยยังคง default lexical pilot จนกว่า canonical pgvector contract/migration, ingestion และ environment configuration จะพร้อม

กระบวนการค้นหา: ตรวจ input/history → อ่าน reviewed pilot ปัจจุบัน → สร้าง query embedding → ค้น Top-K ผ่าน JWT-bound Prisma/RLS → อ่าน reviewed source อีกครั้ง → เทียบ chunk ID, passage/content hash และ exact provenance hash → คืน passage เต็มพร้อม citations เดิม ไม่มีการนำข้อความ/source URLs จากแถว DB มาเป็น trusted teaching content

อัปเดต actual embedding/PG verification: `openai/text-embedding-3-small` ส่ง native model nameกลับมา จึงเพิ่มเฉพาะ equivalenceกับ `text-embedding-3-small` ไม่ทำ generic prefix stripping และไม่ยอมรับ wrong model/dimensions พบรอบแรก vector-only thresholdค้น Ohmให้ transformer/batteryผิดเรื่อง2/8cases เก็บผลที่ไม่ผ่านแล้วเพิ่ม intent abstentionสำหรับone-concept pilot

Index embedding inputใช้ชื่อบท/concept/subject/languageที่อ่านจากreviewed sourceบวกcomplete chunk text มี `embeddingInputHash` ต่างจากcontentHash Candidateต้องตรงhashของcurrent model inputด้วย Titleเปลี่ยนโดยcontentไม่เปลี่ยนทำให้old index rowไม่ถูกtrust Actual title-aware vector/PG cosine regression8/8ผ่านทั้งraw rankingและintent/review gates แต่เป็นชุดเล็กที่เคยดูแล้ว ไม่ใช่ independent curriculum-wide quality proof

TEMP database verificationใช้existing authenticated roleก่อนใช้extensionsและFORCE RLSเพื่อไม่ใช้owner exemption ยืนยันunreviewed rowถูกซ่อนและauthenticated publicationถูกdeny Poolปิด/fixture_removed=true ไม่เพิ่มpermanent grantsหรือแก้public schema [หลักฐานและfailure history](evidence/mvp-live-embedding-verification.json)

`PrismaVectorSearch` ใช้ cosine distance ของ pgvector, model/dimension/subject/language filters, จำนวนผล 1–8 และ threshold ที่ caller ต้องกำหนด ไม่มี default threshold ที่อ้างว่าผ่าน quality calibration แล้ว Parameters ถูก bind ผ่าน Prisma; operator/type ใช้ `extensions` แบบระบุ schema

ข้อความ learner ไม่เกิน 8000 characters และ history ไม่เกิน 4 turns ใช้ history เฉพาะคำถามต่อเนื่องสั้น ๆ/คำตอบตัวเลข คำถามหัวข้อใหม่ไม่พ่วงประวัติเก่าและ acknowledgement ไม่เรียก embeddings ไม่ส่ง tutor/system turns ให้ embedding provider

แถวค้นหาเป็นเพียง candidate: stale/unknown chunk, changed passage, changed source URL/license, revoked review, similarity ต่ำหรือไม่ finite ไม่ได้รับ trusted citations คืน passage เต็มเพื่อรักษาสูตรและ citation contract ของ Learning Engine ขณะนี้ reader รองรับ reviewed Ohm pilot เท่านั้น ไม่อ้างว่ามี corpus หลายวิชาแล้ว

## หลักฐาน

- API compile และ offline API 255/255 PASS; vector-specific tests 6/6 และ persistent simulated integration 11/11 PASS
- SQL จาก adapter ถูก execute บน PostgreSQL/pgvector จริงใน schema ชั่วคราวภายใน BEGIN/ROLLBACK: Top-K/tie ordering, threshold/model/language/subject filters, hostile model string, RLS eligibility และ reader ไม่มี INSERT/UPDATE privileges ผ่าน assertion ทั้งหมด
- Query renderer: `node services/api/scripts/render-vector-search-verification.mjs --output=<scratch.sql>` ต้อง compile API ก่อน ใช้ synthetic 3-dimensional vectors ไม่ใช่ live embeddings หรือหลักฐาน semantic relevance; `fixture_removed=true` หลัง ROLLBACK ไม่เปลี่ยน public tables/ข้อมูล learner
- ไม่ได้ทดสอบ actual Supabase Auth→Prisma execution สำหรับ vector adapter, canonical vector migration หรือ real embedding quality ในรอบนี้ ไม่มี paid call เพิ่ม

## งานที่ยังต้องทำ

1. เพิ่ม operator CLI สำหรับ prepared/reviewed embedding publication พร้อมตรวจ target และ manifest; core publication และ fixture verification มีแล้ว
2. ตรวจ actual Prisma marker/extension executor และ production-compatible migration path ก่อน apply ที่ได้รับอนุญาต
3. เพิ่ม vector configuration/index readiness และ independent relevance calibration สำหรับ corpus ที่ reviewed จริง
4. ทดสอบ live authenticated vector API/browser/deployed runtime โดยคง CD เฉพาะ develop และใช้ ledger งบเดิม US$1

คำสั่ง live evaluationต้องมี explicit --budget-usd=1/--max-calls/--model/--ledger/--output และใช้ledgerเดิม ไม่มีautomatic retry/fallback มีnative routing price ceilings Paid requestsใหม่6calls รวมทั้งหมด54calls reportedUS$0.02963331572/reservedUS$0.6515484 ไม่รีเซ็ตงบUS$1 การreuse actual query embeddingsไม่เสียเงินเพิ่ม Thresholdจาก12casesนี้ยังไม่wireเป็นproduction default

เอกสารอ้างอิงที่ตรวจ: [Supabase vector columns](https://supabase.com/docs/guides/ai/vector-columns) และ local Prisma 8 contract/query references ของ dependency ที่ติดตั้งอยู่
