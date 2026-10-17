# Phase A: ตรวจฐานข้อมูล LearnlyAI — PR #106

วันที่ 17 ตุลาคม 2026 ตรวจเฉพาะ 74 findings เดิม บนฐานข้อมูลแยกใน workspace ผลสุดท้ายผ่าน full strict verification และด่านตรวจสิทธิ์ร่วมกัน **เหลือ 0 findings บนฐานสำเนาที่แก้ไขแล้ว** ยังไม่อนุมัติย้าย production และยังไม่ merge PR

| รายการ | จำนวน |
| --- | ---: |
| Findings เริ่มต้น | **74** |
| ข้อบกพร่อง schema/security จริงที่ยืนยันได้ | **0** |
| ความต่างจากตัวตรวจ/เวอร์ชันบริการ | **74** |
| Findings ที่แก้ได้บนฐานสำเนา | **74** |
| Findings คงเหลือบนฐานสำเนา | **0** |

ไม่พบข้อบกพร่องของ policy แอปจาก 30 findings นี้ และไม่ได้สรุปผล schema ของ production จากฐานทดสอบ

## สาเหตุและสิ่งที่แก้

| กลุ่ม | Expected เทียบ Actual ก่อนแก้ | หลักฐานและการแก้ |
| --- | --- | --- |
| Public policy 30 | policy ทั้ง 30 เป็นของ `app` และตรงกับ SQL/roles/command ที่กำหนด แต่ Prisma รายงานเป็น policy ส่วนเกินใน `pgvector` | ตัว differ ตัดตารางแม่ออกก่อน aggregate แต่ยังส่ง policy ลูกมา จึงระบุเจ้าของผิด แก้ตัวตรวจเฉพาะ policy ที่มีเจ้าของตารางเพียง space อื่นเดียว ชื่อ/SQL/สิทธิ์ของ policy ในฐานข้อมูลไม่ได้เปลี่ยน |
| Supabase Auth 42 | contract ต้องมี `webauthn_challenges` และ `webauthn_credentials` พร้อมคอลัมน์/default/PK/FK/index/check แต่ GoTrue `v2.187.0` ยังไม่มี | อัปเกรดเฉพาะบริการของฐานสำเนาเป็น `v2.188.1` ให้บริการใช้ migration ทางการ `20260302000000_add_passkeys.up.sql` ไม่สร้างตาราง Auth เลียนแบบเอง |
| Supabase Storage 1 | contract ต้องมี `storage.s3_multipart_uploads.metadata jsonb`; Storage `v1.41.8` ไม่มี แม้จะมี `user_metadata` อยู่แล้ว | ใช้ Storage `v1.45.0` บนฐานสำเนา ให้บริการใช้ migration ทางการ `0057-s3-multipart-uploads-metadata.sql` |
| Supabase Auth 1 | snapshot กำหนด `varchar(255)` แต่ตัว migration ของ GoTrue ใช้ Pop v6.1.1 ซึ่งสร้าง `version varchar(14)` ก่อน SQL `CREATE TABLE IF NOT EXISTS ... varchar(255)` | ค่า 14 ถูกต้องตาม runtime ทางการ ใช้ contract profile `gotrue-pop6-v6.1.1` ที่ประกาศ expected 14 อย่างชัดเจนและคำนวณ hash ใหม่ ต่างจาก snapshot เดิมเพียงคอลัมน์นี้ ไม่กรอง finding ทิ้ง |

[บัญชีครบ 74 รายการ](evidence/phase-a-findings.json) มี expected, actual ก่อน/หลัง, เหตุผลจัดประเภท และหลักฐานต้นทาง รวม hash ของ package, SQL และ image ที่ทดสอบ การนับ 42 ของ Auth รวมตารางและองค์ประกอบลูกที่ Prisma แจ้งแยก ไม่ใช่ 42 บั๊กอิสระ

รายงานนี้แก้คำอธิบายเดิม: public 30 รายการเกิดจากการระบุเจ้าของข้าม space ไม่ใช่ความต่างด้านรูปแบบ SQL และ Auth/Storage เป็นสิ่งที่ contract คาดหวังแต่บริการทดสอบเก่ายังไม่มี

## ตัวตรวจยังตรวจพบความผิดปกติจริง

