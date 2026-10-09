# Infrastructure

Decision (2026-10-09): **Docker and Docker Compose are not used**. Develop with Node.js 24.x locally, deploy Next.js Web and Express API to Vercel, and use hosted Supabase Auth and PostgreSQL/RLS.

Local Web: `cd apps/web && npm ci && npm run dev` with `.env.local`.
Local API: `cd services/api && npm ci && npm run dev` with `.env`.

Configure deployment variables in Vercel, Google login/redirects in Supabase Auth, and never commit real secrets. See `docs/authentication.md` and `docs/project-status-2026-10-09.md`.
