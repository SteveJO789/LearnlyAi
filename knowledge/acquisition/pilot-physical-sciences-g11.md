# Physical Sciences Grade 11 acquisition pilot

Date: 2026-10-01. Scope: the first artifact of the proposed three-artifact pilot.
No curated documents were created or approved.

## Artifact and license evidence

- Source ID: `siyavula-physical-sciences-g10-g12-ccby`.
- Artifact ID: `siyavula-physical-sciences-g11-en-ccby-3d893a4364f5`.
- Original filename: `Gr11_PhysicalSciences_Learner_Eng_CC-BY.epub`.
- Official download: https://www.siyavula.com/downloads/books/science/Gr11_PhysicalSciences_Learner_Eng_CC-BY.epub
- Catalogue and edition evidence: https://www.siyavula.com/read — Physical Sciences,
  Grade 11, English, ePUB (CC-BY); catalogue distinguishes unbranded CC-BY downloads
  from branded CC-BY-ND downloads.
- Internal license evidence: `OPS/xhtml/science11/front-matter-epubs/copyright_acknowledgements_ccby.html`
  explicitly declares CC BY 4.0. Its linked license is
  http://creativecommons.org/licenses/by/4.0/.
- The registry previously claimed CC BY 3.0. It now records the verified artifact's
  4.0 declaration; the catalogue overview's 3.0 link is not used to override the file.
  Each other edition must be verified before acquisition.
- Language: `en`; publisher grade: Grade 11 CAPS; package modification date:
  `2015-09-10T17:40:11Z` (not the acquisition date).
- Size: 47,417,044 bytes.
- SHA-256: `3d893a4364f52efe1991360302cfccb06030e03ad67d725867fb48f0f177a0f9`.
- Exact acquisition time and raw location are in `acquisition/manifest.json`.

The raw artifact retains the original downloaded bytes and filename. Normalization
does not edit it. Archive images remain inside the raw EPUB; normalized asset records
reference them rather than copying or transforming them.

## Findings and fixes

The original parser produced 916 units but dropped equation PNGs and circuit diagrams;
all `math` arrays were empty. Embedded activity headings also replaced the chapter
with labels such as Aim and Method. These structurally valid records were unsuitable
for mathematical curation.

Parser 2.1.0 now retains inline/standalone image references, explicit asset locators,
definition labels, nested lists and their tables, and chapter context across split
XHTML files. Merged-cell tables retain original HTML with a review warning. Standalone
TeX scripts are supported when present, although this artifact has none. Normalized
provenance now records the version that actually produced the output.

## Quality result

| Check | Result |
|---|---|
| Archive entries | 4,072 |
| Spine documents | 82 |
| Documents with normalized units | 81 |
| Intentionally excluded document | Navigation-only `science11.nav.xhtml` |
| Normalized units | 959 |
| Chapter 11 units | 102; all retain `Chapter 11: Electric circuits` |
| Image occurrences | 9,201 |
| Equation-image occurrences | 8,447 |
| Distinct document/asset references | 4,692; none missing or unexpected |
| Units requiring equation-image review | 678 |
| Textual MathML/TeX occurrences | 0 |
| Independent text comparison | All 5,216 source body segments of at least 40 characters retained |
| Automated review approval | None |
| Regression tests | 25/25 pass |
| Knowledge validation and production build | Pass; existing 1 reviewed document built, 2 drafts excluded |
| Repeat normalization | Identical output; raw SHA-256 unchanged |

Normalized output digest (ordered filenames and JSON bytes, with NUL separators):
`b59179ca6adb5640d73b367890f4cb7aef6803705f4988e988f08dcdda932241`.

Ten independently inspected samples cover introduction, the Ohm definition, experimental
method/list/table, worked problem and solution, series and parallel resistance, power,
a power worked example, and chapter summary. Sample titles and normalized filenames are
reported by `scripts/audit-epub-pilot.mjs`; numeric filenames are only stable within a
particular parser output, so use artifact ID plus source document and section locators
for long-term mapping.

All 3,323 PNGs were inspected for metadata; no mathematical source or TeX metadata was
found. No TeX/SVG companion source exists in the archive. Mathematical PNGs are retained
as assets, not represented as recovered symbolic expressions. No OCR was performed.

Storage fidelity passes. Mathematical text curation remains pending human inspection
and verified transcription of the selected equations and numerical examples.

The original chapter summary incorrectly assigns joules to electrical power; power
uses watts. Normalization preserves the original statement. Curated explanations must
correct it through subject review. The summary table also has an unrelated electrostatics
caption; it should not determine curriculum mapping.

## Candidate curriculum mapping

These are mapping proposals, not approved curriculum assertions or curated documents.
The existing LearnlyAI map targets `m5`, `additional`, `required` for electricity;
South African Grade 11 is only source metadata. OBEC/IPST alignment needs human checking.

All document paths below are relative to `OPS/xhtml/science11/` inside this artifact.

| Concept | Source document | Section | Curation concern |
|---|---|---|---|
| electric-current | `11-electric-circuits-01.cnxmlplus.html` | 11.2 Ohm's Law | Symbol and definition check |
| potential-difference | `11-electric-circuits-01.cnxmlplus.html` | 11.2 Ohm's Law | Energy-per-charge terminology |
| resistance | `11-electric-circuits-01.cnxmlplus.html` | 11.2 Ohm's Law | Temperature and ohmic conditions |
| ohms-law | `11-electric-circuits-01.cnxmlplus.html` | 11.2 Ohm's Law / Using Ohm's Law | Verify formula, units and example arithmetic |
| series-resistance | `11-electric-circuits-01.cnxmlplus.html` | Equivalent series resistance | Transcribe equation and check topology |
| parallel-resistance | `11-electric-circuits-01.cnxmlplus.html` | Equivalent parallel resistance | Fractions and circuit topology |
| simple-circuit-topology | `11-electric-circuits-01.cnxmlplus.html` | Series circuits / Parallel circuits | Inspect diagrams and branch connectivity |
| simple-dc-circuit-analysis | `11-electric-circuits-01.cnxmlplus.html` | Use of Ohm's Law in series and parallel circuits | Keep worked problem, diagram and solution together |
| electrical-power | `11-electric-circuits-02.cnxmlplus.html` | Electrical power / Equivalent forms | Verify watts and equivalent power equations |
| electrical-energy | `11-electric-circuits-02.cnxmlplus.html` | Electrical energy | Distinguish energy in joules from power in watts |

## Next work

1. Select a small set of equations and worked examples from the mapped Chapter 11 units.
2. A human subject reviewer inspects the original images and supplies/checks textual
   equations, quantities, units, arithmetic and diagrams. Preserve exact source locators.
3. Use those checked selections to author draft Thai explanations. Review and production
   approval remain separate and explicit.
4. Expand acquisition to Mathematics Grade 10 and a pinned Open Logic ZIP after resolving
   the first source's mathematical-text quality gate. Do not bulk-acquire remaining grades
   merely because source storage validation succeeds.

Recheck with:

```bash
npm run knowledge:normalize
npm run knowledge:validate
node scripts/audit-epub-pilot.mjs siyavula-physical-sciences-g11-en-ccby-3d893a4364f5
npm test
npm run knowledge:build
```
