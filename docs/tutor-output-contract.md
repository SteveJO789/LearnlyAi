# Tutor Output Contract

`contracts/learning-output.schema.json` is the canonical contract between the AI/Learning Engine and every Tutor Output consumer. Provider output must pass this contract before it can be persisted or returned to the frontend. The schema uses JSON Schema Draft 2020-12 and currently identifies itself as version `1.0`.

The schema defines structure and field-level constraints. The API validator also enforces identifier uniqueness and the cross-reference from each block's `citationIds` to the top-level `citations` array. Invalid provider output is an internal AI boundary failure; raw validator or provider exceptions must not be exposed to API consumers.

## Top-level object

All top-level fields are required. Unknown top-level fields are rejected.

| Field | Meaning |
|---|---|
| `schemaVersion` | Contract version. Version 1 payloads must use the exact value `1.0`. |
| `responseId` | Nonblank opaque identifier for this tutor response. |
| `sessionId` | Nonblank opaque identifier of the learning session. |
| `stage` | Learning workflow stage in which the output was created. |
| `blocks` | Nonempty ordered list of renderable learning blocks. |
| `progress` | Progress and the next learner interaction expected by the engine. |
| `citations` | Source metadata referenced by blocks; it may be empty when no source is used. |

### Stage

`stage` is one of:

- `CONTENT_ANALYSIS`: the supplied material and learning objective are being analysed.
- `PRE_TEST`: the learner's starting knowledge is being assessed.
- `LEARNING`: the learner is receiving explanations, questions, hints, and feedback.
- `TRANSFER`: the learner is applying knowledge in a different context.
- `POST_TEST`: learning outcomes are being assessed.
- `COMPLETED`: the learning flow is complete.

`INPUT` remains a Learning Session state, but it is intentionally not a Tutor Output stage because no tutor response exists before input processing begins.

### Progress and next action

`progress.percent` is a required integer from `0` through `100`. `progress.canAdvance` is a required boolean controlled by the Learning Engine. `progress.nextAction` is optional and may be `null`; when present, its supported non-null values are:

| Value | Consumer meaning |
|---|---|
| `ANSWER` | Collect an answer to a guided question. |
| `REQUEST_HINT` | Allow the learner to request the next hint. |
| `SUBMIT_ASSESSMENT` | Submit the current pre-test or post-test response. |
| `CONTINUE` | Advance to the next engine-controlled step. |

Consumers must not infer a state transition from the percentage alone. The backend owns transitions and `canAdvance`.

## Blocks

Every block has a nonblank `id` and a literal `type`. Unknown block-level fields are rejected. Block IDs must be unique within a response. The order of `blocks` is the presentation order.

| `type` | Required fields | Optional fields |
|---|---|---|
| `explanation` | `id`, `type`, `content` | `title` (`string` or `null`), `citationIds` |
| `guided_question` | `id`, `type`, `content`, `expectedInput` | `choices`, `citationIds` |
| `hint` | `id`, `type`, `content`, `level` | `title` (`string` or `null`), `citationIds` |
| `quiz` | `id`, `type`, `questionId`, `prompt`, `format` | `choices`, `citationIds` |
| `feedback` | `id`, `type`, `content`, `result` | `citationIds` |
| `interactive` | `id`, `type`, `component`, `props` | `citationIds` |

Additional constraints:

- Required text and identifier values must contain at least one non-whitespace character.
- `guided_question.expectedInput` is `TEXT`, `CHOICE`, or `NUMBER`. `choices` is required for `CHOICE` and is not accepted for the other input modes.
- `hint.level` is an integer from `1` through `3`.
- `quiz.format` is `MULTIPLE_CHOICE`, `SHORT_TEXT`, or `NUMBER`. A multiple-choice quiz requires at least two choices; other formats do not accept `choices`.
- Every quiz choice has a nonblank, response-stable `id` and a nonblank `label`. Choice IDs must be unique within that quiz.
- `feedback.result` is `CORRECT`, `PARTIALLY_CORRECT`, or `TRY_AGAIN`.
- `interactive.component` is `OHMS_LAW`, `LINEAR_EQUATION`, or `LOGIC_GATE`. Its `props` object is intentionally component-defined so Issues #10 and #12 can pass the registered component's payload without adding arbitrary fields to the block itself.

## Citations

Each citation requires a nonblank `id`, nonblank `title`, and `sourceType`. Supported source types are `USER_MATERIAL` and `TRUSTED_KNOWLEDGE_BASE`. `url` is optional and must be an absolute URI or `null`; `page` is optional and must be an integer greater than or equal to 1 or `null`. Citation IDs must be unique within a response.

A block may contain a unique list of `citationIds`. Every listed value must exactly match an existing `citations[].id`; unresolved references fail server-side validation. A citation object may remain unreferenced, although producers should omit unused source metadata.

## Frontend rendering guidance

Cake's frontend renderer should select exactly one component with an exhaustive dispatch on `block.type`, for example `explanation` to an explanation component and `quiz` to a quiz component. The renderer should pass only the selected block's documented fields and resolve source displays by joining `block.citationIds` to `citations[].id`. It should show a safe unsupported-content state for an unknown `schemaVersion` or block type rather than guessing a component.

This contract does not define React components, visual layout, or interaction endpoint behavior.

## Versioning

Producers and consumers must check `schemaVersion`; they must not silently accept a version they do not understand. A breaking field, enum, conditional rule, or semantic change requires a new schema version and a coordinated producer/consumer rollout. Keep the previous schema available during migration, add examples and contract tests for the new version, and never change the meaning of an already published version in place.

Even an apparently additive field can break strict consumers because objects reject unknown properties. Treat additions as coordinated contract changes and bump the version when deployed consumers cannot safely ignore them.

## Examples

Valid complete payloads are in [`contracts/examples`](../contracts/examples):

- `explanation.json`
- `guided-question.json`
- `quiz.json`

Additional valid examples remain available for guided learning, pre-test, and progressive-hint flows. Negative fixtures are in `contracts/examples/invalid` and are exercised by the API contract tests.
