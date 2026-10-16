# LearnlyAI test-review fixes — 2026-10-16

This change addresses reproducible conversation, Auth and availability defects from the test review. The source baseline is `daf344061050d7d775ce546d35000aaf60332616`. Implementation used Sol survey/review and Luna coding, followed by unit, persistent-route, real SQL and browser regression checks.

## Behavior changes

- New conversation turns use a server logical clock: USER precedes TUTOR and every successful turn follows the existing session/message clock, even with a frozen or backward wall clock. Session writes and messages retain the existing optimistic transaction boundary.
- The shared reader preserves PostgreSQL microsecond precision internally. For an exact legacy timestamp containing one USER and one TUTOR it restores USER → TUTOR. Ambiguous multi-pair legacy ties remain in deterministic ID order; original chronology cannot be recovered reliably. Stored IDs, content and original timestamps are preserved.
- Session responses expose additive server-derived progress and version. Chat uses those values for actions, reconciles persisted message IDs after writes, renders Continue consistently, blocks terminal/failed/loading states, and refreshes rather than replaying ambiguous mutations.
- A per-tab, session-specific first-send marker stores only a base version. Reloading an empty session after an uncertain auto-send does not automatically send the first message again.
- Assessment authorization is bound to the route-approved session version. A concurrent request cannot use a stale PRACTICE snapshot to advance through ASSESS without the POST gate being checked.
- Protected content responds to Auth changes, discards stale startup results and remounts when the user changes. Transient Auth/profile failures show Retry; confirmed Auth rejection is handled separately. An old account's delayed rejection cannot sign out the current account.
- Missing app profiles follow the existing ownership-aware sync path rather than being confused with missing Auth. Legacy app IDs remain unchanged.
- Logout checks SDK errors. The installed SDK may remove the local session even when server logout fails: protected content remains hidden, and SignIn shows a fixed, non-sensitive notice that server revocation was not confirmed. Tokens are never restored to retain a protected page.
- Upload availability distinguishes checking, disabled and failed checks with retry and accessible disabled controls. File learning remains fail-closed; text learning still works when capabilities are unavailable.

## Tests and evidence

Local validation passed: API 337/337, authenticated persistent-route tests 16/16, runtime Knowledge 4/4, Web 54/54 across 15 files, and Chromium browser regressions 19/19. Type checks, the production Web build, and the fresh source-export/relocated API runtime check also passed. No tests were skipped in the unit or persistent-route suites. GitHub CI is verified separately at the submitted PR SHA.

Browser tests run the production Next app and real browser-side Supabase SDK with synthetic Auth/PostgREST/API responses; they do not exercise real OAuth accounts or paid inference. The profile-outage fixture exposes its Retry-After header so the SDK can follow the configured retry timing; production retry behavior is unchanged.

The real PostgreSQL check uses an isolated local PostgreSQL 18.4 fixture with the actual reader SQL and test ownership policies through a `pg` adapter. It checks exact transcript order, distinct microseconds, legacy/new messages, SYSTEM events, content/citations and owner isolation. It is not proof of the actual Prisma executor, production policies, catalog or migration marker.

Browser regressions are in `tests/e2e` and are included in Web CI. See `tests/e2e/README.md` for build-time public fixture configuration and local browser commands.

## Test-case follow-up

| Cases | Outcome covered by this change | Remaining verification |
|---|---|---|
| CORE-06/07, HIST-01 | Shared conversation ordering, hydration, Continue and History regression | Live user sessions and inherently ambiguous historic ties |
| CORE-05/08 | Context ordering, recovery, blocked controls and no automatic replay | Real failed-session journey on the target environment |
| AUTH-05/06/07 | Startup/account-switch/logout races, browser multi-tab behavior, invalid-token offline tests | Reproduce original AUTH-05 on the exact production origin; real OAuth/refresh-token behavior |
| PASS-01/02/03 | Existing password isolation/protocol tests retained | Account mutation and uncertain transport on safe real test accounts |
| CORE-02/03/04, OFF-01..05, UX-01 | Input boundaries, capability fallback/retry, explicit disabled upload, browser keyboard-reachable controls | Broader mobile/manual accessibility pass and authenticated disabled APIs on target |
| CORE-01, ENG-11 | Corrected persisted AI context and existing strict output/citation regression suite | The reported unusual AI answer needs a sanitized prompt/output example and content evaluation |
| ASM-01..06 | Existing assessment tests retained; stale-version POST-gate bypass fixed | Enabled Assessment/DB environment and real PRE/POST/profile journey |
| UP-01..13, VEC-01..03 | Existing offline ingestion/review/vector tests retained | Configured isolated Storage/OCR/vector services and real ownership/concurrency journeys |
| ENG-01/02/08/10 | Current source/build/browser/runtime verification, CI configuration and explicit evidence scopes | CI at final PR SHA; live dependency failures and deployment smoke |
| ENG-03..07/09/12..14 | Existing migration/ownership/deployment/diagnostic protections preserved | Actual executor/catalog/marker/RLS, production log review and enabled full journey |

Manual statuses are not changed to “passed” merely because an offline or browser fixture succeeds. No Assessment/Upload flags or production migrations are changed by this patch. The durable sequence-column design remains a separate schema evolution if required; the current fix works with the existing schema and has no migration dependency.

## Rollout

Review and merge through the normal repository workflow. Deploy the additive API changes before a Web build that consumes the new session progress/version fields. The current work is prepared as a draft change; production release and live acceptance are separate from local regression proof.
