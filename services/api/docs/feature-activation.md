# Feature activation

This bundle prepares assessment and file learning for activation. Flags remain off by default. Use an isolated database and synthetic identities for rehearsal; this change does not apply a hosted migration or change deployment environment variables.

| Capability | Operator setting | Required evidence |
| --- | --- | --- |
| PRE/POST assessments, session results, Home/Profile aggregates | `LEARNLY_ASSESSMENTS_ENABLED=true` | Current app contract, authenticated Prisma writes, ownership/RLS and score persistence journey |
| PDF/PNG/JPEG upload, editable extraction review, private download and cleanup | Both assessment flag and `LEARNLY_FILE_UPLOADS_ENABLED=true` | Assessment checks, upload journal, private Storage policies/bucket, packaged OCR models and actual Storage service journey |
| Reviewed vector retrieval | `KNOWLEDGE_RETRIEVAL_MODE=vector` plus explicit model, threshold and Top K | Extension/schema, reviewed index for that model, actual database publication/search and provider/model calibration |
| In-memory development endpoint | `APP_ENV=development`, `LEARNING_DEV_ROUTE_ENABLED=true` | Local experiments only; always unavailable on Vercel/production |

Lexical retrieval remains the supported default. The development endpoint is not needed by the authenticated web app. An API flag is authoritative; no frontend flag can bypass it. File learning also requires assessments, so setting only the upload flag has no effect.

## Rehearse schema changes

Use the locked dependencies and Node 24. `npm ci` installs the reviewed legacy-precheck compatibility adapter; stop if its version/hash guard rejects the installed runtime. It only supplies absent precheck lists for twelve manifest-bound historical operations, leaving execute/postcheck SQL and migration hashes unchanged. See [executor fixtures](migration-executor-fixtures.md) and the [c7-to-current runbook](migration-runbook-c7-to-f099.md) for target identity, extension adoption, route review, transaction limits and recovery.

The current target is explicitly `f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b`. Do not use the stale `migrations/app/refs/db.json` as the target. A matching marker alone is insufficient: validate the catalog, grants, policies and real service journey too.

## Run read-only preflight

From `services/api`, build with `npm run build`. Supply `DATABASE_URL` through the operator's protected environment, then inspect a named local target:

```sh
node scripts/activation-preflight.mjs --target=local --expect-database=postgres --stage=assessments,uploads
```

For a hosted target, use `--target=remote` and the exact expected database plus `--expect-host=<exact-host>` (or `--expect-project=<project-ref>` for a direct project-prefixed hostname). The script validates the URL before connecting, checks `current_database()` after connecting and uses a read-only transaction. It prints sanitized codes and exits nonzero on a blocked prerequisite. It does not create users, upload files, run migrations or change flags. Run vector as a separate stage with its actual environment configuration; a schema-only pass does not establish vector readiness.

Upload preflight also requires authenticated schema USAGE on `storage` and each of SELECT, INSERT, UPDATE and DELETE on `storage.objects`, alongside the private bucket and RLS guards. It reports missing platform grants without changing them. The workspace service test exposed an omitted schema USAGE grant in its manually assembled foundation; hosted metadata already had the expected privileges. Recheck the intended target rather than assuming platform defaults.

`/health/ready` includes assessment schema checks only when assessments are configured, adds upload/OCR checks when uploads are configured and checks vector prerequisites only when vector is configured. `/api/v1/capabilities` reports the effective operator switches. Readiness is a deployment gate; it does not replace Auth, ownership, Storage or learning acceptance tests.

Preflight expression comparisons use checked-in PostgreSQL 17 catalog signatures generated from an isolated verified contract fixture. Each deparsed constraint/policy expression is paired with the original contract expression and bound to the current core/profile hashes. Unknown PostgreSQL major versions fail closed; signatures are never learned from the inspected database. The signature fixture was not migration-executor proof, and matching catalog structure does not prove RLS or service behavior.

## Exercise enabled services

The [enabled journey runner](../scripts/verify-enabled-feature-journey.mjs) requires an explicitly guarded local target and canonical marker before creating synthetic test users. Its `--real-storage` mode uses actual Supabase Auth, private Storage and PDF extraction. Use a trusted local HTTPS gateway and `NODE_EXTRA_CA_CERTS` for a local certificate; keep certificate verification enabled. The runner's deterministic cancellation race is separately labeled as a fixture-adapter check.

The acceptance journey must cover PRE submission, learning, POST submission, completion, saved scores after reload, History and Profile, exact retry/conflict handling, cross-owner access and direct-write denial. Upload acceptance must cover editable review, private download, cross-owner denial, cancellation/retry and persisted journal reconciliation. Browser fixtures cover the matching UI flow but do not prove the service/database behavior.

Phase A resolved the original 74 full-verification findings on a separate isolated clone: 30 were cross-space policy ownership errors in Prisma, 43 required official Auth/Storage service migrations, and one was the package snapshot differing from the official Pop-created `auth.schema_migrations.version` width. The tested clone uses PostgreSQL 17.11/pgvector 0.8.7, GoTrue `v2.188.1` and Storage API `v1.45.0`; these are the tested compatibility versions, not a production upgrade recommendation. With the explicit `gotrue-pop6-v6.1.1` catalog profile, full strict Prisma verification and all-public policy/RLS, Storage and grant checks now pass together. Run `LEARNLY_SUPABASE_CATALOG_PROFILE=gotrue-pop6-v6.1.1 npm run db:verify:full -- --target=local --expect-database=<exact-name>` after building; its canonical command uses `--strict`, never marker-only, and preserves all findings. Raw Prisma's same-name policy comparison is insufficient, so the exact catalog checks are required. See the [Thai Phase A report](phase-a-database-verification.th.md) for each finding, source evidence, security tests and the remaining target-specific production gate. No hosted migration or feature flag was changed.

## Activate a reviewed deployment

1. Re-read the actual target and complete the migration/recovery review. Apply the exact reviewed route with flags closed, then run target-specific preflight and service acceptance.
2. Configure assessment enablement on the API deployment. Check `/health/ready`, `/api/v1/capabilities` and an owned PRE → learning → POST → completion journey. Verify History/Home/Profile after reload; a zero score must remain a recorded result.
3. Configure upload enablement only after private Storage and extraction acceptance pass. Verify upload → review → learning → private download with a synthetic owned account.
4. Enable vector separately after publishing the reviewed index for the chosen embedding model and completing provider/quality evaluation. Never infer semantic quality from deterministic synthetic-vector checks.

If acceptance fails, close the affected API flag and redeploy the known configuration. Closing uploads leaves assessment enablement independent; closing assessments also closes uploads. Keep the schema and saved learner results for diagnosis. Committed schema changes require a reviewed forward repair or recovery procedure; toggling a flag does not reverse a migration. Do not expose credentials or learner content in readiness output or reports.
