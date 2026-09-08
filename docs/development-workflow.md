# กระบวนการพัฒนา

## รูปแบบ Branch

```text
main
  ↑
develop
  ↑
feature/*
```

ห้าม Push เข้า `main` โดยตรง

ตัวอย่างชื่อ Branch:

- `feature/12-login-ui`
- `feature/18-learning-session-api`
- `feature/27-rag-retrieval`

## ข้อกำหนดของ Pull Request

PR จะพร้อม Merge เมื่อ:

- Build ผ่าน
- Test ที่เกี่ยวข้องผ่าน
- ไม่มี Secret หรือ API Key ถูก Commit เข้า Repository
- Acceptance Criteria ครบถ้วน
- หากมีการเปลี่ยน API Contract ต้องอัปเดตเอกสาร
- มี Reviewer อย่างน้อย 1 คนอนุมัติ

## Definition of Done

Task จะถือว่าเสร็จเมื่อ:

- Implementation เสร็จสมบูรณ์
- มี Basic Test ตามความเหมาะสม
- จัดการ Error State แล้ว
- อัปเดตเอกสารเมื่อจำเป็น
- PR ผ่านการ Review
- Feature ทำงานได้บน `develop`

## การกำหนดเจ้าของงาน

แต่ละงานควรมี:

- Primary Owner
- Reviewer

สมาชิกสามารถเลือก Workstream ที่ตนเองสนใจได้ แต่ควรช่วย Review งานในส่วนอื่นเพื่อหลีกเลี่ยงการเกิด Knowledge Silo

## ลำดับสถานะที่แนะนำ

Backlog → Ready → In Progress → In Review → Testing → Done
