# Remaining source-family pilots — 2026-10-01

Both requested artifacts are acquired and have one unreviewed Thai curated draft each.
No source equation image was transcribed, OCR was not used, no human reviewer metadata
was invented, and no production document was replaced. The reviewed Ohm's Law v0.2.0,
Grade 11 raw checksum, and Grade 11 normalized digest remain unchanged.

## Acquired artifacts and license evidence

| Pilot | Artifact ID | SHA-256 |
|---|---|---|
| Mathematics Grade 10 | `siyavula-mathematics-g10-en-unbranded-pilot` | `881f0968936e797a6f0fa4df305b92641c52add3812871ae39a791c2ee1e4a99` |
| Open Logic | `open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107` | `ac565ee57b35dda8ac043dcbbc10322b5b4002f12abcbc0b0c5c2ddbea426849` |

Source URLs, original filenames, acquisition times and raw paths are recorded in
`../manifest.json`. License text evidence and its checksums are recorded in
`../source-pilot-licenses.json`.

Siyavula's [official catalogue](https://www.siyavula.com/read) identifies the English
Grade 10 CC-BY EPUB. Its internal copyright page declares CC BY 4.0. That page has an
upstream typo: it says Physical Sciences Grade 10. The OPF identifier/title, directory
names, and actual mathematics chapters establish the downloaded artifact's identity.
The typo is retained in the audit, not corrected in raw. Attribution and trademark
conditions remain in the original notice. Other Siyavula editions require separate
license inspection.

Open Logic is pinned to commit `1e960beff9ed7835bf3e3f1335e21af3439cd107`, confirmed by
the [GitHub commit API](https://api.github.com/repos/OpenLogicProject/OpenLogic/commits/1e960beff9ed7835bf3e3f1335e21af3439cd107).
The commit is unsigned; this is a revision pin, not author-signature verification.
The archived [LICENSE.md](https://github.com/OpenLogicProject/OpenLogic/blob/1e960beff9ed7835bf3e3f1335e21af3439cd107/LICENSE.md)
and README declare CC BY 4.0 for Open Logic Text. No overriding license notice was found
in the nine selected content files. Bundled styles/packages are not automatically
classified as CC BY and are not curated content.

## Normalization statistics (scoped, not entire books)

| Metric | Linear Equations | Propositional Logic |
|---|---:|---:|
| Artifact bytes | 49,009,925 | 1,899,294 |
| Archive entries | 10,247 | 792 |
| Normalized units | 16 | 9 |
| Source documents | 1 | 9 |
| Equation-image occurrences | 104 | 0 |
| Distinct document/asset references | 101 | 0 |
| Textual expressions in normalized `math` | 0 | 272 |
| Source tables | 0 | 5 LaTeX tables |
| Lost/missing image references | 0 | 0 |
| Changed source LaTeX slices | n/a | 0 |

Mathematics scope: Chapter 4 → 4.2 Solving linear equations, including three worked
examples and the trailing exercises within that XHTML file. No quadratic-equation,
simultaneous-equation, inequality, or other-grade units are published as normalized
pilot content. Its final worked-example/check subsection also contains trailing
exercise material because the upstream XHTML lacks a separating semantic heading;
do not assume that every image in this unit belongs to that one example.

Logic scope: `content/propositional-logic/syntax-and-semantics/*.tex` only. The nine
units retain 10 definitions, 8 propositions, 6 theorem environments, 11 problem
environments and 5 truth tables. These counts do not indicate all items are M.4-level;
formation sequences, induction, soundness and completeness are not learner candidates.

Detailed generated records: [Mathematics audit](siyavula-mathematics-g10-en-unbranded-pilot.json)
and [Logic audit](open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107.json).

## Parser and source problems

- Mathematics formulas are PNGs with empty alternative text, not accessible symbolic
  equations. Preserve original asset paths and require humans before any source-image
  equation reuse. No numerical example or displayed rule was inferred from those images.
- Mathematics prose says linear equations have at most one solution without the nonzero
  leading-coefficient qualification. The LearnlyAI-authored draft explicitly discusses
  the degenerate case and prohibits division by zero.
- Open Logic uses custom `\\olchapter{part}{chapter}{title}`, `\\olsection`, subfiles,
  `\\usetoken`, `!!` replacement tokens and conditional `\\iftag` branches. The former
  parser missed custom headings; these are now recognized, with chapter inheritance,
  preserved preambles and exact UTF-16 offsets. A multiline dollar-math extraction bug
  was also fixed and regression-tested.
- Macros/tags are not executed or expanded. Full source context and macro files remain
  available in raw; normalized units are not standalone compiled/rendered LaTeX.
  `latex_macros_requires_review` makes that explicit. No TeX compilation or external
  includes are performed.

## Candidate mappings

| Family | Candidates |
|---|---|
| Linear Equations | one-variable linear equation; balance-preserving operations; inverse operations; bracket expansion; substitution check |
| Logic | statement/proposition; negation; conjunction; inclusive disjunction; implication |

Every candidate has source-unit hashes and exact locators in the corresponding JSON
audit. Mathematics mappings remain prerequisite candidates with no inferred Thai grade.
Logic candidates are relevant to the separately documented [IPST M.4 introductory
logic topic](https://proj14.ipst.ac.th/m4-6-math-basic/m4-math-basic/). This does not certify
exact learning-indicator alignment or imply university chapter structure is Thai scope.

## Drafts and gates

- [Balance-preserving operations](../../curation/drafts/mathematics/linear-equations/balance-preserving-operations.md)
- [Negation](../../curation/drafts/mathematics/logic/negation.md)

Both contain Thai authored explanations, a formal rule, variables/units, conditions,
an independently authored worked example, a checked answer, sanity check, common
mistakes, summary and detailed provenance. Original English/LaTeX wording appears only
as source evidence/context. Source images remain excluded. Reviewer and review date are
unset, both review flags are false, and status is draft.

`source_pilot` is a strict, text-only, draft-only provenance envelope. It cannot bypass
the verified-image registry or be promoted merely by changing `status`. Later human
curation must explicitly resolve approval, alignment and any selected image equations
before producing an independently reviewed production document. Generation refuses to
overwrite existing draft edits.

## Verification and scaling

`npm run knowledge:validate` passes all five current documents; only reviewed Ohm's Law
is eligible for production. Full test suite: 48/48 passed, including the existing
loopback review-server test (requires loopback permission in sandboxed environments).
Seven additional tests cover real-format heading/macros, multiline math, scoped
immutability, both pilot templates, provenance failures, approval bypass and grade
inference. All existing tests remain enabled.

Mathematics is **conditionally suitable**: prose normalization and asset traceability
work; source mathematical-image curation is bottlenecked on manual review. A useful
next step is a bounded Grade 10 asset selection/review workflow, not bulk acquisition.

Open Logic is **conditionally suitable**, with more readily reusable textual formulas:
retain macro context, provide reviewer-friendly symbol translation, simplify the
university material, and check Thai terminology/alignment. Exact-source TeX compiles
and tag configuration are not claimed to be normalized renderings.

The current review UI remains scoped to Physical Sciences Grade 11. No embeddings,
vector database, retrieval, deployment, additional grades or automatic approval were added.
