# กู้คืนและยกเลิก upload ที่ค้าง

History → Uploaded Files แสดงรายการที่ยังไม่เสร็จจาก DB ของผู้ใช้เอง แยกจากไฟล์ READY สามารถตรวจและกู้คืนรายการเดิม หรือยืนยันยกเลิกได้ ไม่ส่ง bytes ซ้ำและไม่ลบไฟล์ตามเวลาอัตโนมัติ

## การทำงาน

- PENDING: กู้คืนได้ก่อนเริ่มเรียนเท่านั้น Backend ตรวจ stored bytes/MIME/hash เดิมก่อนบันทึก ไม่เรียก OCR หรืออัปโหลดซ้ำ
- CANCELLED: ปุ่ม cleanup ตรวจ DB อีกครั้งก่อนลบ หากมี matching READY material จะเก็บไฟล์ไว้และคืน READY แม้ receipt เก่าเขียนว่า cancelled
- ผล DB ไม่แน่นอน: เก็บ object ไว้ คืน error และให้ตรวจรายการปัจจุบันก่อนลองใหม่ ไม่ถือว่า response ขาดหายแปลว่า rollback
- ยกเลิกที่ยืนยันได้: commit CANCELLED ภายใต้ parent-session lock ก่อนลบ object แล้วบันทึก cleanupAt เมื่อ Storage สำเร็จ รายการที่ cleanup เสร็จไม่แสดงในคิวอีก
- ถ้า Storage หรือตัวบันทึก cleanup ล้มเหลว จะมี controlled error และ receipt อยู่สำหรับ retry โดยไม่แก้ immutable prepared material/bytes/hash
- SourceMaterial ที่บันทึกสำเร็จและบทเรียนเดิมจะไม่ถูกลบจากการยกเลิก upload ที่ค้าง

คำสั่งกู้คืน/ยกเลิกมี deadline และ abort เมื่อออกจากหน้า หาก response หายต้องโหลดข้อมูลจริงใหม่ การยกเลิก request ไม่รับรองว่า server mutation ถูก rollback

## API

`GET /api/v1/users/me/files/uploads?after=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD` คืน `{data:{items:[{id,sessionId,sessionTitle,state,filename,type,createdAt,canResume}],nextCursor}}` ครั้งละไม่เกิน25 ไม่คืน raw receipt/storage key/bucket/text แสดงเฉพาะ PENDING/CANCELLED ที่ยังไม่มี SourceMaterial และ cleanupAt ยังเป็นnull

`POST /api/v1/learning-sessions/:sessionId/materials/uploads/:id/resume` และ `/cancel` รับ JSON `{}` เท่านั้น ใช้ verified Bearer/owned receipt/context; caller ไม่ส่ง owner, storage key, hash หรือข้อมูล material คืน READY หากบันทึกแล้ว หรือ CANCELLED เมื่อ cleanup ยืนยันได้

## Schema และ retention

Canonical migration `20261011T0651_upload_cleanup_receipts` เพิ่ม nullable `FileUpload.cleanupAt` และ CHECK ว่า cleanupAtมีค่าได้เฉพาะ CANCELLED เป็น additive ไม่แก้ historical migration hashes และไม่ apply production ในรอบนี้

เก็บ immutable receipt เพื่อวิเคราะห์/retry ผลที่ไม่แน่นอน ไม่ลบ READY learning material หรือ conversation history ตาม timer บันทึกส่วนตัวของ receipt อยู่หลัง ownership RLS การกำหนดอายุและคำสั่ง purge receipts ที่ cleanup แล้วโดยผู้ดูแลยังเป็น release/operation decision ที่ต้องตรวจแยก ไม่ถือว่า cleanupAtลบข้อมูล receipt ออกจาก DB

## ขอบเขตหลักฐาน

ดู [evidence](evidence/mvp-upload-recovery-verification.json) และ tracker การทดสอบ API/Auth/Storage protocols มี offline ports ตามระบุ ไม่ใช่ live Supabase/browser/concurrency proof SQL fixture ของ migration/adapterเตรียมแล้ว แต่ยังไม่ execute เพราะ approval-review quota blockerเดิม
