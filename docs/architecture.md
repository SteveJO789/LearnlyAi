# สถาปัตยกรรมระบบ

## ภาพรวมสถาปัตยกรรม

```text
ผู้เรียน
  |
  v
Next.js Frontend
  |
  v
FastAPI Backend
  |
  +--> Authentication / User
  |
  +--> Learning Session Engine
  |      |
  |      +--> Assessment
  |      +--> Learning Workflow
  |
  +--> Input Processing
  |      +--> Text
  |      +--> PDF
  |      +--> Image/OCR
  |
  +--> AI Orchestrator
  |      +--> Prompt Builder
  |      +--> RAG Retriever
  |      +--> Model Provider Adapter
  |      +--> Structured Output Validator
  |
  +--> PostgreSQL + pgvector
  |
  +--> File Storage
```

## ลำดับการเรียนรู้

```text
INPUT
  ↓
CONTENT_ANALYSIS
  ↓
PRE_TEST
  ↓
LEARNING
  ↓
TRANSFER
  ↓
POST_TEST
  ↓
COMPLETED
```

Backend เป็นผู้ควบคุมสถานะของ Learning Workflow แบบ deterministic ส่วน LLM มีหน้าที่ปรับหรือสร้างเนื้อหาการเรียนภายใต้ขอบเขตที่ระบบกำหนด

## โมดูล Backend

- Authentication
- User Management
- Learning Sessions
- Learning State Machine
- Input Processing
- Assessment
- AI Orchestrator
- RAG
- Structured Output Validation
- Learning Profile
- History

## Entity ขั้นต่ำของระบบข้อมูล

- users
- learning_sessions
- messages
- assessments
- assessment_answers
- learning_profiles
- documents
- document_chunks
- ai_requests

## ข้อกำหนดด้าน Reliability

- ตรวจสอบความถูกต้องของ Request
- ตรวจสอบประเภทและขนาดไฟล์
- กำหนด Timeout สำหรับ AI
- กำหนด Retry Policy แบบจำกัดจำนวนครั้ง
- มี Fallback หรือ Error Response ที่ควบคุมได้
- ตรวจสอบ Structured JSON ด้วย Schema
- จัดการ Exception จากส่วนกลาง
- มี Health Check
- มี Application Log และ AI Request Log
