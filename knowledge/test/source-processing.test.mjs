import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { strToU8, unzipSync, zipSync } from "fflate";

import { acquireArtifact, calculateSha256 } from "../dist/acquisition.js";
import { normalizeEpub } from "../dist/epub-normalizer.js";
import { normalizeAcquiredArtifacts } from "../dist/normalization.js";
import { normalizeOpenLogic } from "../dist/open-logic-normalizer.js";
import { SourceProcessingError } from "../dist/source-processing-error.js";
import { loadSourceRegistry, SOURCE_PROCESSING_VERSION } from "../dist/source-processing-policy.js";
import { validateSourceProcessing } from "../dist/source-processing-validation.js";

const knowledgeRoot = fileURLToPath(new URL("../", import.meta.url));

function fixtureRoot(t) {
  const root = mkdtempSync(join(tmpdir(), "learnlyai-source-processing-"));
  cpSync(join(knowledgeRoot, "schemas"), join(root, "schemas"), { recursive: true });
  mkdirSync(join(root, "manifest"), { recursive: true });
  cpSync(join(knowledgeRoot, "manifest", "sources.json"), join(root, "manifest", "sources.json"));
  mkdirSync(join(root, "acquisition"), { recursive: true });
  mkdirSync(join(root, "raw"), { recursive: true });
  mkdirSync(join(root, "normalized"), { recursive: true });
  writeFileSync(
    join(root, "acquisition", "manifest.json"),
    `${JSON.stringify({ schema_version: "1.0", artifacts: [] }, null, 2)}\n`,
  );
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function makeEpub() {
  return zipSync({
    mimetype: strToU8("application/epub+zip"),
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`),
    "OEBPS/content.opf": strToU8(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
        <spine><itemref idref="chapter"/></spine>
      </package>`),
    "OEBPS/chapter.xhtml": strToU8(`<!doctype html>
      <html xmlns="http://www.w3.org/1999/xhtml"><head><title>Electric Circuits</title></head><body>
        <h1>Electric Circuits</h1>
        <p>Ohm's law is <math><semantics><mi>V</mi><mo>=</mo><mi>I</mi><mi>R</mi><annotation encoding="application/x-tex">V = IR</annotation></semantics></math>.</p>
        <h2>Resistance</h2>
        <p>Resistance opposes current.</p>
        <ul><li>Voltage is measured in volts.</li><li>Current is measured in amperes.</li></ul>
        <table><tr><th>Symbol</th><th>Unit</th></tr><tr><td>R</td><td>ohm</td></tr></table>
      </body></html>`),
  });
}

function makeImageEpub({ missingImage = false } = {}) {
  const files = unzipSync(makeEpub());
  files["OEBPS/content.opf"] = strToU8(`<package>
    <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
    <item id="section" href="section.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="chapter"/><itemref idref="section"/></spine></package>`);
  files["OEBPS/chapter.xhtml"] = strToU8(`<html><head><title>11 circuits</title></head><body>
    <h1>Chapter 11: Electric circuits</h1><h2>11.1 Introduction</h2><p>Introduction.</p></body></html>`);
  files["OEBPS/section.xhtml"] = strToU8(`<html><head><title>11 circuits</title></head><body>
    <div class="section"><h2>11.2 Ohm's Law</h2><dl><dt>Ohm's Law</dt><dd><p>At constant temperature:</p>
    <img class="math-inline" src="equation/formula.png"/></dd></dl>
    <div class="activity"><h1>Experiment</h1><div class="section"><h1>Method</h1>
    <img src="circuit.png" alt="Circuit diagram"/><script type="math/tex; mode=display">V=IR</script>
    <ol><li><p>Measure.</p><ol><li>Record voltage.</li></ol>
    <table><tr><th>V</th><th>I</th></tr><tr><td>6</td><td>2</td></tr></table></li></ol>
    </div></div><div class="section"><h3>Series resistance</h3><p>Resistors in series.</p></div></div>
    </body></html>`);
  files["OEBPS/circuit.png"] = strToU8("fixture image bytes");
  if (!missingImage) files["OEBPS/equation/formula.png"] = strToU8("fixture equation image bytes");
  return zipSync(files);
}

