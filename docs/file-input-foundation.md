# ฐานของระบบรับไฟล์ — ยังไม่ใช่ upload feature ที่เสร็จครบ

ตอนนี้มี preliminary envelope checks และ user-JWT Storage transport ใน API module แล้ว แต่ **ยังไม่เชื่อม endpoint/UI, decoder/PDF extraction/OCR, metadata persistence หรือ private bucket/RLS จริง** จึงยังไม่ถือว่า #15 สำเร็จ

`inspectFileEnvelope` จำกัด 3 MiB, รองรับเฉพาะ PDF/PNG/JPEG, ตรวจ signature กับ MIME ที่ประกาศ, คำนวณ hash จาก bytes, ปฏิเสธ filename ที่เป็น path/control characters และป้องกัน PNG dimension เกิน 12 ล้าน pixels ชื่อ/นามสกุลไฟล์ไม่ใช่หลักฐานประเภทเนื้อหา

การผ่าน envelope checks **ไม่พิสูจน์ว่าไฟล์สมบูรณ์** ตัวอย่างทดสอบ PDF เป็นเพียง header fixture ไม่ใช่เอกสารจริง ต้อง decode/extract ด้วย library จริง, ตรวจ JPEG/image pixels, จำกัดหน้า/text/time/memory และ reject malformed/encrypted/unsupported input ก่อนใช้ READY หรือส่งต่อ engine ไม่มี simulated OCR หรือข้อความตัวอย่างแทน extraction

`PrivateMaterialStorage` ใช้ Supabase publishable key + verified user Bearer token ผ่าน HTTPS origin ที่ตั้งค่าไว้ ไม่ใช้ service-role bypass, public URLs หรือ upsert Object key ใช้ **Auth UID**/session/material identifiers ไม่ใช้ชื่อไฟล์หรือ application User primary key ตัว transport ตรวจ prefix, byte size/MIME/extension/hash และส่งสำเนา bytes ที่ตรวจแล้ว มี timeout/no redirect และไม่แสดง upstream body/credentials

ก่อนเชื่อม runtime ต้องมี private bucket กับ MIME/size limits และ Storage RLS ที่ผูก bucket + Auth UID prefix + session ownership ผ่าน User.authUserId ให้ SELECT/INSERT/DELETE ตามจริง ไม่ให้ UPDATE/upsert ต้องทดสอบ cross-user read/write/delete จริง ขณะนี้ยังไม่ได้สร้าง bucket/policies หรืออัปโหลดข้อมูลใน production

งานถัดไป: real extraction/OCR หลังซ่อม npm ได้, private Storage setup ที่ผ่าน review, actual SourceMaterial persistence พร้อม compensation cleanup เมื่อ upload/DB fail, authenticated upload/download APIs และ frontend input/history ไม่มีการเริ่ม daemon หรือบริการเพิ่ม

หลักฐานล่าสุด: targeted checks/transport tests 5/5 และ API compile ผ่าน ใช้ injected HTTP response ใน CI จึงไม่แทน live Storage/RLS proof ดู [upload behavior](https://supabase.com/docs/guides/storage/uploads/standard-uploads) และ [access control](https://supabase.com/docs/guides/storage/security/access-control) ที่ตรวจล่าสุด 2026-10-10
