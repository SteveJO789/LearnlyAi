# Server-controlled assessment and learning writes

Supabase Auth and JWT-scoped Prisma/RLS remain unchanged. Browser profile edits to User remain supported.

Ownership RLS alone permits an authenticated learner to mutate their own server-owned state via the Supabase Data API. Scores, mastery, learning stage/progress and tutor messages must be computed/validated by the API.

API writers set `learnly.api_write=1` using `set_config(..., true)` on the same JWT-bound transaction that performs the write. It expires on transaction completion; it is never copied from headers, request bodies or user metadata. Restrictive RLS guards protect sessions/messages even if old permissive ownership policies remain. New assessment/profile write policies require both the API write context and ownership.

This is an application SQL-channel boundary, not a secret or a new authentication session. A party with direct database SQL credentials can set a custom PostgreSQL setting. Those credentials must stay backend-only. No exposed RPC may offer arbitrary SQL or set this context. The current public function catalog contains no functions (checked read-only 2026-10-09); re-audit this invariant when adding RPCs/exposing schemas. Do not authorize writes using user-editable JWT metadata or request headers.

Assessment snapshots contain original deterministic exercise operands, without storing an explicit answer key. Public HTTP question DTOs omit grading rules. The API derives scores from its persisted snapshot, never from client score fields or an LLM. Submitted assessments/answers are immutable through the API, and a single transaction records scores, answers and the updated learning profile.

Verify direct unmarked authenticated writes are denied, marked owned writes work, marked cross-user writes remain denied, and the context cannot leak across transactions. Rollback test fixtures; never replay destructive historical data migrations on production.

References: [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [transaction-local settings](https://www.postgresql.org/docs/17/functions-admin.html), [Supabase database function security](https://supabase.com/docs/guides/database/functions).