การขยายคอลัมน์เป็น 255 ระหว่างการทดลองไม่จำเป็นและได้คืนเป็น 14 แล้วก่อนทดสอบรอบสุดท้าย ทั้งสองฐานสำเนาเก็บ migration ครบ 69 แถว ฐานเดิมไม่ถูกเปลี่ยนค่า ไม่มีการแก้ schema จริงที่จำเป็นจาก findings ชุดนี้

ตัวติดตั้ง adapter ยอมรับเฉพาะ `@prisma/orm-toolchain@8.0.0-rc.12` และ hash ต้นฉบับ/หลังแก้ที่ตรวจแล้ว ถ้าเวอร์ชันหรือไฟล์เปลี่ยนจะหยุด ไม่ใช้รายชื่อ 30 policy เป็นข้อยกเว้น ไม่แก้ app contract, snapshot ต้นฉบับ หรือประวัติ migration และไม่เปลี่ยนวิธีเทียบ SQL ให้ผ่อนปรน

ยังพบข้อจำกัดอีกอย่างของ Prisma รุ่นนี้: policy ที่เปลี่ยนเงื่อนไขหรือ role แต่คงชื่อเดิมอาจผ่าน CLI ดังนั้นคำสั่งใหม่ต้องผ่าน **ทั้ง** `prisma db verify --strict --json` แบบ full และการตรวจ RLS/policy ทั้ง 30 แบบตรงตาม contract กับ PostgreSQL 17 signatures รวม Storage/grants ที่จำเป็น ตัวตรวจไม่เรียนรู้ expected จากฐานที่กำลังตรวจ และยังแจ้ง policy ส่วนเกินบนตารางที่เป็นเจ้าของหรือไม่รู้จัก

หลัง build รันจาก `services/api` โดยโหลด URL ผ่าน environment ที่เก็บอย่างปลอดภัย:

```sh
LEARNLY_SUPABASE_CATALOG_PROFILE=gotrue-pop6-v6.1.1 npm run db:verify:full -- --target=local --expect-database=learnly_activation_executor_phase_a_services_20261017
```

Prisma โหลด extension contract จาก refs บนดิสก์ เครื่องมือจึงสร้างสำเนา migrations ชั่วคราวที่เก็บไฟล์ประวัติเดิมครบ แล้วเพิ่ม snapshot/hash ของ profile เฉพาะในสำเนา ไม่แก้ไฟล์ประวัติใน repository และลบสำเนาหลังตรวจ

ในการซ้อม [canonical profile adoption](evidence/phase-a-profile-adoption.json) ตรวจ schema ของ profile และทบทวน plan ก่อนใช้ `prisma db migrate` บนฐานแยกสองฐานเพื่อบันทึก Supabase external descriptor ใหม่เท่านั้น ผลมี **0 schema operations**, hash ของ schema/สิทธิ์ก่อน–หลังเท่ากัน, app/pgvector marker คงเดิม และเพิ่ม ledger ถูกต้อง 1 แถวต่อฐาน ไม่มีการเขียน marker เอง ตัวตรวจปกติไม่ทำขั้นตอนนี้และจะ BLOCK หาก marker ยังไม่ตรง profile; `prisma.verify.config.ts` อนุญาตเฉพาะ `db verify`

profile เป็นค่าของเครื่องมือตรวจ ไม่ใช่ feature flag: เลือกจากโครงสร้าง runtime ทางการ ไม่อ่านฐานเป้าหมายมาเรียนรู้ expected ตัวเลือก `upstream` คง snapshot เดิม; [ผลก่อน adoption](evidence/phase-a-upstream-profile-verification.json) ยังรายงาน width mismatch 1 รายการตามจริง ส่วนชื่อ profile ที่ไม่รู้จักจะถูกปฏิเสธ

ผลสำเร็จต้องเป็น `mode=full`, `schemaVerification=performed`, `strict=true`, CLI exit 0 และทุกด่าน PASS ห้ามใช้ marker-only แทน ขั้นตอน executor เดิมเอาข้อยกเว้น 30 policy ออกแล้ว และจะหยุดถ้า foundation ของ Auth/Storage ไม่เข้ากัน

## ผลทดสอบ

