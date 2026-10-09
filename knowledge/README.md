# LearnlyAI Knowledge Base Specification v1

This package defines the MVP knowledge-engineering contract for LearnlyAI RAG.

## Version-controlled baseline and evidence restoration

See [ARTIFACTS.md](ARTIFACTS.md) for the Git tracking policy, exact evidence
inventory, license boundaries, restoration steps, and validation requirements.
Raw archives and bulk normalized records are deliberately excluded from Git;
they must be restored before corpus validation or production knowledge builds.
Artifact storage provider: **NOT YET SELECTED**.

Use Node 24 (repository `.nvmrc`). Review/promotion hashes cover exact bytes;
the package `.gitattributes` prevents Git line-ending conversion. Do not format
or normalize reviewed evidence as an incidental setup step.

## Core decisions

1. **Do not embed raw textbooks or raw PDFs.**
2. Thai curriculum authority (OBEC/IPST) defines scope, terminology, grade/track, and validation.
3. Production RAG text comes from reviewed LearnlyAI-authored/curated documents.
4. Primary reusable MVP sources:
   - Siyavula Mathematics G10–12 unbranded CC BY EPUB
   - Siyavula Physical Sciences G10–12 unbranded CC BY EPUB
   - Open Logic Project for selected logic concepts
5. Reference-only material must never enter the embedding pipeline automatically.
6. Every production document must carry provenance, curriculum mapping, review state, and version.

## MVP scope

- Mathematics / Linear Equations — prerequisite/remediation strand
- Mathematics / Mathematical Logic — M.4 target
- Physics / Electricity — M.5 target

## Repository flow

```text
approved source
   ↓
acquisition + license record
   ↓
normalized source
   ↓
curriculum mapping
   ↓
AI-assisted curated draft
   ↓
human review
   ↓
reviewed Markdown / canonical JSON
   ↓
semantic chunking
   ↓
embedding + hybrid retrieval
```

## Production gate

A document may be embedded only when all of the following are true:

- `status == reviewed`
- every `source_ref` is present in `sources.json`
- content sources have `rag_permission_status == allowed` or `internally_authored`
- curriculum/reference-only sources are not copied as production prose
- schema validation passes
- formulas and worked examples have been checked
- Thai language review has passed

## Chunking rules

Never split:
- equation from variable meanings/units/conditions
- worked problem from its solution
- truth table from its proposition
- misconception from its correction
- numerical answer from its unit
- circuit/graph/table from identifying context

Use hybrid retrieval:
- metadata filters
- dense semantic similarity
- keyword/lexical retrieval
- optional reranker

## Recommended MVP size

Target approximately:
- 45–55 concepts
- 60–80 curated documents
- ~300 semantic chunks

## Files

- `manifest/sources.json` — approved/reference/blocked source registry
- `manifest/curriculum-map.json` — MVP taxonomy and curriculum role
- `schemas/source.schema.json` — source record contract
- `schemas/knowledge.schema.json` — curated knowledge contract
- `schemas/acquisition-manifest.schema.json` — immutable raw-artifact provenance contract
- `schemas/normalized-unit.schema.json` — normalized source-unit contract
- `concepts/...` — example curated Markdown documents
- `acquisition/manifest.json` — acquired-artifact ledger and checksums
- `raw/<source-id>/<artifact-id>/...` — immutable acquired bytes
- `normalized/<source-id>/<artifact-id>/*.json` — reproducible normalized source units

## Phase 2 source processing

Phase 2 is a controlled preprocessing boundary. It supports only:

- Siyavula Mathematics Grades 10–12 unbranded CC BY EPUB
- Siyavula Physical Sciences Grades 10–12 unbranded CC BY EPUB
- Open Logic Project `.tex` files or ZIP archives containing LaTeX source

```text
approved source registry entry
            ↓
acquire and checksum original bytes
            ↓
immutable raw/<source-id>/<artifact-id>/<filename>
            ↓
format-specific deterministic normalizer
            ↓
normalized/<source-id>/<artifact-id>/*.json
            ↓
human or separately controlled curation into status=draft Markdown
```

There is deliberately no automatic path from normalized records to reviewed knowledge.
The acquisition and normalization commands do not write to `concepts/`, create
embeddings, call an AI model, or approve content.

### Acquire an artifact

Download directly from the publisher's artifact URL:

```bash
npm run knowledge:acquire -- \
  --source-id siyavula-physical-sciences-g10-g12-ccby \
  --url https://publisher.example/path/physical-sciences-unbranded.epub \
  --artifact-id siyavula-physical-sciences-g10-12-2026
```

