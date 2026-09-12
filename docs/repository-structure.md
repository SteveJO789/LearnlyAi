# Repository Structure

โครงสร้างเป้าหมายเป็น monorepo สำหรับ Next.js frontend, Express.js modular monolith และ infrastructure โดยใช้ TypeScript ทั้งสองฝั่ง

```text
LearnlyAi/
├── apps/
│   └── web/                       # Next.js frontend
├── services/
│   └── api/                       # Express.js modular monolith
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── learning-sessions/
│       │   │   ├── input-processing/
│       │   │   ├── assessments/
│       │   │   ├── learning-profiles/
│       │   │   ├── ai-orchestrator/
│       │   │   └── rag/
│       │   └── shared/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
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
├── router.ts          # Express Router และ HTTP mapping เท่านั้น
├── schemas.ts         # Zod request/response schemas
├── service.ts         # use case / business rules
├── repository.ts      # persistence boundary ผ่าน Prisma
├── types.ts           # domain types เมื่อจำเป็น
├── index.ts           # public exports ของ module
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
