# LearnlyAI — implementation status (2026-10-09)

## Approved decisions

- **Login complete and approved** by project owner: Supabase Auth with Google OAuth, email/password registration/login and email verification. Callback routes to `/Home`.
- **No Docker/Compose**: local Node.js 24.x development; Vercel for Next.js Web and Express API; hosted Supabase Auth/PostgreSQL.
- Browser passes verified Supabase access token as Bearer token; Express validates and uses JWT-scoped RLS database access.
- Persistent learning session create/list/detail/interaction, saved chat messages and history implemented and merged to `main` through PR #67 on October 8. Follow-up UI changes live on `develop`.

## Feature status

| Area | Status | Tracking |
|---|---|---|
| Google/email login, signup, verification | Approved complete | #5, #6 |
| Structured tutor output + provider adapter | Complete | #4, #10 |
| Persisted learning sessions | Implemented | #8, PR #59, #62, #65, #67 |
| Learning UI and history | Core integrated, polish remains | #9, #16 |
| RAG ingestion and live retrieval | Incomplete | #11, #12 |
| Adaptive tutor quality | In progress | #39 |
| Assessments, scoring and mastery | Incomplete | #13, #16 |
| PDF/image/OCR input | Incomplete | #15 |
| E2E/RLS isolation/readiness/logging | Verification still needed | #14 |
| Docker/Compose | Cancelled, not planned | #7 |

Implemented API endpoints: `POST /api/v1/learning-sessions`, `GET /api/v1/learning-sessions`, `GET /api/v1/learning-sessions/:sessionId`, `POST /api/v1/learning-sessions/:sessionId/interactions`. There is also a standalone in-memory `/api/v1/learning/respond` development slice. Material upload and assessment endpoints remain planned.

Current `/health/ready` returns API-only readiness (not a dependency probe); do not claim full E2E, cross-user isolation or production reliability has passed without test evidence.

See `authentication.md`, `api-contract.md`, and `architecture.md` for current contracts.
