# Infrastructure

พื้นที่สำหรับ Docker Compose และ configuration ของ local/demo environment

Service baseline:

- `web`: Next.js
- `api`: Node.js + Express.js + TypeScript
- `db`: PostgreSQL พร้อม pgvector

ห้าม commit secret ลงไฟล์ Compose ใช้ environment variables และ `.env.example` เป็นรายการค่าที่ต้องตั้งเท่านั้น
