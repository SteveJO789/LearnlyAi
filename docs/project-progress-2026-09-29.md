# LearnlyAI Project Milestone Update — 29 Sep 2026 (historical snapshot)

> Historical record only. Current status: [2026-10-09 implementation update](project-status-2026-10-09.md). Login was approved afterward, persistent sessions/history merged, and Docker cancelled.

## Current milestone
**AI Learning Session Vertical Slice: PASS**

เส้นทางต่อไปนี้ทำงานจริงแบบ local end-to-end แล้ว:

```text
Frontend (Next.js)
  -> Express API
  -> Learning Engine
  -> AI Orchestrator
  -> OpenRouter
  -> Tutor Output JSON validation
  -> Frontend Renderer
```

## Completed / verified
- Structured Tutor Output contract และ validator (#4)
- Model Provider Adapter: Mock + OpenRouter (#10, PR #27)
- Learning Engine core และ multi-turn context (PR #33)
- Frontend สามารถส่ง input และ render explanation/question/quiz blocks (#9 - partial)
- Local real-provider integration test ผ่าน
- API offline test suite 97 tests ผ่าน
- Demo deployment readiness cleanup merged (PR #38)
- Vercel build/deploy checks ของ commit ล่าสุดผ่าน

## Still in progress
- Tutor quality / adaptive teaching behavior (#39)
- RAG retrieval และ source grounding (#11, #12)
- Google OIDC + application session (#5, #6)
- PostgreSQL persistence / authenticated ownership (#7, #8 และ data integration)
- Dashboard / History / Learning Profile (#13, #16)
- Full E2E ตั้งแต่ Auth -> Learning -> Persistence -> History (#14)
- Frontend loading/error/retry และ stage UX (#9)

## Important distinction
Integration path ผ่านแล้ว แต่คุณภาพคำตอบของ Tutor ยังอยู่ในช่วงปรับปรุง ดังนั้นสถานะปัจจุบันคือ:

- **Integration feasibility:** PASS
- **Tutor/pedagogical quality:** IN PROGRESS
- **Full MVP E2E:** NOT YET COMPLETE

## Immediate next priorities
1. ปรับ prompt และ adaptive tutor behavior (#39)
2. เชื่อม Auth + Database persistence ให้ Learning Session เป็นของ user จริง
3. ต่อ RAG/source grounding
4. ทำ full E2E smoke test และเก็บ evidence สำหรับรายงาน/เดโม
