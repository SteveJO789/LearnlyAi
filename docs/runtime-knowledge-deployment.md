# Pilot runtime Knowledge delivery (P2.5)

Strategy: **GENERATED_FROM_TRACKED_SOURCE**. Artifact storage provider: **NOT YET SELECTED**.

## Authoring and review boundary

The source of truth is `knowledge/concepts/physics/electricity/ohms-law.md`, reviewed
Ohm's Law `physics.electricity.electric-circuits.ohms-law`, version `0.2.0`, schema
`1.0`. The tracked promotion record under
`knowledge/reviews/document-history/physics.electricity.electric-circuits.ohms-law/20261001T104541Z/`
records the exact approved Markdown hash and physics/language approvals.

The canonical parser can generate JSON from tracked Markdown alone. The **full
authoring validation/build** additionally reads raw archives, normalized units,
asset verification and review evidence. Those gates remain unchanged and require
the restored evidence described in [ARTIFACTS.md](../knowledge/ARTIFACTS.md).
Runtime preparation publishes the already approved release; it does not perform
new curation, approve drafts, or claim to revalidate missing source archives.

Preparation pins the approved Markdown SHA-256, checks the promotion's identity,
version, hash and matching review metadata, and runs the existing canonical schema,
source-reference, permission, physics-review and language-review validation.
Changed prose, missing source, revoked permissions or invalid contracts fail the
command. A later release requires an explicit reviewed change to the pilot pin.

## Exact runtime contract

Generated, ignored output:

```text
services/api/runtime-knowledge/
├── build/concepts/physics/electricity/ohms-law.json
├── manifest/sources.json
├── NOTICE.md
└── schemas/
    ├── knowledge.schema.json
    ├── source.schema.json
    ├── source-pilot.schema.json
    ├── curation-provenance.schema.json
    ├── curation-input.schema.json
    └── verified-assets.schema.json
```

- The JSON preserves concept/version/schema identity, review metadata, teaching
  sections, formulas, worked example, and original citation/source locators.
  Only the optional authoring curation envelope and Detailed Provenance section
  are removed. The reader's teaching projection and citation policy are unchanged.
- `manifest/sources.json` contains only the concept's referenced Siyavula source
  record, including publisher URL, license and permission. No reference-only
  IPST/OBEC content is included.
- The six schemas are the exact transitive closure of the unchanged Knowledge and
  source schemas. Even optional `$ref` dependencies must be present for strict AJV
  compilation. No acquisition, normalization or review-record schemas are needed.
- `NOTICE.md` preserves original source, CC BY 4.0 attribution and LearnlyAI's
  Thai adaptation notice. It is a distribution notice, not reader input.

The `build/` segment inside this dedicated package retains the existing reader
contract. It has no dependency on the separate ignored `knowledge/build/`.
No books, normalized records, images, reviewer history, machine paths, environment
files or dependencies belong in this **Knowledge package**. API runtime dependencies
are installed separately. Generated output contains no build timestamp.

## Fresh checkout and preparation

Node 24; from repository root:

```sh
npm --prefix knowledge ci --no-audit --no-fund
npm --prefix services/api ci --no-audit --no-fund
npm --prefix services/api run knowledge:prepare-runtime
npm --prefix services/api run lint
npm --prefix services/api test
npm --prefix services/api run build
npm --prefix services/api run knowledge:verify-runtime
npm --prefix services/api run knowledge:verify-fresh
```

Preparation itself is offline, deterministic, bounded to the pinned release, and
does not modify authoring content. Dependency installation is the separate network
step. Every API `build` (and thus `test`) automatically compiles Knowledge source
and prepares the release before compiling API source. It never uses stale `dist/`.

When the installed npm launcher is blocked by a local trust policy, leave that
policy intact. With locked dependencies already installed, equivalent direct checks
are `node knowledge/node_modules/typescript/bin/tsc -p knowledge/tsconfig.json`,
`node knowledge/scripts/prepare-runtime.mjs`,
`node services/api/node_modules/typescript/bin/tsc -p services/api/tsconfig.json`,
`node services/api/scripts/copy-contract.mjs`, and
`node --test services/api/test/*.test.mjs`. These do not repair npm installation.

The fresh verification command exports Git-listed source plus prospective unstaged
source files, excludes ignored artifacts, copies installed third-party dependencies
as physical files, compiles from scratch, prepares twice, compares file lists,
lengths, hashes and bytes, runs all API tests, and then runs real retrieval/HTTP
smoke tests from a separately relocated API package. No links to primary evidence
are used. This is a source-only checkout simulation with already installed tools,
not evidence of a new npm download or a hosted deployment.

## CI

