# ผลเปิดใช้งาน LearnlyAI Production — 18 ตุลาคม 2026

Production เปิด Assessment และ File Upload แล้วที่ https://learnlyai-web.vercel.app/ ทดสอบกับ Supabase Auth, API, Database และ Storage จริงด้วยบัญชีทดสอบแยกสองบัญชี จากนั้นล้างข้อมูลที่สร้างเองและปิดตัวรันชั่วคราวแล้ว

| รายการ | ผล |
| --- | --- |
| Initial findings | 74: Public policies 30, Auth 43, Storage 1 |
| ข้อบกพร่องจริงใน 74 รายการเดิม | 0 |
| ความต่างของ representation / service version | 74 |
| Findings เดิมที่แก้การตรวจได้ | 74/74 โดยไม่ซ่อนหรือข้าม findings |
| ปัญหาที่พบเพิ่มนอก 74 รายการ | Legacy policies 3 รายการ แก้แล้วในรอบ migration ก่อนหน้า |
| Full strict verification หลังล้างข้อมูลทดสอบ | 39/39 ผ่าน; issues, warnings, unclaimed objects และ marker drift เป็น 0 |
| Blocker ที่เหลือสำหรับ Assessment และ Upload | ไม่มี |
| สถานะ production migration | ทำเสร็จแล้ว: `c7` → `f099`, migration ledger 6 → 17 |

รายละเอียด expected/actual และหลักฐานจำแนกแต่ละ finding อยู่ใน [รายงาน Phase A](phase-a-database-verification.th.md) และ [รายการ findings](evidence/phase-a-findings.json) ส่วนฐาน production ใช้ profile `supabase-auth-20260831180000-storage-73-multitenant-pg17` ซึ่งอ้างอิง SQL ทางการที่ตรึงเวอร์ชันและ checksum พร้อมตรวจ catalog เพิ่มสำหรับส่วนที่ Prisma แทนค่าไม่ได้ ไม่ลด RLS, grants หรือข้อกำหนด authentication

การเปิดใช้งานรอบนี้แก้ readiness ให้ทำงานกับ application role ที่มีสิทธิ์จำกัด และแก้แพ็กเกจ Vercel สำหรับ PDF worker กับ OCR WASM โดยคัดลอก core ที่ตรึง checksum ออกนอก `node_modules` ตรวจไฟล์ก่อน build และระหว่าง readiness; runtime ไม่ดาวน์โหลดโมเดลหรือ core จากเครือข่าย การตรวจแบบ operator ยังคงตรวจ private bucket และ security contract ครบ

ผลทดสอบสำคัญ:

- API 381/381, Web 54/54, browser fixtures 23/23 และ lint ผ่าน
- Production HTTP ผ่าน 12 กลุ่มตรวจ: PRE → เรียน → POST → จบ session, บันทึกคะแนน 0, retry/conflict, ป้องกันบัญชีอื่นและ direct score writes, PDF/PNG/JPEG, private download, editable review และ upload receipts
- Browser จริงผ่าน 7 กลุ่มตรวจ: เข้าสู่ระบบ, History และรีโหลด, Home/Profile, Assessment detail, reviewed file/download และหน้า Create
- ตัวอย่างคะแนน PRE 3/3 และ POST 0/3 แสดงเป็น 100% → 0% พร้อมผลต่าง −100 จุดเปอร์เซ็นต์ และยังอยู่หลังรีโหลด
- ฐานแยกตรวจ application role ที่ไม่มีสิทธิ์อ่าน bucket: runtime ผ่าน แต่ operator ยังคงปฏิเสธเมื่อสิทธิ์ไม่ครบ; ตรวจพบ RLS ที่ถูกปิดและ grant ที่หาย หลัง rollback ตรวจครบผ่าน
- ลบบัญชีทดสอบ 2 บัญชี, sessions ที่สร้างเอง 5 รายการ และไฟล์ 3 รายการ เหลือข้อมูลทดสอบเป้าหมาย 0; จำนวนและ SHA-256 ของข้อมูลเดิมใน Auth users, User, LearningSession และ Message ตรงกับก่อนเริ่มงาน
- ตัวรันชั่วคราวทั้งสอง endpoint ตอบ HTTP 410; คืน browser trust store เดิมหลังทดสอบแล้ว

Assessment และ Upload ตั้งค่า production เป็น `true` ทั้งคู่ การค้นหา Knowledge ใช้ lexical ซึ่งเป็นโหมดที่รองรับอยู่ ส่วน vector retrieval ต้องผ่านการเตรียม index และประเมินคุณภาพแยกตาม [ขั้นตอน activation](feature-activation.md); development endpoint ใช้เฉพาะ local ตามการออกแบบ

สำหรับตรวจซ้ำ ให้ build ด้วย Node 24 และ dependencies ที่ล็อกไว้ ตั้ง `DATABASE_URL` ผ่านช่องทาง secret ด้วย operator role ที่อ่าน catalog ครบ และใช้ connection `search_path=public,extensions` ให้ตรงกับ Supabase production จากนั้นรันจาก `services/api`:

```sh
LEARNLY_SUPABASE_CATALOG_PROFILE=supabase-auth-20260831180000-storage-73-multitenant-pg17 \
npm run db:verify:full -- --target=remote --expect-database=postgres \
  --expect-host=aws-0-ap-south-1.pooler.supabase.com
```

ผลตรวจนี้ยืนยันฐาน production ปัจจุบันหลัง migration ที่ทำเสร็จแล้ว ไม่ต้อง apply migration ชุดเดิมซ้ำ การเปลี่ยนฐานข้อมูลครั้งถัดไปต้องตรวจ target และซ้อมใหม่ตาม runbook

ดู [หลักฐานผลรวม](evidence/production-feature-release-2026-10-18.json) สำหรับ commit, contract hashes และผลทดสอบ ไม่มี credentials, backup, ข้อมูลผู้ใช้รายคน หรือ source ตัวรันชั่วคราวในรายงานนี้
