# Official Supabase SQL fixtures

These migration files are copied byte-for-byte from:

- Auth: [supabase/auth@4eee58f](https://github.com/supabase/auth/tree/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/migrations), tag v2.197.0, MIT license; see `AUTH-LICENSE`.
- Storage: [supabase/storage@36a3a23](https://github.com/supabase/storage/tree/36a3a23f69896201f62ecd711d6f648520484403/migrations/tenant), Apache-2.0 license; see `STORAGE-LICENSE`.

The adjacent `modern-supabase-supplemental-source` directory contains three more unmodified Storage SQL files under the same Storage license. The checked-in source subset backs the contract changes and supplemental semantics; it is not a complete Supabase bootstrap.

`scripts/lib/supabase-catalog-profile.mjs` pins 17 source SHA-256 fingerprints. The supplemental manifest additionally pins three older Storage files and references the execution evidence for all 75 Auth and 73 Storage migrations on a fresh, independent PostgreSQL 17 source fixture. Expected signatures come from that fixture, never from the production catalog or the structural rehearsal target. Storage function ownership is a separate declared service-role expectation (`supabase_storage_admin`).

The profile describes Storage's official multitenant branch, which skips the optional Iceberg tables, and preserves Auth migration metadata as `varchar(255)`. The Storage ledger fingerprints prove the source migration envelope, not the running service image tag. Historical SQL in later Storage tags differs, so replacing this source with a newer tag requires a new review and independent fixture run.

Run `npm test` in `services/api` to verify source fingerprints, contract validity, immutable migration overlays, and the mandatory fail-closed supplemental gate. Read `docs/production-rehearsal.th.md` for the real local integration results and production blockers.
