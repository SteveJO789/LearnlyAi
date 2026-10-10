# ฐานของระบบรับไฟล์ — ยังไม่ใช่ upload feature ที่เสร็จครบ

ตอนนี้มี preliminary envelope checks, user-JWT Storage transport, ingestion coordinator และ Prisma persistence adapter ใน API module แล้ว แต่ **ยังไม่เชื่อม endpoint/UI, real decoder/PDF extraction/OCR หรือ private bucket/RLS จริง** จึงยังไม่ถือว่า #15 สำเร็จ

`inspectFileEnvelope` จำกัด 3 MiB, รองรับเฉพาะ PDF/PNG/JPEG, ตรวจ signature กับ MIME ที่ประกาศ, คำนวณ hash จาก bytes, ปฏิเสธ filename ที่เป็น path/control characters และป้องกัน PNG dimension เกิน 12 ล้าน pixels ชื่อ/นามสกุลไฟล์ไม่ใช่หลักฐานประเภทเนื้อหา

การผ่าน envelope checks **ไม่พิสูจน์ว่าไฟล์สมบูรณ์** ตัวอย่างทดสอบ PDF เป็นเพียง header fixture ไม่ใช่เอกสารจริง ต้อง decode/extract ด้วย library จริง, ตรวจ JPEG/image pixels, จำกัดหน้า/text/time/memory และ reject malformed/encrypted/unsupported input ก่อนใช้ READY หรือส่งต่อ engine ไม่มี simulated OCR หรือข้อความตัวอย่างแทน extraction

`PrivateMaterialStorage` ใช้ Supabase publishable key + verified user Bearer token ผ่าน HTTPS origin ที่ตั้งค่าไว้ ไม่ใช้ service-role bypass, public URLs หรือ upsert Object key ใช้ **Auth UID**/session/material identifiers ไม่ใช้ชื่อไฟล์หรือ application User primary key ตัว transport ตรวจ prefix, byte size/MIME/extension/hash และส่งสำเนา bytes ที่ตรวจแล้ว มี timeout/no redirect และไม่แสดง upstream body/credentials

ก่อนเชื่อม runtime ต้องมี private bucket กับ MIME/size limits และ Storage RLS ที่ผูก bucket + Auth UID prefix + session ownership ผ่าน User.authUserId ให้ SELECT/INSERT/DELETE ตามจริง ไม่ให้ UPDATE/upsert ต้องทดสอบ cross-user read/write/delete จริง ขณะนี้ยังไม่ได้สร้าง bucket/policies หรืออัปโหลดข้อมูลใน production

เตรียมcanonicalmigrationสำหรับprivatebucket/policiesและnullableSourceMaterial.storageBucketแล้ว ทดสอบactualrollbackclonesผ่าน20canonicalchecks/ownership/anon/cross-user/immutability/cleanup/other-bucketcases พร้อมfreshbaseline+delta78steps/146checks ไม่มีactualbucket/policiesสร้างหรือStorageHTTPupload [รายละเอียด](private-material-storage.md) ข้อมูลfileใหม่persistbucketคู่keyเพื่อไม่เสียlinkเมื่อconfigurationเปลี่ยน; TEXT/legacyยังnullable

`FileIngestion` ตรวจ owned active session ก่อน extraction, ใช้ byte snapshot/hash, รับผลจาก extractor port ที่ต้อง decode จริงและ honor deadline, normalize NFC/LF ไม่ตัดข้อความที่เกิน 8000 characters, จำกัด 10 หน้า PDF มี page numbers จริงตามลำดับ และ IMAGE ใช้ page=null การผ่าน header fixture ไม่มีสิทธิ์ทำ READY หาก real extractor ยังไม่ทำงาน ไม่มี default/Mock extractor ใน service

`PrismaFileMaterials` ผูก application User primary key ที่ resolve จาก verified Auth UID, ใช้ transaction-local API-write context และล็อก owned active session ก่อน insert SourceMaterial READY/metadata/text/private storage key และ PRE_TEST gate ใน transaction เดียว ทุกไฟล์เป็น LEARNER_INPUT/reviewed=false; binary content hash แยกจาก normalized-text hash