Register a file that was downloaded separately:

```bash
npm run knowledge:acquire -- \
  --source-id open-logic-project \
  --file /absolute/path/to/open-logic-source.zip \
  --source-url https://publisher.example/path/open-logic-source.zip \
  --artifact-id open-logic-source-2026
```

`--artifact-id` is optional. When omitted, it is deterministically derived from the
source ID and checksum. `--filename` may be supplied when a download URL does not end
in the original filename.

Acquisition is rejected before writing when the source is unknown, outside the Phase 2
allowlist, `reference_only`, `unclear`, or `do_not_ingest`. Successful acquisition:

- copies the exact bytes without transformation
- calculates SHA-256
- makes the raw file read-only
- records its original filename, source URL, acquisition time, license state, parser
  version, checksum, and raw path in `acquisition/manifest.json`
- rejects duplicate checksums and duplicate artifact IDs

Never edit or replace a file under `raw/`. Validation recomputes every checksum and
also rejects raw files not tracked by the acquisition manifest. If a publisher releases
a new artifact, acquire it under a new artifact ID.

### Normalize acquired sources

```bash
npm run knowledge:normalize
```

Unscoped normalization stages output from every acquired artifact before replacing `normalized/`. EPUB
normalization follows the package spine and retains chapter/section hierarchy,
paragraphs, lists, practical Markdown tables, MathML or embedded TeX, and the EPUB
document path. It does not use OCR. Open Logic normalization retains chapter and
section locators, definition environments, symbolic expressions, and raw LaTeX.

Every normalized record links back to its acquisition entry through `source_id` and
`artifact_id`, and repeats the checksum, raw path, source URL, permission state, and
parser version in its `provenance` object. `npm run knowledge:validate` verifies those
values against the manifest.

Normalized output is source material, not production tutoring content. Any curated
Markdown derived from it must begin with `status: draft` and follow the normal review
workflow.

### Real-artifact pilot (2026-10-01)

The first acquired artifact is the English Grade 11 Physical Sciences unbranded EPUB.
The catalogue labels its download CC-BY; its internal copyright page specifies **CC BY
4.0**, which is recorded in the source registry. Other editions must be checked
individually. See [the acquisition and quality report](acquisition/pilot-physical-sciences-g11.md).

This EPUB stores equations as PNG images without recoverable TeX. Parser 2.1 preserves
each image in `assets` with its original `archive_path`, and emits Markdown references
such as `![Equation image: manual review required](epub:OPS/.../equation/image.png)`.
`epub:` identifies an entry inside the record's acquired raw archive; it is not an
ordinary filesystem or web URL. No images are transformed, and no OCR is used.

`normalization_warnings` identifies image equations, diagrams, and merged-cell tables
requiring review. Image equations are not fabricated into `math` strings. Tables with
merged cells retain their original HTML, whose relative image paths resolve from
`locator.document`. Validation checks that all asset entries exist in the immutable
archive and that the appropriate image-review warnings are present.

The acquisition manifest's `parser_version` is the processing version at acquisition;
normalized provenance records the actual format-specific normalization version (EPUB
2.1.0; Open Logic LaTeX 2.2.0). Updating LaTeX does not invalidate reviewed EPUB evidence.
Treat re-normalization of existing evidence as an explicit migration, not an incidental
pilot step: reviewed locators and draft evidence hashes depend on the normalized bytes.

Run the read-only pilot audit after normalization:

```bash
node scripts/audit-epub-pilot.mjs siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
```

The pilot passes source-storage checks, but image equations still need human inspection
and verified transcription before mathematical curation. Review warning flags are not
review approval. Acquisition and normalization should run through one coordinator;
there is currently no process lock protecting concurrent writers.

## Local human review UI

Start the reviewer tool from `knowledge/`:

```bash
npm run knowledge:review
```

Open **http://127.0.0.1:4317** in a browser. Use `-- --port 4318` if that port is
occupied; Ctrl+C stops the server. This is a standalone TypeScript/Node local tool,
separate from `apps/web` and the student-facing frontend. It binds only to loopback.

1. Leave the default `ohms-law` filter or select another electricity concept.
2. Click a candidate unit to see the original English evidence, tables, equations,
   diagrams and source location. Assets are resolved directly inside the immutable EPUB.
3. Use candidate checkboxes to choose the review batch. The default batch includes
   the main Ohm definition and complete first worked example; progress counts this
   selected batch, never the entire textbook.
