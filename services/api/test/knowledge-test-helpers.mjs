import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { LocalKnowledgeRetriever } from "../dist/modules/knowledge/local-knowledge-retriever.js";
import { LocalReviewedKnowledgeReader, OHMS_LAW_CONCEPT_ID } from "../dist/modules/knowledge/reviewed-knowledge-reader.js";

const knowledgeRoot = fileURLToPath(new URL("../../../knowledge/", import.meta.url));
const artifactPath = "build/concepts/physics/electricity/ohms-law.json";
const sourceId = "siyavula-physical-sciences-g10-g12-ccby";

// Synthetic schema-valid teaching data. This is not a new production approval.
export function documentFixture() {
  return {
    id: OHMS_LAW_CONCEPT_ID, schema_version: "1.0", version: "0.2.0", status: "reviewed",
    subject: "physics", language: "th", grade_range: ["m5"], curriculum_track: "additional",
    curriculum_role: "required", domain: "electricity", topic: "electric-circuits", subtopic: "ohms-law",
    content_type: "concept", difficulty: "core", title: { th: "กฎของโอห์ม", en: "Ohm's Law" },
    prerequisites: [], learning_objectives: ["ตรวจหน่วย"], retrieval_summary: "Synthetic test reference",
    source_refs: [{ source_id: sourceId, usage: "content_source" }],
    review: { content_status: "reviewed", math_physics_reviewed: true, language_reviewed: true,
      reviewer: "Synthetic test reviewer, not production approval", reviewed_at: "2026-10-01" },
    sections: [
      ["formal-definition", "ตัวนำโอห์มมิกที่อุณหภูมิคงที่"],
      ["formula", "I = V/R"],
      ["variables-and-units", "V: volt; I: ampere; R: ohm"],
      ["conditions-and-limitations", "อุณหภูมิคงที่"],
      ["problem", "พิจารณาตัวต้านทานในวงจรที่ระบุต้นฉบับไว้ในส่วน Detailed Provenance\n\nR = 10 Ω, I = 4 A. Find V."],
      ["solution", "V = IR = 4 × 10 = 40 V"],
      ["checked-answer", "40 V"],
    ].map(([slug, markdown]) => ({ heading: slug, slug, level: 1, markdown })),
  };
}

export function createKnowledgeHarness(t) {
  const root = mkdtempSync(join(tmpdir(), "learnly-retrieval-test-"));
  t.after(() => {
    assert(root.startsWith(resolve(tmpdir()) + sep));
    rmSync(root, { recursive: true, force: true });
  });
  cpSync(join(knowledgeRoot, "schemas"), join(root, "schemas"), { recursive: true });
  cpSync(join(knowledgeRoot, "manifest"), join(root, "manifest"), { recursive: true });
  const write = (path, value) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(value, null, 2) + "\n");
  };
  const document = documentFixture();
  write(artifactPath, document);
  return { root, document, write, retriever: new LocalKnowledgeRetriever(new LocalReviewedKnowledgeReader(root)) };
}