ก่อนส่งไฟล์ `reserve` บันทึก `FileUpload` PENDING พร้อม prepared metadata/hash/extraction ที่ตรวจแล้ว ถ้าไม่รู้ผล reservation จะไม่ส่ง bytes ไป Storage ถ้า upload ส่ง error/timeout จะเก็บ intent ไว้ ไม่ส่งไฟล์ซ้ำหรือลบโดยเดา `resume` ของเจ้าของโหลด intent แล้วตรวจ path/bucket/text/hash จากนั้นอ่าน original bytes ผ่าน authenticated Storage GET แบบ streamed/10s/3MiB และตรวจ MIME/ขนาด/SHA256 ก่อนบันทึก READY ไม่มีการ decode ซ้ำหรือ fabricate source content

เมื่อ save ส่ง error จะตรวจ exact receipt หลัง owned parent lock ใน READ COMMITTED พบ READY ตรงกันคืนสำเร็จ ถ้าไม่มี READY ต้อง commit journal CANCELLED ภายใต้ parent lock เดียวกันก่อนลบไฟล์ เพื่อกัน resume/save แข่งกับ delete `save` รับเฉพาะ exact PENDING intent; cancelled intent ไม่ฟื้นเป็น READY หาก cancel ไม่รู้ผลจะเก็บไฟล์ไว้ หาก cleanup ล้มเหลวใช้ FILE_CLEANUP_REQUIRED และ resume CANCELLED retry remove ได้ ไม่มี daemon/automatic upload retry ทุก unknown outcome เก็บ journal และแจ้งเฉพาะ random material ID

เตรียม migration `20261010T1119_durable_file_uploads` จาก8626880→26370da เพิ่ม FileUpload/FK/state check/indexes/RLS/grants; ไม่ apply production Actual empty-clone SQL ผ่าน intent/cancellation/failed-finalize retention/direct-write guards/cross-user/FK/state checks และ fresh baseline3packages **89steps/167checks** rollbackหมด ไม่มี actual concurrent Auth→Prisma/Storage proof [หลักฐาน](evidence/mvp-durable-file-upload-verification.json)

ล่าสุด: file/Storage checks **26/26**, API **288/288**, simulated persistent **11/11**, compile/migration integrity PASS Tests ใช้ injected decoder/Storage/DB + streamed HTTP fixtures ยังต้องเชื่อม authenticated upload/list/resume/download endpoint/UI, real Storage/Auth tests และกำหนดการจัดการ intent ที่ยังไม่มีไฟล์ ก่อนถือว่า file feature ครบ

ตรวจฐานข้อมูลจริงเพิ่มเติม: พบ enum cast ที่ compile/unit tests ไม่จับ เพราะ Prisma enum ใช้ pg/text และไม่มี public.SourceMaterialType จริง แก้เป็น bound text parameter ตาม canonical contract โดยไม่แก้ฐานข้อมูล Actual adapter SQL + canonical RLS ใน empty clones ภายใน BEGIN/ROLLBACK ผ่าน legacy ownership, direct API-context guard, PDF/IMAGE metadata, PRE gate, failed-update atomic rollback, cross-user isolation และ FK; fixture_removed=true [หลักฐาน](evidence/mvp-file-persistence-rls-verification.json). ใช้ synthetic claims และ injected decoder/Storage จึงไม่ใช่ real Auth→Prisma/file decoding/Storage proof

งานถัดไป: real extraction/OCR หลังซ่อม npm ได้, reviewed private Storage setup, real Auth→Prisma→Storage journey และ authenticated upload/list/resume/download UI ไม่มีการเริ่ม daemon หรือบริการเพิ่ม

หลักฐานล่าสุด: targeted checks/transport tests 5/5 และ API compile ผ่าน ใช้ injected HTTP response ใน CI จึงไม่แทน live Storage/RLS proof ดู [upload behavior](https://supabase.com/docs/guides/storage/uploads/standard-uploads) และ [access control](https://supabase.com/docs/guides/storage/security/access-control) ที่ตรวจล่าสุด 2026-10-10
