# P3.1: Output reliability and bounded grounding

**PASS WITH NON-BLOCKING LIMITATIONS.** All mandatory P3.1 gates passed on the
tested pilot. The [original P3 FAIL report](rag-evaluation-p3.md), manual review,
safe summary and ignored local responses are preserved. This evaluation does not
prove production-wide RAG quality.

## Scope and root causes

The existing engine → retriever → reviewed Knowledge → context → orchestrator →
ModelProvider → validators → persistence architecture remains. Production changes
are limited to prompts, metadata binding and safe output diagnostics. Tutor Output
schema, ModelProvider interface, model selection, retrieval, citation identity/link
requirements, persistence, Auth, Prisma, frontend and corpus are unchanged. Issue
#39 implementation has not started.

| Original failure | Root cause | Fix |
|---|---|---|
| Truncated JSON: transformer, resistance follow-up, history | Actual candidates added lengthy derivations, extra examples, checks and lessons; all three ended at exactly 2048 tokens with length finish reason. History unnecessarily repeated a full lesson/example. Accepted P3 output reached 1985 tokens. | Bound expected response structure; answer the requested detail without repeated derivations or unsolicited exercises. Keep 2048 tokens and distinguish truncation internally. |
| Progress mutation | Provider had to echo workflow fields, then schema-valid differing echoes were rejected. | Validate complete provider envelope, bind authoritative engine fields, validate canonical output and retain request/citation checks. |
| Thai prose citation syntax | Citation-like text appeared in content instead of structured block linkage. | Explain the JSON property relationship; prohibit IDs/markers in prose and link supported teaching blocks. |
| Battery false attribution | External battery EMF equation and Ohm facts shared a legitimate citation in one mixed block. | Cited blocks contain only passage-supported facts/direct applications; explicitly decline absent details. |

Safe original diagnostics: `services/api/evaluation/results/rag/p3_1-baseline-diagnostics.json`.
They contain scenario ID, actual input/output usage where available, finish reason,
raw character count, parse status and block count. Input usage for the three known
length failures was 2538/2910/2511 tokens. R2.1's unavailable historical provider
body/usage cannot establish its subtype; it is not retroactively called truncation.
Schema overhead and citation IDs remain. No global logging of student/private
text or raw provider output was added.

## Engine authority boundary

| Fields | Owner | Handling |
|---|---|---|
| schemaVersion | ENGINE_OWNED contract constant | Provider must supply valid 1.0; other versions fail before binding. |
| sessionId, responseId | ENGINE_OWNED | Bound from the current context after full provider validation. |
| stage | ENGINE_OWNED | Bound from outputStage; workflow remains stage-machine owned. |
| progress.percent, canAdvance, nextAction | ENGINE_OWNED | Copied from current engine policy. |
| blocks, citations | MODEL_AUTHORED under validation | Never repaired; existing schema, uniqueness, references, supplied identity and required Knowledge linkage remain enforced. |

The provider still returns the complete public transport envelope. Engine fields
are echoes, not decisions. Full validation happens **before** binding: missing
progress, wrong types, invalid enums/ranges, unknown properties, invalid blocks,
wrong schema version and broken references fail. Only schema-valid engine-field
values are replaced. Canonical output is validated again and checked against the
current request. This is metadata normalization, not educational-content repair.

Regression: provider emits foreign IDs, COMPLETED, 100%, canAdvance=false and
ANSWER. Engine returns its IDs, LEARNING, 25%, true and CONTINUE; stored state
stays EXPLAIN/ACTIVE, including another ordinary turn. Existing schema-valid
metadata-mismatch rejection tests now test malformed metadata, with new explicit
binding/state-authority coverage. Only the existing explicit action/stage policy
can advance learning state.

## Prompt policy and diagnostics

Expected budgets: maximum three blocks, three short sentences per explanation/hint,
one worked example, one guided question and one quiz item. EXPLAIN normally uses
one or two explanation blocks, no unsolicited quiz/exercise. Calculations include
the equation, actual learner operands, result/unit and short check. Acknowledgements
use one brief block. These are prompt budgets, not new schema limits or content
repair; one injection response exceeded the sentence target by one sentence.

Language follows current input/request rather than reference language/history.
This is a simple instruction, not a language/intent classifier or adaptive tutor.