4. Enter your reviewer name. For equations, manually enter LaTeX and plain text;
   for diagrams, enter a description. Verify requires the corresponding fields.
   Needs correction and Skip are non-verified decisions and may leave fields empty.
5. Turn on curated preview to see source evidence → verified equations → a proposed
   LearnlyAI Thai explanation. Preview does not generate, approve or publish a document.

All assets start unreviewed. Reopening the tool shows previously saved human actions.
No OCR, image inference, external model or remote rendering service is used. LaTeX is
shown as plain text to avoid adding a rendering dependency to this local tool.

Only `reviews/records/<review-id>.json` is written by review actions. Each record stores
source/artifact IDs, checksum, normalized unit, chapter, section, source document, asset
locator, transcription, status, the name entered by the human, and an action timestamp.
Records are schema-checked, and their identities/locators are resolved from the selected
source rather than accepted from browser input. Changing Verify to Needs correction
or Skip revokes that asset's effective verification. Raw and normalized files are never
edited. Keep `reviews/` when moving or restarting the workspace.

The server restricts source HTML to safe text, tables and local image endpoints, and
requires a per-session token for writes. It has no login/multi-user access control and
is intended for one local reviewer at a time. Do not expose it as a production service.

## Controlled Ohm's Law curation pilot

`verified-assets/registry.json` selects 11 assets for the real artifact; every initial
entry is **pending**, with no invented transcription, reviewer or verification date.
The effective registry combines this inventory with explicit human records from
`reviews/`. Directly supplied verified entries must also carry human transcription,
LaTeX for equations, reviewer, date, method and complete source provenance.

`curation/inputs/physics.electricity.electric-circuits.ohms-law.json` selects the definition,
formula, diagram and all first-example units. Its Thai explanation is LearnlyAI-authored;
source English prose is context/evidence and is not copied into student-facing sections.
The example's numerical checked answer intentionally remains null until a human supplies
it after inspecting the verified solution. A developer records that checked value in
the input's `worked_example.answer.value`; the required voltage unit is `V`.

After the selected assets and checked answer are supplied:

```bash
npm run knowledge:curate -- --concept-id physics.electricity.electric-circuits.ohms-law
```

The command fails without writing a draft if an equation/diagram is unverified, a source
locator is missing, an example asset was omitted, or the checked answer lacks its required
unit and matching verified transcription. It does not estimate answers from image files.

Successful output goes exclusively to `curation/drafts/physics/electricity/ohms-law.md`,
with all requested teaching sections, source locators and fingerprints of human asset
verifications. It starts `status: draft` with document review flags false and no reviewer.
Existing draft files are never overwritten. The curate command never overwrites reviewed
documents in `concepts/`. Validation also checks generated drafts; production build excludes
everything under `curation/drafts/`, including files manually relabelled reviewed.

Asset verification is separate from document approval. Explicit human subject/language
review and promotion to `concepts/` remain necessary. Revoked or changed asset verification,
edited unverified solution equations, and unitless checked answers fail validation/build.
Tests demonstrate the successful end-to-end draft flow using isolated, explicitly labelled
fixtures; no actual source image was automatically transcribed or approved.

### Human-approved pilot promotion (2026-10-01)

The Ohm's Law pilot is now version `0.2.0` in `concepts/physics/electricity/ohms-law.md`,
with explicit document-level physics/language review supplied by Steve on `2026-10-01`.
The human-approved promotion preserves all curation source locators and asset fingerprints;
its worked example uses `R = 10 Ω`, `I = 4 A` and a checked answer of `40 V`.

The previous `0.1.0` document, the approved draft as received, and the promotion audit are
preserved in `reviews/document-history/physics.electricity.electric-circuits.ohms-law/20261001T104541Z/`.
The active draft was moved into that archive to avoid retaining a duplicate authoring copy.
Draft-only review notes are retained in the archive, not in the production teaching sections.
The transcription correction history remains under `reviews/corrections/` and is linked
from the promoted document. Raw and normalized source material were not changed.

Run `npm run knowledge:validate` and `npm run knowledge:build` after a human-approved
promotion. Generated canonical JSON is local build output, not an application deployment.
Parser/schema tests use a fixed Ohm fixture in `test/fixtures/` rather than depending on
the current editorial version; curation tests cover promotion with explicit human metadata.

