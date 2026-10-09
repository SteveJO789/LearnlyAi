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
