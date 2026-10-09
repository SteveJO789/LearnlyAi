# LearnlyAI Web

Current routes: `/` landing, `/SignIn`, `/SignUp`, `/verify-email`, `/auth/callback`, `/Home`, `/Create`, `/Chat/[sessionId]`, `/History`, and `/Account/Profile`.

Login via Supabase Auth supports Google OAuth or email/password + email verification and is approved complete. A successful callback navigates to `/Home`. Learning sessions, chat and history connect to the Express persistence API using Supabase Bearer tokens. File/OCR, full mastery and assessments are still planned.

## Local development (Node.js 24.x, no Docker)

```bash
cd apps/web
npm ci
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never publish service-role or database secrets. Web is deployed on Vercel.
# MVP completion checks

`npm test` now compiles selected real client/components to an ignored CommonJS test directory and runs authenticated-client, error/empty/loading/result rendering and calculator truth-table tests. This uses installed TypeScript/React and adds no test dependency. `node scripts/run-tests.mjs` is equivalent when a local npm shim is blocked. Tests are not browser/mobile/keyboard E2E proof.

The completion branch adds `/Assessment/[sessionId]`, the `/History` alias, authenticated learning profile/progress summaries on Home/Profile, and functioning OHMS_LAW/LINEAR_EQUATION/LOGIC_GATE widgets. New Create input is persisted as owned text material before PRE assessment, then restored in Chat. Production API migrations must be reviewed/applied before deploying this source. CD remains enabled only for develop.
