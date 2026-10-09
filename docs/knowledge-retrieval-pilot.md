# P1: deterministic reviewed Knowledge retrieval

The standalone P1 boundary is now composed into tutoring by
[the P2 integration](rag-tutor-integration.md); its retrieval contract remains unchanged.

```text
KnowledgeRetriever (provider-neutral application port)
       ↓
LocalKnowledgeRetriever (Ohm's Law matching + query filters)
       ↓
LocalReviewedKnowledgeReader (local schema/review/source checks + teaching projection)
       ↓
services/api/runtime-knowledge/build/concepts/physics/electricity/ohms-law.json
```

`SourceMaterialRepository.findBySessionId` remains separate: it accesses material
already associated with a session. `KnowledgeRetriever.retrieve` decides which
trusted reference is relevant to a new query. Neither the Learning Engine nor
Tutor Orchestrator is wired to retrieval in P1.

## Standalone use

Run the tracked-source preparation command described in
[P2.5 runtime delivery](runtime-knowledge-deployment.md), then provide the generated
`services/api/runtime-knowledge/` root to the local reader. The full authoring build
can still publish an explicit root under [P0](../knowledge/ARTIFACTS.md).
Paths stay inside the adapter; results contain no local
paths or review records:

```ts
const retriever: KnowledgeRetriever = new LocalKnowledgeRetriever(
  new LocalReviewedKnowledgeReader(knowledgeRoot),
);
const references = await retriever.retrieve({
  studentInput: "Explain Ohm's law",
  subject: "physics",
  language: "th",
});
```

Only concept `physics.electricity.electric-circuits.ohms-law`, version `0.2.0`,
schema `1.0`, subject `physics`, content language `th` is eligible in this pilot.
Other identities/versions need an explicit later pilot update. No corpus scan,
network, LLM, embeddings or random ranking occurs. There is at most one result.

## Matching and filters

- Normalize the query with Unicode NFKC and lowercase.
- Match English whole-word `ohm`/`ohms`/`ohm's` (straight or curly apostrophe),
  or Thai `กฎของโอห์ม`.
- Match whitespace-insensitive `V=IR`, `V=RI`, `I=V/R`, `R=V/I`, with optional
  multiplication `*`, `×` or `·` between I and R. Letter boundaries prevent matching
  these equations inside unrelated words.
- Match voltage/Thai potential-difference terms, current together with resistance,
  or current/resistance alongside electrical, circuit or ampere context. A small
  set of Thai terms maps directly to the reviewed concept's teaching vocabulary.
- An explicit subject must be `physics` (case/outer whitespace normalized).
  An explicit language must be Thai (`th` or a `th-*` language tag). This is a
  **reference-content filter**, not an instruction to translate. English input
  without a language filter intentionally retrieves the existing Thai passage.
- Empty/unrelated queries return `[]`; there is no first-document fallback.
  Invalid/non-string or greater-than-8000-character input rejects before reading.

This is lexical topic matching, not general semantic search. It can misclassify
mixed-topic questions and does not calculate an answer to the student's numbers.
For example, `I=2 A, R=20 Ω` retrieves the reviewed relationship and its existing
worked example, not a newly generated `40 V` answer for that input.

## Publication and trust boundary

The reader only opens the fixed published build path; it never reads `concepts/`,
`curation/drafts/`, other JSON files or raw/normalized source books as runtime
references. A draft copied to the published path remains ineligible. Reviewed
status plus document-level math/physics and language checks, reviewer identity and
review date are mandatory. Revoked status is reread on every matching request.

The reader validates against the checked-in canonical Knowledge schema and the
source registry, resolving schema references locally. Unknown/blocked sources
are rejected; content sources must be allowed or internally authored. Missing,
malformed, schema-invalid, oversize or inconsistent publication artifacts reject
instead of pretending there was a normal no-match. P2 must map such failures to
an appropriate application policy without leaking filesystem error details.

This is a defensive read gate, not a substitute for full acquisition/curation
validation: runtime preparation pins the tracked approved promotion from the
validated evidence chain; full authoring evidence gates remain unchanged. Schema
validation alone does not authenticate a manually tampered artifact or re-check
raw archive and human transcription fingerprints. The configured local artifact
and schema directories are trusted deployment inputs, not user-selected paths.

## Bounded data and identity

The single passage selects complete formal definition, formula, variables/units,
conditions, problem, solution and checked-answer sections, in that fixed order.
The known standalone problem cross-reference to "Detailed Provenance" is omitted;
its numerical teaching prose is unchanged. Detailed provenance/review sections,
curation envelopes, source archive locators, checksums and promotion records are
never copied into retrieved content.

Content is at most 4000 JavaScript string characters. Over-limit/incomplete
passages fail as a whole; formula/units/example are never truncated. Artifact reads
are capped at 128 KiB; at most four deduplicated content sources are returned,
ordered by source ID. Titles, source IDs, URLs and license metadata also have
explicit limits. Returned records/arrays and source metadata are frozen.
Source URLs must be public HTTP(S) URLs without embedded credentials; local
filesystem URLs never enter the result.

`conceptId`, `conceptVersion`, `schemaVersion` and deterministic `passageId`
identify the reference independently of its text. The ID suffix `teaching-v1`
identifies this projection; change it if the projection's meaning changes. Source
metadata retains public registry identity, title, URL and license, with
`sourceType: TRUSTED_KNOWLEDGE_BASE`. It is not a fabricated Tutor Output citation
or a claim that the LLM's answer is entailed by this reference.

Retrieved text is reference **data**, never executable code or an instruction
channel. The reader does not evaluate, execute or follow embedded instructions.
It is not a prompt-injection sanitizer: P2 must delimit reference content as data
and test orchestration resistance to injected instructions.

## Tests and next boundary

API tests use explicitly synthetic schema-valid documents in temporary directories
with checked-in Knowledge schemas/source registry. They do not need ignored bulk
evidence or build output in CI. The prepared runtime release is also checked by
`runtime-knowledge.test.mjs`, including a fresh source export and relocated API
package. Use Node 24 and the existing API/Knowledge checks.

P2 owns Learning Engine dependency injection, retrieved-reference to TutorContext
mapping, prompt integration, application error policy and grounded citations.
A later PgVectorKnowledgeRetriever can implement the same application port;
Learning Engine business logic should depend only on that port.
