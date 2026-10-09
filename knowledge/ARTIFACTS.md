# Knowledge baseline: Git and evidence restoration

Artifact storage provider: NOT YET SELECTED

P2.5 adds a separate **generated deployment package** at
`services/api/runtime-knowledge/`, ignored by Git. It publishes only the pinned
reviewed Ohm's Law release from tracked Markdown and the recorded promotion hash;
it neither changes authoring evidence gates nor restores the corpus. See
[runtime preparation and packaging](../docs/runtime-knowledge-deployment.md).
`raw/`, `normalized/`, `build/`, `dist/`, `node_modules/` and `.playwright-cli/`
remain excluded. No promoted runtime snapshot is tracked in this approach.

This policy preserves the existing editorial baseline. It does not introduce
retrieval, embeddings, source ingestion, or automatic review. Ignored evidence is
still required by the validation gate; ignoring it is not a backup.

## Tracking policy

Every current top-level directory has exactly one classification:

| Directory | Classification | Reason |
| --- | --- | --- |
| `src/` | TRACK_IN_GIT | Pipeline, deterministic normalizers and review tooling source |
| `schemas/` | TRACK_IN_GIT | Explicit versioned contracts |
| `scripts/` | TRACK_IN_GIT | Source audit and read-only integrity utilities |
| `test/` | TRACK_IN_GIT | Tests and small authored fixtures |
| `review-ui/` | TRACK_IN_GIT | Local reviewer UI source, not browser state |
| `manifest/` | TRACK_IN_GIT | Source permissions and curriculum mapping |
| `acquisition/` | TRACK_IN_GIT | Acquisition ledger, exact URLs/revisions, checksums, license evidence, scoped pilot audits and evidence inventory |
| `concepts/` | TRACK_IN_GIT | Reviewed authoring content and explicitly marked sample drafts |
| `curation/` | TRACK_IN_GIT | Authoring inputs and pending drafts; drafts remain excluded from production |
| `reviews/` | TRACK_IN_GIT | Human decisions, transcription corrections and promotion history |
| `verified-assets/` | TRACK_IN_GIT | Asset identities, provenance and verification metadata; images remain inside raw archives |
| `evaluation/` | TRACK_IN_GIT | Small authored evaluation questions; no retrieval implementation |
| `raw/` | ARTIFACT_STORAGE | Immutable third-party archives, about 98 MB total; not ordinary Git content |
| `normalized/` | ARTIFACT_STORAGE | 984 generated JSON records, about 4 MB; exact bytes underpin editorial evidence |
| `build/` | IGNORE_LOCAL | Reproducible canonical JSON from reviewed authoring sources |
| `dist/` | IGNORE_LOCAL | Compiled TypeScript output |
| `node_modules/` | IGNORE_LOCAL | Installed dependencies, reproducible from the unchanged lockfile |
| `.playwright-cli/` | IGNORE_LOCAL | Local browser/automation state |

Track the package README/specification, `package.json`, `package-lock.json`,
`tsconfig.json`, `.gitignore`, `.gitattributes` and this policy too. Temporary
output, logs, caches and pipeline staging directories are IGNORE_LOCAL.

REVIEW_REQUIRED applies to new evidence with unclear permission, ancillary
third-party components outside the approved scope, credentials and machine-specific
configuration. No current top-level directory needs this classification after
baseline inspection. Do not place such files among tracked provenance documents
without reviewing them. Environment files and local `.npmrc` are ignored.

## Source and license boundaries

`manifest/sources.json` is the approved/reference-only/blocked source registry.
`acquisition/manifest.json` identifies the **three exact acquired archives** by
source ID, artifact ID, original filename, URL, acquisition time and SHA-256.
The ledger's acquisition parser version is historical; actual normalization
versions/scopes are recorded in `acquisition/evidence-inventory.json`.

- Grade 11 English unbranded Siyavula Physical Sciences EPUB: internal CC BY 4.0
  notice and artifact inspection are documented in
  `acquisition/pilot-physical-sciences-g11.md`.
- Grade 10 English unbranded Siyavula Mathematics EPUB: artifact-specific CC BY
  4.0 notice, identity evidence and the publisher's copyright-heading typo are
  documented in `acquisition/source-pilot-licenses.json`.
- Open Logic ZIP: revision `1e960beff9ed7835bf3e3f1335e21af3439cd107` is pinned.
  Selected text is CC BY 4.0; bundled styles/packages may have separate licenses.
  Their license boundaries and notice hashes are retained in that same license
  ledger. Do not infer blanket redistribution permission for the complete ZIP.

Keep attribution, adaptation notices and edition-specific permissions when
making an evidence bundle. Source permission does not mean document approval.
Reference-only/blocked sources must not be acquired for this baseline.
Do not add books or extracted bulk source text to Git to prove provenance.
The tracked pilot reports/drafts contain bounded, attributed evidence excerpts,
not complete books; their existing provenance must remain intact.

## Exact restoration contract

All inventory paths are relative to `knowledge/`, portable slash-separated paths.
`acquisition/evidence-inventory.json` contains a byte length and SHA-256 for every
raw archive and every normalized JSON record, with each artifact's normalizer
version, scope and expected record count. It contains no archive/source body text.
`acquisition/manifest.json` remains the authority for raw acquisition identities.
The `.gitkeep` placeholders have no semantic content and need not be restored.

