import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { toCanonicalKnowledgeDocument } from "../dist/canonical-document.js";
import { buildKnowledge } from "../dist/knowledge-pipeline.js";
import { parseKnowledgeMarkdown } from "../dist/markdown-frontmatter.js";
import {
  compileJsonSchema,
  validateCanonicalDocument,
  validateSourceManifest,
} from "../dist/schema-validation.js";

const knowledgeRoot = fileURLToPath(new URL("../", import.meta.url));
const knowledgeValidator = compileJsonSchema(join(knowledgeRoot, "schemas", "knowledge.schema.json"));
const sourceValidator = compileJsonSchema(join(knowledgeRoot, "schemas", "source.schema.json"));
const rawManifest = JSON.parse(readFileSync(join(knowledgeRoot, "manifest", "sources.json"), "utf8"));
const manifestResult = validateSourceManifest(rawManifest, sourceValidator, "manifest/sources.json");
assert.deepEqual(manifestResult.issues, []);
const sources = new Map(manifestResult.manifest.sources.map((source) => [source.source_id, source]));

function emptyProcessingFixture(root) {
  for (const directory of ["acquisition", "raw", "normalized"]) mkdirSync(join(root, directory), {recursive:true});
  writeFileSync(join(root, "acquisition", "manifest.json"), JSON.stringify({schema_version:"1.0",artifacts:[]}));
}

function loadDocument(relativePath) {
  // Keep parser/schema fixtures independent of changes to the live curated corpus.
  const fixturePath = relativePath === "concepts/physics/electricity/ohms-law.md"
    ? "test/fixtures/ohms-law.md" : relativePath;
  const markdown = readFileSync(join(knowledgeRoot, fixturePath), "utf8");
  return toCanonicalKnowledgeDocument(parseKnowledgeMarkdown(markdown));
}

function makeReviewed(document) {
  return {
    ...structuredClone(document),
    status: "reviewed",
    review: {
      content_status: "reviewed",
      math_physics_reviewed: true,
      language_reviewed: true,
      reviewer: "knowledge-test-reviewer",
      reviewed_at: "2026-09-29",
    },
  };
}

function withLifecycle(markdown, status) {
  const reviewed = status === "reviewed";
  let result = markdown
    .replace(/^status: .*$/m, `status: ${status}`)
    .replace(/^  content_status: .*$/m, `  content_status: ${status}`)
    .replace(/^  math_physics_reviewed: .*$/m, `  math_physics_reviewed: ${reviewed}`)
    .replace(/^  language_reviewed: .*$/m, `  language_reviewed: ${reviewed}`);

  if (reviewed && !/^  reviewer:/m.test(result)) {
    result = result.replace(
      /^  language_reviewed: true$/m,
      "  language_reviewed: true\n  reviewer: knowledge-test-reviewer\n  reviewed_at: 2026-09-29",
    );
  }

  return result;
}

function validate(document) {
  return validateCanonicalDocument(document, knowledgeValidator, sources, "fixture.md");
}

function listJsonFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

test("the source manifest records satisfy source.schema.json", () => {
  assert.ok(manifestResult.manifest);
  assert.equal(manifestResult.manifest.sources.length, 10);
  assert.deepEqual(manifestResult.issues, []);
});

test("the fixed Ohm's Law Markdown fixture becomes a valid canonical document", () => {
  const document = loadDocument("concepts/physics/electricity/ohms-law.md");

  assert.deepEqual(validate(document), []);
  assert.deepEqual(document.title, { th: "กฎของโอห์ม", en: "Ohm's Law" });
  assert.equal(document.retrieval_summary.startsWith("ใช้สำหรับคำถาม"), true);
  assert.equal(document.formulas[0].expression, "V = IR");
  assert.equal(document.formulas[0].variables.length, 3);
  assert.equal(document.worked_examples[0].checked_answer, "\\(I = 3\\,A\\)");
});

test("an unknown source ID fails validation", () => {
  const document = loadDocument("concepts/mathematics/logic/implication.md");
  document.source_refs[0].source_id = "source-that-does-not-exist";

  const issues = validate(document);
  assert.ok(issues.some((issue) => issue.keyword === "sourceReference"));
});

test("a reviewed document cannot use the blocked CK-12 source", () => {
  const document = makeReviewed(loadDocument("concepts/physics/electricity/ohms-law.md"));
  document.source_refs.push({ source_id: "ck12", usage: "reference_only" });

  const issues = validate(document);
  assert.ok(issues.some((issue) => issue.keyword === "productionSourcePermission"));
});

