# End-to-End Tests

These tests run the built Next.js app in Chromium. They seed Supabase Auth's normal browser storage and stub GoTrue, PostgREST, and the same-origin `/api` responses with Playwright routing. They do not use test-only app routes, Google OAuth, or a paid AI provider.

From `apps/web`, build once, then run:

```sh
export NEXT_PUBLIC_SUPABASE_URL=https://e2e.supabase.co
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e_test_key
export NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
npm run build
npm run test:e2e
```

Install the pinned Playwright browser first when needed:

```sh
npx playwright install chromium
```

On a machine with system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Playwright runs the app on `127.0.0.1:3100`; public Supabase values must be present during build because Next.js embeds them in browser code. CI builds with the same dummy values, installs Chromium, then runs the same script.