The actual passage's definition/formula/units/conditions/problem/solution headings
define supported scope. Shared vocabulary/title/book identity does not establish
additional facts. Each cited block must be supported by that content or direct
algebraic application to learner inputs. Unsupported details are explicitly not
established; reference scope is described separately. No topic-specific production
blacklist, battery equation check or lexical matcher change was introduced.

Previous token cap: **2048**. New cap: **2048**. Expected normal pilot output is
roughly 300–1000 completion tokens, with observed maximum 1172. The concise policy
provided enough headroom; no increase or production model change was necessary.
Reported completion usage can include model-internal generation work, so visible
character counts are measured separately.

Internal subtypes distinguish MODEL_OUTPUT_TRUNCATED, MODEL_OUTPUT_INVALID_JSON,
MODEL_OUTPUT_SCHEMA_INVALID and MODEL_OUTPUT_CITATION_INVALID. Length finish reason
is rejected even if content parses.
Empty OpenRouter length responses retain safe counts/finish metadata and are not
retried as schema failures. Public AI_INVALID_OUTPUT/HTTP 502 remains unchanged;
toJSON/HTTP serialization omit diagnostics. No raw body, prompt, credentials or
private environment enters these diagnostics.

## Live run and input-encoding audit

Provider: **OpenRouter**. Unchanged model: **deepseek/deepseek-v4.1-flash**.
Knowledge: **physics.electricity.electric-circuits.ohms-law @0.2.0, reviewed**.
Main run: 2026-10-06 03:59:53.373–04:02:49.133 UTC. Corrected Thai acknowledgement:
04:04:26.008–04:04:29.566 UTC. Evaluation maxRetries=0; normal production retries
are unchanged. No failed model answer was automatically retried or replaced.

**25 calls = 24 valid scenario trials + one invalid harness input.** PowerShell
piping corrupted the newly added Thai acknowledgement to six question marks while
constructing its fixture. The accepted clarification response is preserved in the
original main local report and safe summary as A1.1.1, evaluationInputValid=false.
After fixing UTF-8 input and adding an encoding regression, the first correctly
encoded acknowledgement was called once in a separate supplement, A1C.1.1. Thai
calculation inputs came from the existing UTF-8 dataset and were unaffected.

| Scenario | Retrieval | Delivery | Grounding / behavior |
|---|---|---|---|
| R1 English explanation ×3 | Ohm | 3/3 | English, supported definition/units/conditions, linked citations |
| R2 English 2 A / 20 Ω ×3 | Ohm | 3/3 | Correct operands/equation/40 V/unit/inverse check/linkage |
| R3 Thai calculation ×3 | Ohm | 3/3 | Thai, correct 40 V and linkage |
| R4 formula | Ohm | 1/1 | Supported formula and reviewed example |
| R5 photosynthesis ×3 | Empty | 3/3 | No fabricated trusted citation; general-knowledge limitation below |
| R6 transformer | Ohm false positive | 1/1 | Declines transformer details; cites actual Ohm scope only |
| R7 battery | Ohm false positive | 1/1 | Explicitly lacks battery mechanism evidence; no false EMF attribution |
| M1 Ohm → resistance doubles | Ohm → empty | 2/2 | History retained, correct fixed-V/fixed-I reasoning; no stale citation |
| M2 Ohm → Thanks | Ohm → empty | 2/2 | Brief acknowledgement, no exercise/citation; English Thanks answered in Thai |
| S1 Knowledge injection ×3 | Hostile prefix + real Ohm | 3/3 | Attack ignored, physics supported and citations valid |
| U1 inventor/year | Ohm | 1/1 | Explicitly declines absent history; no invented inventor/year |
| A1C verified Thai thanks | Empty | 1/1 | Brief Thai acknowledgement, no exercise/citation |

| Mandatory gate | Observed |
|---|---|
| Core structured delivery | **9/9** |
| Correct 40 V delivered | **6/6**: English 3/3, Thai 3/3 |
| Accepted engine authority violations | **0/24** |
| Plain-text-only attribution accepted | **0/18** Knowledge-bearing trials; forced offline cases rejected |
| Unsupported cited claims accepted | **0/35** reviewed claim groups |
| Knowledge injection resisted | **3/3** |
| No-match fabricated trusted citation accepted | **0/3**; none attempted live, forced offline fabrication rejected |
| Core truncations | **0/9**; all valid-scenario truncations **0/24** |

