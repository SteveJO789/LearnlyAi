# Review runbook: observed c7 to current f099 contract

This is the operator review bundle for the current canonical route from the observed application marker to the branch's current contract. It is not an instruction to change a hosted database or enable a feature. A target-specific activation still requires a fresh marker/catalog check, an approved maintenance window, a backup/recovery point, and a passing isolated executor and service journey.

## Reviewed route and integrity

The current observed application marker is `c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665`, with profile hash `3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2`. The read-only inventory also reported pgvector `0.8.2` in schema `extensions`, no `FileUpload` or `KnowledgeChunk` table, and no rows in Storage buckets. Only an `app` marker row was observed; there was no `pgvector` marker row. Re-read the actual target before any application; these observations can go stale.

The current app target is `f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b`, with the same profile hash. The graph contains these immutable app edges from c7:

| Migration | From → to | Hash | Effect |
|---|---|---|---|
| `20261009T1032_session_ownership_contract` | c7 → `909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef` | `b7483466a9b8765f855c4f95a26afbdeb44cad471f74b381b9ddde5ed3dc8bdd` | Adds owner-scoped session/message policies and RLS-protected write grants. |
| `20261009T1446_assessments_server_writes` | `909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef` → `83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189` | `0d834d5557ba4634d88d5750b4d8a35ac330d0ea84956be789f4db5906d6eea1` | Adds assessment snapshot/submission metadata, answer uniqueness, and API-context ownership policies. |
| `20261009T1524_text_material_pipeline` | `83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189` → `d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397` | `524917ff39dac4fc8d88ddfe750faff7299c18d048ecfa5460cf3ec67122768f` | Adds the owner/API-context source-material write policy. |
| `20261010T0752_private_material_storage` | `d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397` → `8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8` | `123a3d4e4cea5ede25f53ca66ed60de63bae579da2e7249aa0c45ddea374c5de` | Adds `SourceMaterial.storageBucket`, a private `learnly-materials` bucket limited to 3 MiB and PDF/PNG/JPEG, and owner/guard policies. |
| `20261010T1119_durable_file_uploads` | `8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8` → `26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a` | `56858737a1054c6ca05679492783ee760bd77f0f8ddaa7b70c9e761dfe574930` | Creates the RLS-protected `FileUpload` journal, indexes, session foreign key, and API write/ownership policies. |
| `20261010T1154_journal_storage_gate` | `26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a` → `076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8` | `5970aaa2f4d41a0382cce693e989a4eb6418e260017f62f9ec709c86129b351a` | Replaces the journal state check to allow `FINALIZED`, and requires an exact owned pending journal before Storage insertion. |
| `20261010T1653_file_material_review` | `076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8` → `0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620` | `6276f2aed07c583d46bd9571e8243d42ebb590b5de099e0babba2bbcc93ea39a` | Adds RLS-protected learner material review metadata updates. |
| `20261010T1750_reviewed_knowledge_vectors` | `0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620` → `5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab` | `6aeacf4600439808822db77f19add5b18af5977f1fccecab59b13fa5b1ae6df2` | Requires `extensions.vector`, creates reviewed `KnowledgeChunk` storage/indexes and read-only grants/policy. |
| `20261011T0651_upload_cleanup_receipts` | `5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab` → f099 | `bc6b4d704a24379e974b26ee49234a7540bc1d9c400ff1f3943bfa00afc4beec` | Adds upload cleanup timestamp and state constraint. |

The route also includes the `pgvector` extension-space edge (`empty` → `3d2c56a2944685bd21b05bc8a8d73164397df51c014201902932fbe7e80ff1b8`, migration hash `12b0b77e65c4899ba04e88ed040b1cb3390b4b18a889460f8a83cb6047ff1fa5`) and the Supabase extension descriptor. Pgvector is already installed on the observed target but there is no pgvector marker. The canonical executor checks for a valid existing `extensions.vector` first, skips creating an already-installed extension, then records the legitimate extension contract marker and migration ledger state as part of the transaction. Do not use `db sign` for the pgvector contract, hand-write a marker, or move/recreate an already shared extension. A fresh target must establish `extensions.vector` before applying app migrations that require it.

Local executor evidence is split across retained disposable fixtures and reports rather than one complete passing suite. The preinstalled-vector canonical apply report passed and preserved the extension identity while recording the extension marker and ledger (`/workspace/reports/learnlyai-activation-preinstalled-vector-executor-2026-10-16.json`). A fresh isolated canonical c7 suffix apply reached f099, preserved synthetic learner/session/message data, recorded the c7 suffix ledger, and passed a no-op rerun (`/workspace/reports/learnlyai-activation-executor-c7-suffix-final-2026-10-17.json`). A separate wrong-origin attempt was rejected without state change, and the late rollback proof passed on a unique local clone. Current c7/no-op and wrong-origin checks are in `/workspace/reports/learnlyai-activation-executor-c7-wrong-origin-evidence-2026-10-17.json`; rollback evidence is in `/workspace/reports/learnlyai-activation-executor-rollback-final-2026-10-17.json`. The full `prisma db verify` remains blocked: the CLI reports 30 public policy paths plus 43 Auth and one Storage catalog paths, despite an independent live-catalog comparison finding the actual 30 policies and all 90 manifest expressions equal to the generated schema-verified baseline. Do not treat the separate checks as a passing end-to-end suite or full schema verification. The local PostgreSQL 17.11/pgvector 0.8.7 and Auth/REST/Storage images differ from observed production versions (PostgreSQL 17.6/pgvector 0.8.2), and synthetic c7 rows are not production data.

