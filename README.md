# Learnly AI

เว็บแอปพลิเคชันการเรียนรู้แบบปรับให้เหมาะกับผู้เรียนโดยใช้ AI สำหรับโปรเจกต์วิชา Software Engineering ระดับมหาวิทยาลัย

## ขอบเขตโครงการ

โปรเจกต์นี้ออกแบบเป็น **Modular Monolith** เพื่อให้เหมาะกับระบบที่มีผู้ใช้งานจำนวนไม่มาก แต่ยังคงหลัก Software Engineering ที่ดี ทั้งด้าน Reliability, Testability และ Maintainability

### ความสามารถหลักของระบบ

- ระบบสมัครสมาชิก เข้าสู่ระบบ และข้อมูลผู้ใช้
- ระบบ Learning Session
- รองรับข้อมูลเข้าแบบข้อความ PDF และรูปภาพ
- แบบทดสอบก่อนเรียนและหลังเรียน
- AI Tutor แบบโต้ตอบกับผู้เรียน
- RAG จากแหล่งความรู้ที่เชื่อถือได้
- คำตอบจาก AI แบบ Structured JSON พร้อม Schema Validation
- การติดตามความคืบหน้าและประวัติการเรียน
- Logging, Error Handling, Timeout/Retry และ Health Check

## เทคโนโลยีที่แนะนำ

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- Vector Search: pgvector
- AI Provider: OpenRouter ผ่าน Provider Adapter
- Deployment: Docker Compose

## กลุ่มงานหลัก

1. Frontend / Product
2. Backend / Learning Flow
3. AI / RAG
4. Data / Infrastructure / Reliability

แต่ละโมดูลควรมีผู้รับผิดชอบหลัก 1 คน และผู้ Review อย่างน้อย 1 คน

## กระบวนการพัฒนา

`feature/*` → Pull Request → Review → `develop` → Integration Test → `main`

อ่านรายละเอียดเพิ่มเติมได้ที่ `docs/development-workflow.md` และ `docs/architecture.md`