function acquireAllowed(root, bytes = makeEpub()) {
  return acquireArtifact(root, {
    sourceId: "siyavula-physical-sciences-g10-g12-ccby",
    artifactId: "siyavula-physics-test",
    filename: "physical-sciences-unbranded.epub",
    sourceUrl: "https://example.test/physical-sciences-unbranded.epub",
    bytes,
    acquiredAt: "2026-09-29T12:00:00.000Z",
  });
}

function jsonFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...jsonFiles(path));
    else if (entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

function onlyJsonFile(directory) {
  const files = jsonFiles(directory);
  assert.equal(files.length > 0, true);
  return files[0];
}

test("an allowed Phase 2 source can be acquired as an immutable raw artifact", (t) => {
  const root = fixtureRoot(t);
  const bytes = makeEpub();
  const artifact = acquireAllowed(root, bytes);

  assert.equal(artifact.license_status, "allowed");
  assert.equal(artifact.source_id, "siyavula-physical-sciences-g10-g12-ccby");
  assert.deepEqual(readFileSync(join(root, ...artifact.raw_path.split("/"))), Buffer.from(bytes));
});

test("CK-12 do_not_ingest acquisition is blocked", (t) => {
  const root = fixtureRoot(t);
  assert.throws(
    () => acquireArtifact(root, {
      sourceId: "ck12",
      filename: "ck12.epub",
      sourceUrl: "https://example.test/ck12.epub",
      bytes: strToU8("blocked"),
    }),
    (error) => error instanceof SourceProcessingError && error.code === "SOURCE_BLOCKED",
  );
});

test("OpenStax reference_only acquisition is blocked", (t) => {
  const root = fixtureRoot(t);
  assert.throws(
    () => acquireArtifact(root, {
      sourceId: "openstax",
      filename: "openstax.epub",
      sourceUrl: "https://example.test/openstax.epub",
      bytes: strToU8("reference only"),
    }),
    (error) => error instanceof SourceProcessingError && error.code === "SOURCE_NOT_INGESTIBLE",
  );
});

test("unknown source IDs are blocked", (t) => {
  const root = fixtureRoot(t);
  assert.throws(
    () => acquireArtifact(root, {
      sourceId: "unknown-source",
      filename: "unknown.epub",
      sourceUrl: "https://example.test/unknown.epub",
      bytes: strToU8("unknown"),
    }),
    (error) => error instanceof SourceProcessingError && error.code === "UNKNOWN_SOURCE",
  );
});

test("SHA-256 checksums are generated from the exact acquired bytes", () => {
  const bytes = strToU8("LearnlyAI checksum fixture");
  const expected = createHash("sha256").update(bytes).digest("hex");
  assert.equal(calculateSha256(bytes), expected);
});

test("EPUB parsing preserves headings, math, lists, tables, and locators", () => {
  const units = normalizeEpub(makeEpub());
  const chapter = units.find((unit) => unit.title === "Electric Circuits");
  const resistance = units.find((unit) => unit.title === "Resistance");

  assert.ok(chapter);
  assert.deepEqual(chapter.math, ["V = IR"]);
  assert.equal(chapter.locator.document, "OEBPS/chapter.xhtml");
  assert.ok(resistance);
  assert.equal(resistance.locator.chapter, "Electric Circuits");
  assert.match(resistance.content, /## Resistance/);
  assert.match(resistance.content, /- Voltage is measured in volts\./);
  assert.match(resistance.content, /\| Symbol \| Unit \|/);
});

test("image equations and circuit diagrams remain traceable and require review", () => {
  const units = normalizeEpub(makeImageEpub());
  const ohm = units.find((unit) => unit.title === "11.2 Ohm's Law");
  const method = units.find((unit) => unit.title === "Method");
  assert.match(ohm.content, /\*\*Ohm's Law\*\*/);
  assert.match(ohm.content, /epub:OEBPS\/equation\/formula\.png/);
  assert.deepEqual(ohm.math, [], "an image is not fabricated into a symbolic expression");
  assert.deepEqual(ohm.assets, [{kind:"math_image",archive_path:"OEBPS/equation/formula.png",alt:""}]);
  assert.ok(ohm.normalization_warnings.includes("image_math_requires_review"));
  assert.match(method.content, /epub:OEBPS\/circuit\.png/);
  assert.ok(method.normalization_warnings.includes("image_requires_review"));
  assert.ok(method.math.includes("V=IR"), "standalone TeX scripts must survive");
});

test("split chapters retain their context through nested activity headings", () => {
  const units = normalizeEpub(makeImageEpub());
  const method = units.find((unit) => unit.title === "Method");
  const series = units.find((unit) => unit.title === "Series resistance");
  assert.equal(method.locator.chapter, "Chapter 11: Electric circuits");
  assert.equal(method.locator.section, "11.2 Ohm's Law > Experiment > Method");
  assert.equal(series.locator.chapter, "Chapter 11: Electric circuits");
  assert.equal(series.locator.section, "11.2 Ohm's Law > Series resistance");
});

test("nested procedural lists and their tables retain structure", () => {
  const method = normalizeEpub(makeImageEpub()).find((unit) => unit.title === "Method");
  assert.match(method.content, /1\. Measure\./);
  assert.match(method.content, /\n   1\. Record voltage\./);
  assert.match(method.content, /\| V \| I \|/);
  assert.match(method.content, /\| 6 \| 2 \|/);
});

test("missing EPUB image assets fail normalization", () => {
  assert.throws(() => normalizeEpub(makeImageEpub({missingImage:true})), /EPUB image is missing/);
});

test("merged-cell tables preserve original layout and mathematical asset references", () => {
  const files = unzipSync(makeImageEpub());
  files["OEBPS/section.xhtml"] = strToU8(`<html><head><title>11 circuits</title></head><body>
    <h2>Chapter summary</h2><table><tr><th colspan="2">Quantities</th></tr>
    <tr><td><img class="math-inline" src="equation/formula.png"/></td><td><math><mi>V</mi></math></td></tr>
    </table></body></html>`);
  const unit = normalizeEpub(zipSync(files)).find((item) => item.title === "Chapter summary");
  assert.match(unit.content, /colspan="2"/);
  assert.ok(unit.normalization_warnings.includes("complex_table_requires_review"));
  assert.ok(unit.normalization_warnings.includes("image_math_requires_review"));
  assert.equal(unit.assets[0].archive_path, "OEBPS/equation/formula.png");
  assert.match(unit.math[0], /<math/);
});

test("normalized image provenance and current parser version are validated", (t) => {
  const root = fixtureRoot(t);
  acquireAllowed(root, makeImageEpub());
  const manifestPath = join(root, "acquisition", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.artifacts[0].parser_version = "2.0.0";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  normalizeAcquiredArtifacts(root);
  const recordPath = jsonFiles(join(root, "normalized")).find((path) => JSON.parse(readFileSync(path, "utf8")).assets?.length);
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  assert.equal(record.provenance.parser_version, SOURCE_PROCESSING_VERSION);
  assert.equal(JSON.parse(readFileSync(manifestPath, "utf8")).artifacts[0].parser_version, "2.0.0");
  record.assets[0].archive_path = "OEBPS/nonexistent.png";
  record.normalization_warnings = [];
  writeFileSync(recordPath, JSON.stringify(record));
  const issues = validateSourceProcessing(root, loadSourceRegistry(root)).issues;
  assert.ok(issues.some((issue) => issue.keyword === "assetReference"));
  assert.ok(issues.some((issue) => issue.keyword === "assetReview"));
});

test("Open Logic LaTeX normalization preserves definitions and symbolic expressions", () => {
  const latex = String.raw`\chapter{Propositional Logic}
\section{Implication}
\begin{definition}
The implication $p \to q$ is false only when $p$ is true and $q$ is false.
\end{definition}`;
  const units = normalizeOpenLogic(strToU8(latex), "open-logic.tex");
  const implication = units.find((unit) => unit.title === "Implication");

  assert.ok(implication);
  assert.equal(implication.locator.chapter, "Propositional Logic");
  assert.match(implication.content, /\\begin\{definition\}/);
  assert.ok(implication.math.includes("p \\to q"));
  assert.equal(implication.content_format, "latex");
});

test("Open Logic custom chapter/section macros retain preamble, offsets and multiline mathematics", () => {
  const source = String.raw`% Commented heading \olsection{Never a section}; $fake$
% Unicode before heading: 🧠
\olchapter{pl}{syn}{Syntax and Semantics}
\olsection{\usetoken{P}{valuation} and Satisfaction}
\begin{defn}A definition with $\pValue{v_1}(\Obj p_n) =
\pValue{v_2}(\Obj p_n)$ whenever $\Obj p_n$ occurs.\end{defn}
\iftag{prvNot}{$\lnot !A$}{}
\[p \to q\]
\subsection[Short]{Nested {Title}}
Retain \olimport{formulas} without executing it.`;
  const units = normalizeOpenLogic(strToU8(source), "logic.tex");
  assert.deepEqual(units.map((u) => u.title), ["Syntax and Semantics", "valuation and Satisfaction", "Nested Title"]);
  assert.ok(units[0].content.startsWith("% Commented"));
  const section = units[1];
  assert.equal(section.locator.chapter, "Syntax and Semantics");
  assert.ok(section.math.some((value) => value.includes("\n") && value.includes("\\pValue{v_2}")));
  assert.ok(!section.math.includes("whenever"));
  assert.ok(!units.flatMap((u) => u.math).includes("fake"));
  assert.ok(section.normalization_warnings.includes("latex_macros_requires_review"));
  for (const unit of units) assert.equal(source.slice(unit.locator.offset_start, unit.locator.offset_end).trim(), unit.content);
});

test("Open Logic subfiles inherit chapter from the archived parent without expanding macros", () => {
  const prefix = "OpenLogic-pinned/content/propositional-logic/syntax-and-semantics/";
  const zip = zipSync({
    [`${prefix}syntax-and-semantics.tex`]: strToU8(String.raw`\olchapter{pl}{syn}{Syntax and Semantics}\olimport{formulas}`),
    [`${prefix}formulas.tex`]: strToU8(String.raw`\olfileid{pl}{syn}{fml}\olsection{Propositional formulas}\begin{defn}$!A \lif !B$\end{defn}`),
  });
  const units = normalizeOpenLogic(zip, "pinned.zip");
  const formulas = units.find((u) => u.title === "Propositional formulas");
  assert.equal(formulas.locator.chapter, "Syntax and Semantics");
  assert.ok(formulas.math.includes("!A \\lif !B"));
  assert.match(formulas.content, /\\olfileid/);
});

test("scoped normalization appends one artifact without changing existing raw or normalized evidence", (t) => {
  const root = fixtureRoot(t);
  const existing = acquireAllowed(root);
  normalizeAcquiredArtifacts(root);
  const oldPath = onlyJsonFile(join(root, "normalized"));
  const oldBytes = readFileSync(oldPath);
  const rawBytes = readFileSync(join(root, existing.raw_path));
  const second = acquireArtifact(root, {
    sourceId: "open-logic-project", artifactId: "logic-scoped-test", filename: "logic.zip",
    sourceUrl: "https://example.test/pinned.zip",
    bytes: zipSync({
      "content/logic/selected.tex": strToU8(String.raw`\olsection{Negation}$\lnot p$`),
      "content/other/excluded.tex": strToU8(String.raw`\chapter{Not this pilot}$z$`),
    }),
  });
  const result = normalizeAcquiredArtifacts(root, { artifactId: second.artifact_id, documentPrefix: "content/logic/" });
  assert.equal(result.artifactCount, 1);
  assert.equal(result.recordCount, 1);
  assert.deepEqual(readFileSync(oldPath), oldBytes);
  assert.deepEqual(readFileSync(join(root, existing.raw_path)), rawBytes);
  const record = JSON.parse(readFileSync(join(root, "normalized/open-logic-project/logic-scoped-test/00001.json")));
  assert.equal(record.provenance.parser_version, "2.2.0");
  assert.throws(() => normalizeAcquiredArtifacts(root, { artifactId: second.artifact_id }), /never overwrites/);
  assert.throws(() => normalizeAcquiredArtifacts(root, { artifactId: "missing" }), /Unknown artifact/);
  assert.throws(() => normalizeAcquiredArtifacts(root, { documentPrefix: "content/logic/" }), /requires --artifact-id/);
  assert.deepEqual(validateSourceProcessing(root, loadSourceRegistry(root)).issues, []);
});

test("normalized records retain verifiable acquisition provenance", (t) => {
  const root = fixtureRoot(t);
  const artifact = acquireAllowed(root);
  const result = normalizeAcquiredArtifacts(root);
  const outputPath = onlyJsonFile(join(root, "normalized"));
  const record = JSON.parse(readFileSync(outputPath, "utf8"));
  const validation = validateSourceProcessing(root, loadSourceRegistry(root));

  assert.equal(result.artifactCount, 1);
  assert.equal(result.recordCount >= 2, true);
  assert.equal(record.source_id, artifact.source_id);
  assert.equal(record.artifact_id, artifact.artifact_id);
  assert.equal(record.provenance.artifact_sha256, artifact.sha256);
  assert.equal(record.provenance.raw_path, artifact.raw_path);
  assert.deepEqual(validation.issues, []);
});

test("duplicate artifact bytes are rejected without changing the manifest", (t) => {
  const root = fixtureRoot(t);
  const bytes = makeEpub();
  acquireAllowed(root, bytes);

  assert.throws(
    () => acquireArtifact(root, {
      sourceId: "siyavula-physical-sciences-g10-g12-ccby",
      artifactId: "duplicate-copy",
      filename: "another-name.epub",
      sourceUrl: "https://example.test/another-name.epub",
      bytes,
    }),
    (error) => error instanceof SourceProcessingError && error.code === "DUPLICATE_ARTIFACT",
  );
  const manifest = JSON.parse(readFileSync(join(root, "acquisition", "manifest.json"), "utf8"));
  assert.equal(manifest.artifacts.length, 1);
});

test("raw modification and normalized records without provenance fail validation", (t) => {
  const root = fixtureRoot(t);
  const originalBytes = makeEpub();
  const artifact = acquireAllowed(root, originalBytes);
  normalizeAcquiredArtifacts(root);
  const rawPath = join(root, ...artifact.raw_path.split("/"));
  chmodSync(rawPath, 0o644);
  writeFileSync(rawPath, strToU8("modified"));
  let validation = validateSourceProcessing(root, loadSourceRegistry(root));
  assert.ok(validation.issues.some((issue) => issue.keyword === "rawArtifactChecksum"));

  writeFileSync(rawPath, originalBytes);
  chmodSync(rawPath, 0o444);
  const outputPath = onlyJsonFile(join(root, "normalized"));
  const record = JSON.parse(readFileSync(outputPath, "utf8"));
  delete record.provenance;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);
  validation = validateSourceProcessing(root, loadSourceRegistry(root));
  assert.ok(validation.issues.some((issue) => issue.path === "/provenance" && issue.keyword === "required"));
});
