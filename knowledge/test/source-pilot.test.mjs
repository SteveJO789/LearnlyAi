import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { acquireArtifact } from "../dist/acquisition.js";
import { normalizeAcquiredArtifacts } from "../dist/normalization.js";
import { generateSourcePilot, validateSourcePilot } from "../dist/source-pilot.js";
import { auditSourcePilot } from "../dist/pilot-audit.js";
import { parseKnowledgeMarkdown } from "../dist/markdown-frontmatter.js";
import { toCanonicalKnowledgeDocument } from "../dist/canonical-document.js";
import { buildKnowledge, validateKnowledge } from "../dist/knowledge-pipeline.js";

const repository = fileURLToPath(new URL("../", import.meta.url));
const logicId = "open-logic-source-1e960beff9ed7835bf3e3f1335e21af3439cd107";

function fixture(t, mathematics = false) {
  const root = mkdtempSync(join(tmpdir(), "learnly-pilot-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repository, "schemas"), join(root, "schemas"), { recursive: true });
  for (const directory of ["manifest", "acquisition", "raw", "normalized", "concepts"]) mkdirSync(join(root, directory));
  cpSync(join(repository, "manifest/sources.json"), join(root, "manifest/sources.json"));
  writeFileSync(join(root, "acquisition/manifest.json"), JSON.stringify({ schema_version: "1.0", artifacts: [] }));
  let bytes;
  if (mathematics) {
    bytes = zipSync({
      "META-INF/container.xml": strToU8('<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>'),
      "OPS/package.opf": strToU8('<package><manifest><item id="linear" href="linear.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="linear"/></spine></package>'),
      "OPS/linear.xhtml": strToU8(`<html><body><h1>Chapter 4: Equations and inequalities</h1><h2>4.2 Solving linear equations</h2><img class="math-inline" src="equation/unknown.png"/><h3>Method for solving linear equations</h3><p>An equation must always be balanced, whatever you do to the left-hand side, you must also do to the right-hand side.</p><ol><li>Expand brackets.</li><li>Rearrange.</li><li>Group.</li><li>Factorise.</li><li>Find answer.</li><li>Check the answer by substituting the solution back into the original equation.</li></ol></body></html>`),
      "OPS/equation/unknown.png": strToU8("never OCR this fixture"),
    });
  } else {
    const prefix = `OpenLogic-1e960beff9ed7835bf3e3f1335e21af3439cd107/content/propositional-logic/syntax-and-semantics/`;
    bytes = zipSync({
      [`${prefix}syntax-and-semantics.tex`]: strToU8(String.raw`\olchapter{pl}{syn}{Syntax and Semantics}`),
      [`${prefix}introduction.tex`]: strToU8(String.raw`\olsection{Introduction}
Propositional logic deals with !!{formula}s that are built from variables. $\lnot !A$`),
      [`${prefix}valuations-sat.tex`]: strToU8(String.raw`\olsection{\usetoken{P}{valuation} and Satisfaction}
\begin{defn}\begin{align*}
\pValue{v}(\lnot !A) & = \begin{cases}
        \True & \text{if } \pValue{v}(!A) = \False;\\
        \False & \text{otherwise.}
      \end{cases}
\end{align*}\end{defn}`),
    });
  }
  const artifact = acquireArtifact(root, {
    sourceId: mathematics ? "siyavula-mathematics-g10-g12-ccby" : "open-logic-project",
    artifactId: mathematics ? "siyavula-mathematics-g10-en-unbranded-pilot" : logicId,
    filename: mathematics ? "math.epub" : "logic.zip", sourceUrl: "https://example.test/pinned-source", bytes,
  });
  normalizeAcquiredArtifacts(root, { artifactId: artifact.artifact_id });
  const result = generateSourcePilot(root, mathematics ? "mathematics-g10" : "open-logic");
  const markdown = readFileSync(join(root, result.draftPath), "utf8");
  const document = toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(markdown));
  return { root, artifact, result, document, markdown };
}

test("both source families generate valid, provenance-linked drafts without approval or image transcription", (t) => {
  for (const mathematics of [true, false]) {
    const { root, artifact, result, document, markdown } = fixture(t, mathematics);
    assert.equal(document.status, "draft");
    assert.deepEqual(document.review, { content_status: "draft", math_physics_reviewed: false, language_reviewed: false });
    assert.equal(document.source_pilot.example_origin, "independently_authored_not_source_transcription");
    assert.equal(document.source_pilot.evidence[0].artifact_sha256, artifact.sha256);
    assert.deepEqual(validateSourcePilot(root, document, result.draftPath), []);
    assert.ok(!markdown.includes("epub:"));
    assert.deepEqual(document.grade_range, mathematics ? ["prerequisite"] : ["m4"]);
    assert.deepEqual(validateKnowledge(root).issues, []);
    assert.throws(() => generateSourcePilot(root, mathematics ? "mathematics-g10" : "open-logic"), /EEXIST/);
    assert.equal(readFileSync(join(root, result.draftPath), "utf8"), markdown);
    const built = buildKnowledge(root);
    assert.equal(built.valid, true);
    assert.equal(built.productionDocuments.length, 0);
    const audit = auditSourcePilot(root, artifact.artifact_id);
    assert.equal(audit.candidate_concepts.length, 5);
    assert.deepEqual(audit.latex_slice_mismatches, []);
    assert.deepEqual(audit.lost_asset_references, []);
    assert.equal(readFileSync(join(root, result.draftPath), "utf8"), markdown);
  }
});

test("source pilot rejects changed evidence hashes, missing locators, source images, and source wording in learner content", (t) => {
  const { root, document, result } = fixture(t);
  for (const mutate of [
    (d) => { d.source_pilot.evidence[0].normalized_sha256 = "0".repeat(64); },
    (d) => { delete d.source_pilot.evidence[0].section; },
    (d) => { d.source_refs = []; },
    (d) => { d.source_pilot.evidence[0].excerpt = "invented source quotation"; },
    (d) => { d.sections[0].markdown = "![unverified](epub:equation.png)"; },
    (d) => { d.sections[0].markdown = d.source_pilot.evidence[0].excerpt; },
    (d) => { d.source_refs = d.source_refs.filter((r) => r.usage !== "curriculum_alignment_only"); },
  ]) {
    const bad = structuredClone(document); mutate(bad);
    assert.ok(validateSourcePilot(root, bad, result.draftPath).length > 0);
  }
});

test("pilot cannot bypass human workflow by forcing reviewed even with explicit reviewer metadata", (t) => {
  const { root, document, result } = fixture(t);
  document.status = "reviewed";
  document.review = { content_status: "reviewed", math_physics_reviewed: true, language_reviewed: true, reviewer: "Fixture human", reviewed_at: "2026-10-01" };
  assert.ok(validateSourcePilot(root, document, result.draftPath).some((i) => i.message.includes("draft-only")));
});

test("mathematics source grade does not establish Thai grade", (t) => {
  const { root, document, result } = fixture(t, true);
  document.grade_range = ["m4"];
  assert.ok(validateSourcePilot(root, document, result.draftPath).some((i) => i.message.includes("source grade")));
});
