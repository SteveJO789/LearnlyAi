# ประวัติไฟล์ที่อัปโหลด

หน้า Account → History → Uploaded Files โหลดไฟล์ของผู้ใช้จาก API จริง แทนรายการว่างเดิม โดยคงโครงหน้าและรูปแบบของทีม

- แสดง PDF/ภาพที่บันทึกเป็น READY และมีข้อมูล Storage แล้ว ครั้งละ 25 รายการ พร้อมปุ่มโหลดเพิ่ม
- ดูชื่อไฟล์ บทเรียน วันที่อัปโหลด และข้อความที่อ่านจากไฟล์ได้
- ถ้าไฟล์เก่าไม่มี upload receipt จะระบุว่าไม่ทราบวันอัปโหลด ไม่ใช้วันที่แก้ session แทน
- ตัวกรองวันที่และวันที่ที่แสดงใช้วันในประเทศไทย (Asia/Bangkok); วันสิ้นสุดรวมทั้งวัน
- ยืนยัน/แก้ข้อความสำหรับเรียนได้ก่อนเริ่มเรียนเท่านั้น API ตรวจสถานะและเจ้าของซ้ำ โดยเก็บ correction แยกจากข้อความ/bytes/hash ต้นฉบับ
- ดาวน์โหลดต้นฉบับผ่าน API ที่ยืนยันตัวตนและตรวจ hash เดิม ไม่เปิด public Storage URL ฝั่ง browser จำกัด 3 MiB ระหว่างอ่าน stream ด้วย
- Dialog มี label/role, focus restoration, Tab/Escape, loading/error/retry และยกเลิก request เมื่อปิด พร้อม deadline 30 วินาที การยกเลิก request ไม่รับรองว่า metadata mutation ถูก rollback; โหลดรายการใหม่เพื่อดูผลจริง

ไฟล์และข้อความยังเป็นข้อมูลของผู้เรียน ไม่ได้กลายเป็น trusted Knowledge จากการยืนยันข้อความ

## API

`GET /api/v1/users/me/files?after=<material-id>&from=YYYY-MM-DD&to=YYYY-MM-DD`

ต้องมี verified Bearer token ไม่รับ owner/userId/bucket/key จาก caller รับวันที่ 1900-01-01 ถึง 9998-12-31 และ cursor resource ID เท่านั้น Query เป็น JWT-bound Prisma พร้อม owner scope และ RLS ออกผลตาม material ID สำหรับการแบ่งหน้า

```json
{
  "data": {
    "items": [{
      "id": "example-material", "sessionId": "example-session", "sessionTitle": "ตัวอย่างรูปแบบข้อมูล",
      "type": "PDF", "mimeType": "application/pdf", "sizeBytes": 120,
      "filename": "example.pdf", "uploadedAt": null, "normalizedText": "ตัวอย่างข้อความ",
      "reviewedByLearner": false, "canReview": true
    }],
    "nextCursor": null
  }
}
```

นี่เป็นตัวอย่าง contract ไม่ใช่ข้อมูลที่สร้างจริง ไม่คืน bucket/key/token/raw receipt Normalized text จำกัดขนาดใน projection; ข้อมูลเกิน contract ถูกปฏิเสธแทนการนำข้อความที่ถูกตัดไปใช้เรียน

รายการ PENDING/CANCELLED ที่ยังไม่เป็น READY แสดงในส่วนกู้คืนแยกจากไฟล์พร้อมเรียน มีตรวจรายการเดิม/ยืนยันยกเลิก/cleanup retry แล้ว ไม่ลบตามเวลาหรือส่ง bytes ซ้ำอัตโนมัติ ดู [upload recovery](upload-recovery.md) ผลล่าสุดและverification gatesอยู่ใน evidence ของ milestoneใหม่

## การตรวจ

ดู [หลักฐาน](evidence/mvp-file-history-verification.json) API/client/render tests ใช้ offline Auth/DB ports ตามระบุ ไม่แทน actual Auth→Prisma→Storage/browser proof SQL fixture จาก canonical migrations และ actual compiled query เตรียมไว้ใน `scripts/render-file-history-verification.mjs` แต่ยังไม่ได้ execute เนื่องจาก approval-review quota blocker
