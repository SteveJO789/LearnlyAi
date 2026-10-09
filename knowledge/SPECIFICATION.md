# LearnlyAI Knowledge Base Specification v1.0

## 1. Objective

Create a small, reviewable, traceable RAG corpus for Thai upper-secondary tutoring rather than a large scraped textbook corpus.

## 2. Canonical artifact

Markdown is the human-authoring format. A build step may transform Markdown frontmatter + body into canonical JSON for validation, chunking, and indexing.

Do not maintain unrelated Markdown and JSON copies manually.

## 3. Content ownership model

The production corpus should consist of LearnlyAI-authored or LearnlyAI-curated Thai knowledge documents.

Upstream sources have distinct roles:

- `content_source`: openly reusable source used to support curation
- `curriculum_alignment_only`: source used for scope/terminology/sequence, not copied into production prose
- `reference_only`: human cross-check source, excluded from automatic ingestion
- `verification`: source used to confirm formulas/facts

## 4. Review lifecycle

```text
draft -> in_review -> reviewed -> deprecated
```

Only `reviewed` is production-retrievable.

## 5. Required metadata

Every knowledge document must include:

- stable ID
- subject/domain/topic/subtopic
- grade range
- curriculum track + curriculum role
- prerequisites
- learning objectives
- source references
- review status
- retrieval summary
- version

## 6. MVP curriculum decisions

### Linear equations
Treat as prerequisite/remediation support across M.4–M.6, not as a falsely claimed standalone M.4 curriculum chapter.

### Mathematical logic
Treat as an M.4 target. Align terminology and scope to IPST; use Open Logic Project only as a permissive formal-content source.

### Electricity
Treat as M.5 additional-physics target. IPST determines sequence and Thai terminology; Siyavula provides reusable content support.

## 7. Embedding boundary

`raw/` and `normalized/` are never directly embedded.

Only approved, reviewed curated documents may become chunks.

## 8. Provenance

Every chunk must inherit:
- `document_id`
- `source_ids`
- `curriculum_refs`
- `license_family`
- `rag_permission_status`
- `review_status`
- `version`

## 9. CI blocking rules

Fail the knowledge build if:
- a source ID is missing
- a content source is not `allowed`
- review status is not `reviewed` for production build
- schema validation fails
- required formula units/variables are missing
- a worked example has no checked answer
- a source marked `do_not_ingest` appears in production provenance

## 10. Retrieval evaluation

Before RAG is considered complete, prepare 50–100 checked queries across:
- definition lookup
- formula lookup
- prerequisite question
- conceptual why/how
- numerical example
- misconception
- Thai synonym
- English synonym
- multi-concept question
- out-of-corpus question

Evaluate retrieval separately from LLM answer quality using expected canonical concept IDs.

## 11. Source acquisition and normalization

Phase 2 supports automated acquisition only for explicitly allowed Siyavula unbranded
CC BY EPUB artifacts and Open Logic Project LaTeX source. `reference_only`, `unclear`,
`do_not_ingest`, unknown, and unsupported sources are blocked before raw bytes are
written.

Raw artifacts are immutable and identified by SHA-256 in
`acquisition/manifest.json`. Normalization is deterministic and format-specific:

- EPUB: package spine, semantic heading hierarchy, paragraphs, lists, practical tables,
  mathematical notation, and document locator
- Open Logic: chapter/section hierarchy, definition environments, symbolic expressions,
  and LaTeX

Every normalized unit must resolve to one acquisition artifact and carry matching
checksum, source URL, raw path, permission status, and parser-version provenance.
Normalized material is never production-retrievable and may only inform curated
documents that begin at `status: draft`.