The next two artifact pilot records are in `acquisition/next-pilot-artifacts.json`: Mathematics
Grade 10 English CC-BY EPUB and Open Logic pinned to commit
`1e960beff9ed7835bf3e3f1335e21af3439cd107`. Both are now acquired, normalized within the
scopes below, and have unreviewed curated pilot drafts. Artifact-specific license evidence
is in `acquisition/source-pilot-licenses.json`. No other grades are queued.

## Mathematics and logic source pilots (2026-10-01)

See [the pilot report](acquisition/pilots/README.md) for artifact IDs, checksums, mappings,
format defects, and scaling decisions. Machine-readable audits in `acquisition/pilots/`
include every scoped normalized unit and exact asset locator.

| Pilot | Scoped normalized output | Authored draft |
|---|---|---|
| Siyavula Mathematics Grade 10 | 16 units from 4.2 Solving linear equations | `curation/drafts/mathematics/linear-equations/balance-preserving-operations.md` |
| Pinned Open Logic source | 9 units from propositional logic / Syntax and Semantics | `curation/drafts/mathematics/logic/negation.md` |

Acquisition uses the existing `knowledge:acquire` command and records byte-for-byte raw
files, SHA-256, URL, filename, acquisition time, and source permission. These artifacts are
already acquired; acquiring them again intentionally fails as a duplicate. Each newly
approved pilot can be normalized separately without rewriting Grade 11 evidence:

```bash
npm run knowledge:normalize -- \
  --artifact-id siyavula-mathematics-g10-en-unbranded-pilot \
  --document-prefix OPS/xhtml/maths10/04-equations-and-inequalities-01.cnxmlplus.html

npm run knowledge:normalize -- \
  --artifact-id open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107 \
  --document-prefix OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/
```

These commands document the acquisition-time normalization scope. Because these pilots
are already normalized, rerunning scoped normalization refuses to overwrite their
evidence. `--document-prefix` requires `--artifact-id`; an empty scope fails. Unscoped
`knowledge:normalize` remains a full rebuild and is **not** the command to extend pilots.

Re-run read-only audits whenever needed (omit `--write` to avoid replacing reports):

```bash
npm run build
node scripts/audit-source-pilots.mjs siyavula-mathematics-g10-en-unbranded-pilot
node scripts/audit-source-pilots.mjs open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107
```

Draft generation is deterministic template rendering, not an AI API or automatic
curation/review service:

```bash
npm run knowledge:pilot -- --pilot mathematics-g10
npm run knowledge:pilot -- --pilot open-logic
npm run knowledge:validate
npm test
```

The drafts already exist: regeneration intentionally fails instead of overwriting human
edits. No reviewer/date is fabricated. A separate `source_pilot` envelope in
`schemas/source-pilot.schema.json` records literal evidence excerpts, normalized-file
hashes, artifact hashes, exact document/chapter/section locators, and explicit authorship.
Validation rejects altered/missing evidence, images in text-only drafts, missing source
references, unsupported grade inference, and source wording in student-facing sections.
Source-pilot documents are draft-only even if someone changes their top-level status.
They require a later explicit human curation/promotion workflow; this envelope is not a
replacement for the verified-asset registry or the existing Ohm's Law curation gate.

For Mathematics, the English prose method is usable without reading any image. All 104
equation-image occurrences (101 distinct paths) remain untranscribed. The worked example
and displayed symbolic rule are independently LearnlyAI-authored, not guesses about
those images. The draft uses `grade_range: [prerequisite]`; South African Grade 10 does
not establish a Thai grade. Existing sample drafts are not replaced.

For Logic, source formulas remain literal LaTeX. `\\olchapter`, `\\olsection`, ordinary
headings, and parent chapter names are recognized, while UTF-16 source offsets and exact
text slices preserve provenance. `\\iftag` branches, `!!` tokens, definitions, propositions,
tables, and symbolic macros are retained rather than executed, expanded, compiled, or
rendered. `latex_macros_requires_review` marks that limitation. IPST Project 14's M.4
introductory logic topic is separate alignment-only evidence, not a claim that every
Open Logic chapter or candidate meets Thai indicators.

Both sources are conditionally suitable for scaling: Mathematics needs a manageable
human equation-verification queue; Logic needs macro-aware reviewer context and careful
simplification of university material. The existing Human Review UI still supports only
the Physical Sciences Grade 11 artifact. This turn does not expand that UI, approve new
knowledge, alter the reviewed Ohm's Law document/build, or implement embeddings/retrieval.

## Validation and build commands