Another developer restores this baseline as follows:

1. Check out the source-controlled baseline and use Node 24 (`../.nvmrc`). Install
   unchanged locked dependencies with `npm ci` when the environment permits it.
2. Obtain the retained evidence bytes from Steve's existing local copy or a
   separately managed evidence bundle. A storage provider and durable backup must
   still be chosen; no external URL or store is implied by this policy.
3. Copy each archive to the **exact** `raw_path` in `acquisition/manifest.json`.
   Retain original bytes, filename and archive contents. Prefer read-only files.
   A publisher download from its recorded `source_url` is a candidate restoration
   source only if its SHA-256 matches. The same Open Logic revision does not
   guarantee the same ZIP bytes if an upstream archive is repackaged.
4. Run `node scripts/verify-evidence.mjs --raw-only`. Missing files, extra files,
   different sizes or checksums must fail. Do not alter the acquisition ledger
   to accommodate a different download or rerun acquisition over this baseline.
5. Restore the normalized snapshot at the exact `normalized/.../*.json` paths in
   the inventory. Preserve JSON bytes and LF endings. Alternatively reproduce it
   **in a fresh scratch root**, using the pinned code, dependency lockfile, raw
   archives and the per-artifact scopes below. Verify every reproduced file before
   copying it into the working evidence directory. Never regenerate over existing
   reviewed evidence as a setup shortcut.
6. Run `node scripts/verify-evidence.mjs`, then full corpus validation and build.
   Reject mismatches; a new parser/dataset is a separate evidence migration,
   requiring reviewed-locator/fingerprint checks, not a restoration.

For a scratch reconstruction, copy `acquisition/`, `manifest/`, `schemas/` and
the exact `raw/` archives to a **new empty directory**, leaving `normalized/`
absent. Compile this package with `npm run build`, then execute from `knowledge/`
(replace `<scratch-root>` with that directory):

```text
node dist/cli.js normalize --root <scratch-root> --artifact-id siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
node dist/cli.js normalize --root <scratch-root> --artifact-id siyavula-mathematics-g10-en-unbranded-pilot --document-prefix OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html
node dist/cli.js normalize --root <scratch-root> --artifact-id open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 --document-prefix OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/
node scripts/verify-evidence.mjs --root <scratch-root>
```

Expected JSON counts: physics 959 (EPUB parser 2.1.0), mathematics 16 (EPUB
parser 2.1.0), logic 9 (LaTeX parser 2.2.0): **984 total**, plus an optional
`.gitkeep` placeholder (985 local files in the original normalized directory).
Unscoped normalization would include other mathematics/logic content and change
the numbered locators; it is not the baseline restoration procedure.

## Ohm's Law editorial chain

Preserve these tracked files byte-for-byte:

- `concepts/physics/electricity/ohms-law.md`: concept
  `physics.electricity.electric-circuits.ohms-law`, schema `1.0`, version `0.2.0`,
  status `reviewed`; Steve's physics/language review dated `2026-10-01`.
- `curation/inputs/physics.electricity.electric-circuits.ohms-law.json` and
  `verified-assets/registry.json`: authored input and asset identities.
- `reviews/records/` and `reviews/corrections/`: source locators, verified human
  transcriptions and correction history.
- `reviews/document-history/physics.electricity.electric-circuits.ohms-law/20261001T104541Z/`:
  previous version, approved draft and promotion record including their hashes.
- Source/permission/acquisition manifests, schemas and pipeline source.

The promoted Markdown SHA-256 is
`5a31af726815c9a1c154a19d615f7405a776f7fd567a4665c3bdec13618ee0eb`,
also recorded in the promotion audit. `.gitattributes` disables line-ending
conversion for this package so Git add/checkout preserves these byte hashes.
Editor formatting can still invalidate them; do not reformat reviewed evidence.

`build/concepts/physics/electricity/ohms-law.json` is generated, **not tracked**.
Full validation needs the restored source evidence; its passing reviewed output
can then be reproduced by the existing build, without manually editing JSON.

## Verification commands and evidence requirements

Run from `knowledge/` with Node 24:

```text
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
npm test
node scripts/verify-evidence.mjs
npm run knowledge:validate
npm run knowledge:build
```

Typecheck, compilation and the existing isolated-fixture tests do not require the
bulk local archives. `verify-evidence`, full corpus validation, production knowledge
build and real-source pilot audits **do** require the raw/normalized evidence.
Review and curation tools also require it; these tools must not be run merely to
restore the baseline or fabricate new approval.

If npm is blocked by local trust policy while dependencies are already installed,
do not bypass npm's trust check or change dependencies. The equivalent installed
tools can be invoked directly:

```text
node node_modules/typescript/bin/tsc -p tsconfig.json
node --test --test-isolation=none test/*.test.mjs
node dist/cli.js validate
node dist/cli.js build
```

These compilation/build commands write only ignored outputs. Keep the lockfile
unchanged. Do not call `npm audit fix` as part of preservation.

## Outstanding preservation work

Select a permitted durable artifact store and back up the **verified exact raw
bytes and normalized snapshot** before deleting/moving any local evidence.
Document retention, access, license handling and retrieval instructions when the
provider is actually selected. Until then, fresh developers must obtain evidence
from the retained local baseline or reproduce matching bytes as above; a Git-only
checkout cannot run the complete corpus validation/build gate.
