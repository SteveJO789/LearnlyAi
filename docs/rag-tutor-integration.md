# P2: retrieval into structured tutoring

```text
HTTP learning request
        ↓
Learning Engine → KnowledgeRetriever port → reviewed reference
        ↓
bounded SourceMaterial + versioned citation identity
        ↓
Tutor Orchestrator → ModelProvider (Mock / OpenRouter)
        ↓
canonical output validation + current-reference citation validation
        ↓
existing Learning HTTP response
```

The engine retrieves using the current student input and effective/persisted
subject. Session-associated materials still use SourceMaterialRepository; that
repository is not repurposed as retrieval. Each reference maps to one SourceMaterial:

- `content`: the bounded teaching passage.
- `citation`: exact passage ID, title and `TRUSTED_KNOWLEDGE_BASE` type.
- `knowledge`: concept/version/schema/passage identity, reference language and
  bounded source attribution metadata, separately from teaching prose.

No public Tutor Output schema fields change. Citation IDs include the concept
version and projection identity (for this pilot, `@0.2.0:teaching-v1`). There is no
invented public URL for the curated document; upstream attribution URLs remain
in the internal reference metadata.

## Composition and artifacts

`createLearningEngine` composes LocalKnowledgeRetriever by default. Alternate
implementations are injected via `knowledgeRetriever`; engine business logic
imports only its port. The Knowledge root resolves in this order:

1. `CreateLearningEngineOptions.knowledgeRoot`.
2. `KNOWLEDGE_ROOT` environment configuration.
3. The API `runtime-knowledge/` directory relative to the module, equally for
   source and compiled API layouts; independent of process working directory.

API builds now prepare the pinned reviewed pilot from tracked authoring source,
its promotion hash, local schemas and referenced source registry. Standalone API
packages ship the generated `runtime-knowledge/` alongside `dist/`; Vercel includes
it explicitly. See [P2.5 runtime delivery](runtime-knowledge-deployment.md).
Runtime preparation needs no raw/normalized evidence or `knowledge/build/`.
Full authoring evidence validation remains governed by [P0](../knowledge/ARTIFACTS.md).

## Bounds and failure policy

The application accepts at most three retrieved references, each at most 4000
characters of teaching content, with bounded identity/source metadata. Over-budget,
duplicate passage IDs and collisions with session-material citation IDs fail
before model execution. Alternate retrievers must satisfy the same budget.

No-match is a normal empty reference list. References are retrieved afresh each
turn; earlier output citations are not a current source allowlist. A short follow-up
such as "why?" can miss lexical retrieval: conversation-aware query resolution is
not added here. A miss does not prove the model's resulting general answer is grounded.

Artifact/retriever/mapping failures produce `KNOWLEDGE_UNAVAILABLE` / HTTP 503,
without exposing local paths, calling the model, changing session state or saving
messages. An active session can retry after evidence is restored. Invalid model
output/citations retain the existing AI failure/session behavior; this task does
not change that policy or wire Prisma/authentication.

## Prompt and citation boundary

Reference text/metadata are JSON task data in the user-role task message. They are
never interpolated into the system message or converted into conversation roles.
The system prompt explicitly forbids following embedded reference instructions.
This isolation and policy are tested offline; they are not proof that every live
model resists prompt injection.

After canonical schema validation, the orchestrator requires:

- Exact citation metadata from the current source allowlist.
- Every emitted citation linked from a block's `citationIds`.
- At least one block-linked Knowledge citation when retrieved Knowledge is supplied.

Unknown passage IDs, old versions, invented URLs/pages, altered titles/source types,
omitted Knowledge citations and unlinked citations fail as `AI_INVALID_OUTPUT`.
These checks establish reference identity/linkage, **not semantic entailment** of
every tutor statement. Model factuality, live prompt-injection behavior and adaptive
teaching remain separate evaluation work.

The learning-specific mock demonstrates referenced explanation/review and linked
stage-specific questions. It uses supplied passage data and exact citation identity;
the generic Mock/OpenRouter provider implementations remain unchanged.

## Validation

Use Node 24 and existing API/Knowledge checks. Integration tests use shared,
explicitly synthetic temporary fixtures, independent of ignored local evidence.
They cover engine query propagation, scoped materials, bounded prompt data, misses,
citation tampering, failure/recovery, both HTTP aliases and an injected offline
OpenRouter transport. Real-artifact checks run separately against the validated
Ohm's Law release prepared by the API build in `runtime-knowledge.test.mjs`.
No live model call is required by the regression suite.