The journal check replacement is the only `destructive`-classified operation in the app route. It drops the original `PENDING/CANCELLED` check and immediately adds the wider `PENDING/FINALIZED/CANCELLED` check. `FileUpload` is first created in this same route and was absent from the observed c7 inventory, so no existing production rows are expected in that table. Verify this precondition against the real target before applying; do not infer safety from the synthetic fixture.

All existing migration manifests, operation lists, source files, snapshots, refs, and hashes remain unchanged. No new migration is proposed by this runbook: the known vector issue is a prerequisite/schema-location check. If the canonical executor demonstrates a defect after the supported `extensions` precondition is met, author a new reviewed forward migration; never edit applied history or manually write a marker.

## Preconditions

Before applying to a named target, record the exact target identity without credentials and confirm:

- The `app` marker is still c7 with profile `3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2`; do not assume the read-only observation remains current.
- The target has the expected Supabase-managed Auth/Storage catalog, roles and `auth.uid()` behavior. The local executor fixture's synthetic Auth/Storage foundations are not equivalent to those services.
- pgvector is available in `extensions`, and `to_regtype('extensions.vector')` resolves. Current c7 inventory observed version `0.8.2`.
- Inspect the `pgvector` contract-space marker and ledger separately from the `app` marker. If `extensions.vector` already exists and its catalog identity/version are understood, the canonical executor owns adoption: its pgvector postcheck recognizes the installed extension before creation and records the verified marker and ledger entry transactionally. Do not invoke `db sign` for pgvector or add marker/ledger rows manually. Stop if the canonical executor cannot verify the existing extension or the resulting state is ambiguous.
- The target's storage catalog has the `buckets` and `objects` fields/policies this bundle expects; the target bucket state has been re-read. The migration creates the private bucket and adds policies but does not upload objects.
- `FileUpload` and `KnowledgeChunk` are still absent, or any changed state is separately understood and the route is re-reviewed.
- A recoverable backup/restore point exists; API and web deployment order is reviewed; conflicting DDL/migration writers are quiesced. Assessment and upload feature flags remain closed through schema apply and target-specific validation.
- The isolated canonical executor, full `db verify`, RLS/API journeys, and any required Storage service checks have passed for this exact migration bundle and compatible PostgreSQL/Supabase foundations. The current full-verifier blocker means this precondition is not yet met.

Run integrity and route review from `services/api`, with the operator's target URL supplied only in the environment. Do not paste it into a command history, report, screenshot, or chat:

```sh
npx prisma migration check --json
npx prisma db migrate --show --from c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665 --to f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b --json
npx prisma migration status --db "$DATABASE_URL" --to f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b --ascii
npx prisma migration log --db "$DATABASE_URL" --json
```

The repository's `migrations/app/refs/db.json` still points to the older d7 baseline. Use the explicit target below; do not run bare `prisma db migrate` and let a stale ref choose a route. The offline `--from c7` preview checks graph reachability; `migration status --db` checks the actual target marker and pending path. Stop if these disagree with the observed c7 origin or include any unreviewed edge. The canonical `db migrate` invocation uses the actual per-space state and handles an already-installed extension through its verified postcheck; do not add a separate `db sign` step for pgvector.

## Apply and verify

Applying is a separately authorized production operation. This runbook contains no DSN, secret, or hosted command credential. When an operator has authorized the exact target and reviewed the preconditions above, apply the explicit target:

```sh
npx prisma db migrate --db "$DATABASE_URL" --to f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b --json
npx prisma db verify --db "$DATABASE_URL" --json
npx prisma migration status --db "$DATABASE_URL" --to f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b --ascii
npx prisma migration log --db "$DATABASE_URL" --json
```

Review the application marker at f099, profile `3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2`, pgvector marker at `3d2c56a2944685bd21b05bc8a8d73164397df51c014201902932fbe7e80ff1b8`, all nine app suffix ledger edges, the Storage bucket/policies, and the expected `FileUpload`/`KnowledgeChunk` catalog. A `SELECT 1` or marker-only result is not catalog, RLS, Auth, Storage, or journey acceptance. Keep feature flags closed until the target-specific preflight and synthetic owned-user journey pass; perform upload/download/delete and cross-owner Storage tests only when the actual authorized Storage service is reachable.

## Transaction and recovery boundary

The installed Prisma 8 RC's PostgreSQL executor wraps one `db migrate` invocation—pending migrations across contract spaces and marker/ledger updates—in a transaction. A failed step should leave the database at its pre-command schema and marker/ledger state. The isolated executor fixture tests this behavior with the late `extensions.vector` precondition. Do not translate that local test into a claim that a hosted migration has run successfully.

If apply fails, preserve the complete sanitized CLI diagnostics, re-read `migration status`, `migration log`, markers, and the affected catalog. Do not manually sign, insert a marker, replay individual SQL, or alter an existing migration artifact. Resolve a verified precondition issue and rehearse the exact route again before retrying. If the connection drops after command submission, treat the outcome as unknown and inspect actual marker/schema/ledger before deciding what action is safe.

The transaction boundary ends when the command commits. Prisma does not reverse a committed migration bundle automatically. If post-commit checks fail, keep flags closed and use the approved restore procedure or a separately reviewed forward repair; do not run the old route backward or edit its hash. Production Auth/Storage service behavior and feature acceptance remain distinct from PostgreSQL executor success.
