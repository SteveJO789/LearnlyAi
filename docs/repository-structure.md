# Repository Structure

โครงสร้างเป้าหมายเป็น monorepo สำหรับ Next.js frontend, FastAPI modular monolith และ infrastructure

```text
LearnlyAi/
├── apps/
│   └── web/                       # Next.js frontend
├── services/
│   └── api/                       # FastAPI modular monolith
│       ├── app/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── learning_sessions/
│       │   │   ├── input_processing/
│       │   │   ├── assessments/
│       │   │   ├── learning_profiles/
│       │   │   ├── ai_orchestrator/
│       │   │   └── rag/
│       │   └── shared/
│       ├── migrations/
│       └── tests/
├── contracts/                     # JSON Schema และตัวอย่างที่ใช้ร่วมกัน
├── docs/                          # Architecture/API/Data decisions
├── infra/                         # Docker Compose และ deployment config
├── tests/e2e/                     # Cross-service smoke tests
├── .env.example
└── README.md
```

## Frontend Boundaries

- `app/` จัด routing และ composition
- `features/auth`, `features/learning-session`, `features/profile` เก็บ feature-specific UI/logic
- `components/ui` เก็บ reusable presentational components
- `lib/api` เป็นจุดเดียวที่เรียก backend และ map error envelope
- `lib/contracts` ใช้ generated/manual types ที่สอดคล้องกับ shared schema
- ห้าม import server secret หรือเรียก model provider จาก browser

## Backend Module Template

แต่ละ business module ควรมีโครงสร้างใกล้เคียง:

```text
module/
├── router.py          # HTTP mapping เท่านั้น
├── schemas.py         # Pydantic request/response
├── service.py         # use case / business rules
├── repository.py      # persistence boundary
├── models.py          # database model
└── tests/
```

ไม่จำเป็นต้องสร้างทุกไฟล์ล่วงหน้า ให้สร้างเมื่อ module เริ่มมี code จริง แต่ dependency ต้องไหลจาก router → service → repository/adapter

## Ownership and Branches

| Workstream | Owner | ตัวอย่าง branch |
|---|---|---|
| UX/UI + Frontend | Cake | `feature/9-learning-session-ui` |
| Auth + User | Best | `feature/6-google-oidc` |
| Session + Persistence | Seiya | `feature/8-session-api` |
| AI + Learning Engine | Steve | `feature/12-ai-orchestrator` |

ชื่อ branch อิง issue number เพื่อให้ trace กลับไปหา Acceptance Criteria ได้ง่าย