`.github/workflows/ci.yml` installs both locked packages, prepares runtime
Knowledge, tests source-only generation/determinism, typechecks/tests/builds the API
and verifies the fresh export plus relocated runtime. API tests use the generated
release for reader/retriever, default composition, HTTP success, linked citations,
and missing/invalid artifact 503 with zero model calls and zero persistence writes.
CI does not fetch textbooks or run acquisition/full-corpus restoration.

## Vercel and portable deployment

The existing API is Express (`services/api/src/app.ts` default export and
`src/server.ts` listener); the web app is separate in `apps/web`. The repository
records Vercel checks, but its old README/Azure workflows are not deployment
configuration. Read-only inspection of the current `learnly-ai` Vercel dashboard
on 2026-10-06 confirmed Root Directory `services/api`, Express preset, Node `24.x`,
**Include files outside the root directory** enabled, and no custom dashboard
install/build/output overrides. The current GitHub commit has successful checks
for `learnly-ai` and `learnlyai-web`. No dashboard changes were made.

`services/api/vercel.json` makes the API contract explicit:

- API project Root Directory: `services/api`; framework: Express; Node 24.
- Enable **Include source files outside of the Root Directory in the Build Step**.
  Build-time inputs are `knowledge/` and `contracts/`. They are not runtime evidence.
- Install command installs API and Knowledge locked dependencies.
- Build command: `npm run build && npm run knowledge:verify-runtime`.
- Function configuration for `src/**` explicitly includes
  `{runtime-knowledge/**,src/contracts/**}`. The prepared Knowledge package is
  inside the API project root. There is no dependency on bundling all of `knowledge/`.
- `copy-contract.mjs` copies the unchanged Tutor Output schema for both `dist/`
  and the source Express entrypoint (`src/contracts/`). This packages the same
  schema; it does not modify the Tutor Output contract.

Vercel's [Express entrypoint rules](https://vercel.com/docs/frameworks/backend/express),
[function includeFiles configuration](https://vercel.com/docs/project-configuration/vercel-json#functions),
and [monorepo build-input setting](https://vercel.com/docs/monorepos/monorepo-faq)
define these requirements. The setting outside the root is already necessary for
the API's shared Tutor Output schema. Verify that setting when configuring the API
  project if it is recreated; the existing API project already has it enabled.
No Vercel dashboard change or deployment is performed by these scripts.

For a standalone compiled Node deployment, ship `dist/`, `runtime-knowledge/`,
API `package.json` and production dependencies together, keeping `dist/` and
`runtime-knowledge/` as siblings. Run `node dist/server.js`. The API resolves the
default root with `import.meta.url`; unrelated current directories work, and source
and compiled layouts resolve the same package. It never falls back to
`knowledge/build/`. A missing matching artifact still fails safely as HTTP 503.

`KNOWLEDGE_ROOT` or the composition option `knowledgeRoot` may override this default.
Use an absolute directory with the exact runtime contract above. A relative
explicit override retains the reader's existing cwd-relative semantics. It is a
trusted deployment setting, never user query input. The reader still checks
schemas, source permissions, review status, approvals, concept/version and bounds.

## Guarantees and limits

This proves reproducible delivery of the pinned approved teaching material, schema
validity, portable packaged retrieval, and safe artifact failures. It does not
prove factual entailment, retrieval quality beyond this pilot, prompt-injection
resistance, live model quality, or a successful hosted Vercel deployment. No
embeddings, pgvector, adaptive tutoring, Auth, Prisma or ModelProvider changes are
part of this work. The P0 evidence storage/restore policy remains unchanged.

## Verification on current source (2026-10-06)

- API typecheck and tests: **161/161 PASS**, including existing P1/P2 suites and
  four prepared-artifact smoke/failure checks.
- Knowledge typecheck and tests: **50/50 PASS**. Full authoring validation: **PASS**;
  evidence integrity: **987 files PASS**. A fresh full authoring build publishes
  one reviewed concept; its reader result equals the prepared runtime result.
- Runtime package: **9 files, 34,346 bytes** (including attribution and schemas).
  Two preparations have identical file paths, byte lengths, SHA-256 and bytes.
  Tree fingerprint (sorted path + NUL + bytes + NUL, repeated per file):
  `4b5da283990bb107f3dcbc6785b765255e9e219b3593c4de41cf12ea73dc4b97`.
- Fresh source-only export compiles/prepares twice and passes all **161 API tests**;
  independently relocated deployment package passes **4/4 runtime checks**.
- Real prepared reader/retriever matches Ohm's Law and returns `[]` for photosynthesis;
  engine + MockModelProvider returns HTTP **200**, valid Tutor Output and linked
  `@0.2.0:teaching-v1` citation. Missing/invalid roots return **503**, **0** model calls,
  **0** persistence writes.

Locked installed dependencies were reused as physical copies in the fresh-export
simulation because the local Node manager blocks its untrusted npm entrypoint.
Compiler/test/preparation checks ran directly; npm trust settings were unchanged.
No hosted deployment was made or claimed as proof of these new changes.