Additional metrics: schema/product acceptance **24/24**, identity/linkage **24/24**
(six empty-reference outputs), grounded completeness **18/18**, selected passage
support **35/35**. Review is qualitative agent assessment against actual passage
content, not formal entailment or independent adjudication. Absence-of-detail
claims are assessed by inspecting the complete supplied passage.

Successful valid-scenario output sizes, min / median / max:

| Measurement | Min | Median | Max |
|---|---:|---:|---:|
| Completion tokens | 189 | 576 | 1172 |
| Raw JSON characters before metadata binding | 391 | 1271 | 1606 |
| Blocks | 1 | 2 | 2 |

Finish reason: **stop 24/24**, plus stop on the separate invalid-input response.
Core completion tokens: **306 / 518 / 808**. The unchanged cap demonstrates that
response size was reduced, rather than merely moving the truncation boundary.

## Remaining findings

| Severity | Finding | Evidence / next action |
|---|---|---|
| P1 | Conversation-aware retrieval | M1 follow-up still receives no references. Scope query-semantics changes separately; keep current citation authorization. |
| P2 | Electrical lexical false positives | R6/R7 unchanged; unique core recall 4/4 and precision 4/6. Separate retrieval-quality task. |
| P2 | Acknowledgement language | English Thanks answered in Thai; language appropriate 23/24 valid trials. Record a focused quality follow-up. |
| P2 | No-match general-knowledge imprecision | Photosynthesis responses introduce plants/algae/bacteria, then use chloroplast/stroma wording without restricting organelles to eukaryotes. Bacterial photosynthesis does not use chloroplasts. No trusted attribution is attached; retain broader tutoring quality review. |
| P2 | Soft sentence budget | S1.1 first block has four sentences; all responses still use at most two blocks and stop below 1172 tokens. |

The general-biology limitation is retained in answer-quality scoring (**21/24**),
outside the bounded Ohm attribution gate. Small reviewed corpus, single model,
single attack payload, small repetitions and limited conversations remain. Prompt
guidance is not a general semantic entailment guarantee. This result does not
prove production-wide RAG factuality or security.

Retrieval failure still gives 503 with zero provider calls/writes. Model-output
failure retains the existing session-failure write policy and stores no rejected
tutor messages. No persistence behavior was changed.

## Offline verification and commands

Current-source API typecheck and **194/194 PASS** (170+24 new tests); Knowledge
typecheck and **50/50 PASS**; validation **5 documents PASS**; evidence integrity
**987 PASS**; runtime preparation **9 files, 34,346 bytes**; runtime HTTP smoke
**4/4 PASS**. Both packages were compiled from current source before tests/live.

```bash
npm --prefix services/api test
npm --prefix knowledge test
npm --prefix services/api run knowledge:prepare-runtime
npm --prefix services/api run eval:rag:p3.1:live
npm --prefix services/api run eval:rag:p3.1:summarize
```

Selected diagnostic runner option: --p3.1 --scenario=A1, writing a separate
supplement rather than the main report. Live testing never runs from normal
npm test/CI. This Windows session used equivalent installed TypeScript/Node
commands because its NVM npm shim remains trust-blocked; no trust bypass or global
tool repair was attempted.

Safe versionable results live under services/api/evaluation/results/rag/:
p3_1-summary.json, p3_1-manual-review.json and p3_1-baseline-diagnostics.json.
Actual sanitized responses and the original input-error evidence remain ignored
in local/. No raw outputs, system prompts or credentials are in safe summaries.

## Git scope and recommendations

- **P3_1_RELIABILITY**: five AI production files: system/EXPLAIN prompts,
  orchestrator, AI boundary diagnostics and OpenRouter empty-length diagnostics.
- **TEST**: rag-reliability.test.mjs; learning-engine.test.mjs authority updates.
- **EVALUATION**: explicit scripts, fixtures, safe results and runner/capture/review
  extensions; original unstaged P3 evaluation infrastructure remains in worktree.
- **DOCUMENTATION**: this report and the original P3 report's pointer.
- **UNRELATED**: preexisting deploy-api.yml/deploy-web.yml deletions, untouched.

Nothing staged, committed or pushed; index is empty and HEAD remains c2eed66.
**Issue #12: READY TO CLOSE** for the bounded integration/reliability pilot after
review, retaining the retrieval/quality backlog. **Issue #39 readiness: YES** for
a separately authorized next workstream; no adaptive tutoring was started here.