Run the commands from this `knowledge/` directory with Node.js 24:

```bash
npm install
npm run knowledge:acquire -- --source-id <id> --url <artifact-url>
npm run knowledge:normalize
npm run knowledge:validate
npm test
npm run knowledge:build
```

`knowledge:validate` performs the following checks:

- validates every record in `manifest/sources.json` against `schemas/source.schema.json`
- parses YAML frontmatter and Markdown sections from `concepts/**/*.md` and `curation/drafts/**/*.md`
- normalizes each document and validates it against `schemas/knowledge.schema.json`
- resolves every `source_id` against the source manifest
- blocks `do_not_ingest` provenance in reviewed documents
- permits `content_source` in reviewed documents only for `allowed` or `internally_authored` sources
- requires completed subject/language review metadata for reviewed documents
- checks formula IDs against structured formulas and requires formula variables, units, and conditions
- requires every worked example to contain a problem, solution, and checked answer
- validates the acquisition manifest and its source permissions
- recomputes every raw artifact checksum and detects untracked raw files
- validates normalized record shape and exact acquisition provenance
- validates source-pilot evidence hashes/locators and enforces draft-only publication

`knowledge:build` applies the same validation gate and writes reviewed documents to
`build/concepts/**`, mirroring their authoring paths. Draft, in-review, and deprecated
documents are valid authoring artifacts but are excluded from production output. The
command replaces `build/` only after the full corpus passes validation, so failed builds
do not publish partial output.

The curated knowledge build never reads `raw/` or `normalized/` as content and creates
no embeddings. It only validates their integrity as part of the repository-wide gate.

## Markdown authoring contract

Frontmatter is the source for metadata. The normalizer maps `title_th` and `title_en` to
the canonical `title` object and maps the `# Retrieval Summary` section to
`retrieval_summary`. All Markdown headings and their direct content are retained in the
canonical `sections` array.

A document with `formula_ids` must provide these sections:

```markdown
# Formula

\[
V = IR
\]

# Variables and Units

| Symbol | Meaning | SI unit |
|---|---|---|
| V | potential difference | volt (V) |

# Conditions and Limitations

State when the relationship is valid.
```

Each `# Worked Example` uses explicit subsections so the checked result cannot be
mistaken for an unchecked calculation:

```markdown
# Worked Example

## Problem

The problem statement.

## Solution

The complete solution.

## Checked Answer

The checked numerical or symbolic answer, including units where applicable.
```

Review metadata remains explicit; the build does not infer human approval:

```yaml
review:
  content_status: reviewed
  math_physics_reviewed: true
  language_reviewed: true
  reviewer: reviewer-id
  reviewed_at: 2026-09-29
```

## Implementation structure

- `src/markdown-frontmatter.ts` parses YAML frontmatter and ordered Markdown sections.
- `src/canonical-document.ts` performs deterministic normalization and extracts formula
  and worked-example objects.
- `src/schema-validation.ts` owns JSON Schema and cross-record validation.
- `src/knowledge-pipeline.ts` discovers curated documents, enforces the production gate,
  and publishes canonical JSON atomically.
- `src/cli.ts` exposes the validation and build commands.
- `src/acquisition.ts` performs permission-gated, checksummed, immutable acquisition.
- `src/epub-normalizer.ts` converts EPUB spine documents into semantic Markdown units.
- `src/open-logic-normalizer.ts` splits LaTeX while preserving definitions and math.
- `src/normalization.ts` atomically publishes provenance-linked normalized JSON.
- `src/source-processing-validation.ts` detects permission, checksum, duplicate, and
  provenance violations.
- `src/source-pilot.ts` renders two fixed authored draft templates and validates their
  text-only source evidence, without human approval or image transcription.
- `src/pilot-audit.ts` compares scoped image references and exact LaTeX slices against raw
  artifacts and reports candidate concepts and format statistics.

The package follows the repository's ESM, strict TypeScript, AJV, and built-JavaScript
test conventions. Markdown remains the only manually maintained knowledge artifact;
generated JSON is ignored by Git.

## API pilot runtime preparation

`npm run knowledge:prepare-runtime` compiles current source and generates the
minimal approved Ohm's Law 0.2.0 deployment package in
`../services/api/runtime-knowledge/`. It requires only tracked reviewed Markdown,
its pinned promotion record, source registry and schemas; no raw/normalized corpus.
Full authoring validation/build keeps its evidence requirements. See
[the runtime deployment contract](../docs/runtime-knowledge-deployment.md).