test("a non-reviewed document is excluded from the production build", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "learnlyai-knowledge-"));
  cpSync(join(knowledgeRoot, "schemas"), join(fixtureRoot, "schemas"), { recursive: true });
  cpSync(join(knowledgeRoot, "manifest"), join(fixtureRoot, "manifest"), { recursive: true });
  cpSync(join(knowledgeRoot, "concepts"), join(fixtureRoot, "concepts"), { recursive: true });
  emptyProcessingFixture(fixtureRoot);
  const ohmsLawPath = join(fixtureRoot, "concepts", "physics", "electricity", "ohms-law.md");
  writeFileSync(
    ohmsLawPath,
    withLifecycle(readFileSync(join(knowledgeRoot, "test/fixtures/ohms-law.md"), "utf8"), "draft"),
    "utf8",
  );

  const result = buildKnowledge(fixtureRoot);

  assert.equal(result.valid, true);
  assert.equal(result.documents.length, 3);
  assert.equal(result.productionDocuments.length, 0);
  assert.deepEqual(listJsonFiles(join(fixtureRoot, "build")), []);
});

test("the production build writes reviewed canonical JSON at the mirrored concept path", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "learnlyai-knowledge-"));
  cpSync(join(knowledgeRoot, "schemas"), join(fixtureRoot, "schemas"), { recursive: true });
  cpSync(join(knowledgeRoot, "manifest"), join(fixtureRoot, "manifest"), { recursive: true });
  cpSync(join(knowledgeRoot, "concepts"), join(fixtureRoot, "concepts"), { recursive: true });
  emptyProcessingFixture(fixtureRoot);
  const ohmsLawPath = join(fixtureRoot, "concepts", "physics", "electricity", "ohms-law.md");
  const reviewedMarkdown = withLifecycle(readFileSync(join(knowledgeRoot, "test/fixtures/ohms-law.md"), "utf8"), "reviewed");
  writeFileSync(ohmsLawPath, reviewedMarkdown, "utf8");

  const result = buildKnowledge(fixtureRoot);
  const outputPath = join(fixtureRoot, "build", "concepts", "physics", "electricity", "ohms-law.json");
  const output = JSON.parse(readFileSync(outputPath, "utf8"));

  assert.equal(result.valid, true);
  assert.equal(result.productionDocuments.length, 1);
  assert.equal(listJsonFiles(join(fixtureRoot, "build")).length, 1);
  assert.equal(output.id, "physics.electricity.electric-circuits.ohms-law");
  assert.equal(output.status, "reviewed");
  assert.equal(output.formulas[0].variables[2].unit, "ohm (Ω)");
});

test("invalid grade and curriculum role values fail schema validation", () => {
  const invalidGrade = loadDocument("concepts/mathematics/logic/implication.md");
  invalidGrade.grade_range = ["grade-10"];
  assert.ok(validate(invalidGrade).some((issue) => issue.path === "/grade_range/0" && issue.keyword === "enum"));

  const invalidRole = loadDocument("concepts/mathematics/logic/implication.md");
  invalidRole.curriculum_role = "optional";
  assert.ok(validate(invalidRole).some((issue) => issue.path === "/curriculum_role" && issue.keyword === "enum"));
});

test("reviewed documents require completed review metadata", () => {
  const document = makeReviewed(loadDocument("concepts/mathematics/logic/implication.md"));
  delete document.review.reviewer;
  delete document.review.reviewed_at;

  const issues = validate(document);
  assert.ok(issues.some((issue) => issue.path === "/review/reviewer" && issue.keyword === "productionReview"));
  assert.ok(issues.some((issue) => issue.path === "/review/reviewed_at" && issue.keyword === "productionReview"));
});

test("incomplete formula and worked-example objects fail validation", () => {
  const incompleteFormula = loadDocument("concepts/physics/electricity/ohms-law.md");
  delete incompleteFormula.formulas[0].variables[0].unit;
  assert.ok(validate(incompleteFormula).some((issue) => issue.path === "/formulas/0/variables/0/unit"));

  const incompleteExample = loadDocument("concepts/physics/electricity/ohms-law.md");
  incompleteExample.worked_examples[0].checked_answer = "";
  assert.ok(validate(incompleteExample).some((issue) => issue.path === "/worked_examples/0/checked_answer"));

  const missingExample = loadDocument("concepts/mathematics/logic/implication.md");
  missingExample.content_type = "worked-example";
  assert.ok(validate(missingExample).some((issue) => issue.path === "/worked_examples"));
});
