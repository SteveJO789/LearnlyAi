# การนำเข้าและตรวจ index ความรู้ด้วยเวกเตอร์

คำสั่งนี้ใช้สำหรับผู้ดูแล Knowledge ที่ผ่านการ review แล้ว ไม่ใช่ไฟล์ของนักเรียน ไม่เปิด HTTP endpoint สำหรับเผยแพร่ Knowledge และไม่เรียกโมเดลอัตโนมัติ

## เตรียมข้อมูล

รันจาก `services/api` หลัง `npm run build` ใช้ report จากตัวประเมิน embeddings เดิมที่รันด้วยงบและ ledger ที่อนุมัติแล้ว:

```powershell
npm run knowledge:vector:prepare -- --report="C:/path/to/embedding-report.json" --output="C:/path/to/new-index.json"
```

ตัวเตรียมอ่าน reviewed runtime Knowledge และเทียบ document/version, passage/content/input/provenance hashes, model และ embedding 1536 มิติกับ report ทุก chunk ก่อนสร้างไฟล์ใหม่ ไม่เขียนทับไฟล์เดิม ไม่ส่ง query history/cost/credentials จาก report ไปใน index และไม่เชื่อม DB รูปแบบ index เป็น schemaVersion 1; การตรวจ shape/hash ไม่ใช่การรับรองลายเซ็น provider หรือความแม่นยำทางการสอน

หากต้องสร้าง embeddings ใหม่ ให้ใช้ `evaluation/rag/run-embedding-live.mjs` ตาม live evaluation procedure เดิม โดยระบุ model, budget, max-calls, ledger เดิมและ output ใหม่ให้ครบ ไม่เริ่ม ledger ใหม่เพื่อข้ามงบ รอบนี้ใช้ report ที่มีอยู่แล้ว ไม่มี paid call เพิ่ม

## ตรวจอย่างเดียว

```powershell
npm run knowledge:vector:publish -- --index="C:/path/to/new-index.json"
```

ค่าเริ่มต้นคืน `VALIDATED` โดยไม่เชื่อม DB และไม่เขียนข้อมูล หาก reviewed source เปลี่ยน/review ถูกถอน/ข้อมูลไม่ครบ จะปฏิเสธ

## เผยแพร่เมื่อ target และ migrations พร้อม

ตั้ง `KNOWLEDGE_PUBLISH_DATABASE_URL` เฉพาะ shell ของผู้ดูแลที่ได้รับอนุญาต ไม่ใช้ connection ของ frontend และไม่ใส่ secret ใน command line/commit คำสั่งไม่มี fallback ไปใช้ `DATABASE_URL`

```powershell
npm run knowledge:vector:publish -- --index="C:/path/to/new-index.json" --apply --target="db-host.example:5432/postgres"
```

`--target` ต้องตรงกับ host:port/database ใน dedicated connection; query parameters อนุญาตเฉพาะ sslmode เพื่อกันการเปลี่ยน host/database ผ่านตัวเลือก connection อื่น คำสั่งไม่สร้าง schema, migrate, sign marker หรือแก้ RLS/grants

Publication ใช้ Prisma runtime/pgvector codec จริง ล็อกและตรวจ `prisma_contract.marker` ของ space `app` ให้ core/profile hashes ตรงกับ contract ปัจจุบันก่อน DELETE/INSERT แล้วแทนที่ document เดียวใน transaction จำกัดเวลา หากผิดพลาดจะ rollback และปิด connection ไม่มี retry

**ข้อควรเข้าใจจากเวอร์ชันที่ติดตั้ง:** Prisma rc.12 `verifyMarker: onFirstUse` เป็น warning-only และ query ยังเดินต่อ โค้ด publication จึงมี hard check ของ marker แยก ไม่อาศัย warning นี้เพื่อป้องกันการเขียน ยังไม่พิสูจน์ actual Prisma migration executor หรือ production schema compatibility

## Readiness

เมื่อเปิด `KNOWLEDGE_RETRIEVAL_MODE=vector`, `/health/ready` เพิ่ม `checks.vectorIndex` ตรวจ config/model/threshold และทุก reviewed chunk ปัจจุบัน ผ่าน connection แยกแบบ `BEGIN READ ONLY`/fixed authenticated role ข้อมูลต้องครบ ไม่ซ้ำ hashes/provenance ตรงและ stored vector ต้องเป็น 1536 มิติ/nonzero อ่าน review ซ้ำหลัง DB IO และปิด connection เมื่อเสร็จ/abort

ตรวจเฉพาะ index coverage/identity และ configured dependencies ไม่เรียก embeddings ไม่อ่านข้อมูลนักเรียน ไม่พิสูจน์ provider availability/คุณภาพ retrieval/JWT login/migrations ของฟีเจอร์อื่น Liveness ยังคงไม่ขึ้นกับ DB/AI

## หลักฐานและสิ่งที่ยังขาด

ดู [evidence](evidence/mvp-vector-operations-verification.json) และ [MVP tracker](mvp-completion-tracker.md) SQL readiness/publisher ก่อนเพิ่ม hard marker check ผ่าน actual rollback fixture แล้ว ส่วน strict marker SQL และ actual CLI apply ต้องตรวจซ้ำเมื่อเครื่องมือตรวจอนุมัติพร้อม ไม่มี production apply ในรอบนี้

อ้างอิง: [Supabase RAG permissions](https://supabase.com/docs/guides/ai/rag-with-permissions), [pgvector types/functions](https://github.com/pgvector/pgvector#vector-type) และ installed Prisma rc.12 runtime/reference files
