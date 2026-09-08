# Learnly AI

AI-assisted adaptive learning web application for a university Software Engineering project.

## Scope

This project is intentionally designed as a **modular monolith** for a small user base while preserving good Software Engineering, reliability, testability, and maintainability practices.

### Core capabilities

- Authentication and user profiles
- Learning sessions
- Text / PDF / image learning inputs
- Pre-test and post-test assessments
- Interactive AI tutor
- RAG over trusted knowledge sources
- Structured AI responses with schema validation
- Learning progress and history
- Logging, error handling, timeout/retry, health checks

## Suggested stack

- Frontend: Next.js
- Backend: FastAPI
- Database: PostgreSQL
- Vector search: pgvector
- AI provider: OpenRouter via provider adapter
- Deployment: Docker Compose

## Workstreams

1. Frontend / Product
2. Backend / Learning Flow
3. AI / RAG
4. Data / Infrastructure / Reliability

Every module should have one primary owner and one reviewer.

## Development workflow

`feature/*` → Pull Request → review → `develop` → integration test → `main`

See `docs/development-workflow.md` and `docs/architecture.md`.