- [Full strict verification](evidence/phase-a-final-verification.json): CLI 0 findings, ไม่มี warnings/unclaimed และด่าน catalog/security 34/34 ผ่าน บน PostgreSQL 17.11/pgvector 0.8.7 พร้อม GoTrue `v2.188.1`/Storage `v1.45.0` ที่ล็อก image digest
- [ทดสอบจงใจทำ schema/สิทธิ์ผิด](evidence/phase-a-security-verification.json): ตรวจพบและคืนค่าครบ **15/15** กรณี รวม Auth table/column/FK/check, multipart metadata, policy ที่คงชื่อแต่เปลี่ยนเงื่อนไข/role, policy ส่วนเกิน, ปิด RLS และถอน schema USAGE เมื่อคืนค่าครบ full strict กลับมาผ่าน และทุกตารางทดสอบยังมีข้อมูล 0 แถว
- [เส้นทางบริการจริงในฐานแยก](evidence/phase-a-service-journey.json): **14/14** ผ่าน รวม Auth A/B, PRE/POST และคะแนน 0, ป้องกันแก้คะแนนโดยตรง (`42501`), rollback บันทึกซ้ำ (`23505`), private Storage/PDF และล้างผู้ใช้/ไฟล์/ข้อมูลครบ การแข่งกันระหว่างยกเลิกกับอัปโหลดใช้ adapter จำลองตามที่ระบุในหลักฐาน
- API build และ tests **365/365** ผ่าน; persisted integration **16/16** ผ่าน รวม tests ของ profile, overlay และการปฏิเสธเป้าหมายที่ไม่ใช่ฐานแยก
- `npm ci` ในโฟลเดอร์สะอาดติดตั้ง adapter ทั้งสองได้ การติดตั้งซ้ำไม่เปลี่ยนไฟล์ และ tests ของ adapter **13/13** ผ่าน รวมกรณีแก้ไฟล์/ผิดเวอร์ชัน/patch เก่า
- [Sol review ของ ownership/RLS](evidence/phase-a-independent-review.json) ผ่านหลัง Luna เขียนโค้ด; การเพิ่ม profile/overlay ตรวจซ้ำและทดสอบรอบสุดท้ายโดยผู้ดำเนินงานหลัก ส่วนผล executor c7/fresh/wrong-origin/rollback ก่อน Phase A ยังคงเป็นหลักฐานแยก ไม่ได้อ้างว่าได้รันชุด executor ทั้งหมดใหม่ในรอบนี้

เก็บ [ผลเริ่มต้น 74 findings](evidence/phase-a-initial-verification.json) และ [ผลหลังแก้เฉพาะ ownership ซึ่งยังแจ้ง 44 รายการ](evidence/phase-a-projection-only-verification.json) ไว้ตรวจย้อนกลับ ฐานเดิมไม่ถูกแก้; เมื่อติดตั้งตัวตรวจใหม่ ฐานเดิมยังแจ้ง Auth/Storage 44 รายการตามจริง ผล 0 เป็นของฐานสำเนาที่อัปเกรดและเลือก contract profile ของ runtime ที่ตรวจแล้วเท่านั้น

## ย้าย production ได้หรือยัง

**ยังเป็น NO-GO สำหรับ production** แม้ blocker 74 รายการจะเคลียร์บนฐานสำเนาแล้ว รอบนี้ใช้ฐานแยกทั้งหมด จึงยังไม่ได้ยืนยัน catalog/เวอร์ชัน Auth และ Storage ของเป้าหมาย production ว่าเข้ากัน และยังต้องซ้อมเส้นทาง migration กับสำเนาของเป้าหมายนั้นพร้อมแผนกู้คืน

เวอร์ชันบริการที่ระบุเป็นชุดที่ทดสอบความเข้ากันได้ ไม่ใช่คำแนะนำให้นำเวอร์ชันนั้นขึ้น production หรือให้แอปแก้ managed Auth/Storage schema เอง การอัปเกรดบริการ hosted ต้องดำเนินการผ่านวิธีที่ Supabase รองรับและตรวจเป้าหมายอีกครั้ง

ไม่มีการแก้ production database, apply hosted migration, เปลี่ยน deployment feature flags หรือ merge PR #106
