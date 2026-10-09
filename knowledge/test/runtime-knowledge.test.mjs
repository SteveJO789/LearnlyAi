import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runtimeKnowledgeFiles, prepareRuntimeKnowledge } from "../dist/runtime-knowledge.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const concept = "concepts/physics/electricity/ohms-law.md";
function sourceOnly(t) {
  const scratch = mkdtempSync(join(tmpdir(), "learnly-runtime-source-"));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  // These are all tracked source inputs. No raw/normalized/build/dist copied.
  for (const path of ["concepts", "schemas", "manifest", "reviews/document-history"]) {
    cpSync(join(root, path), join(scratch, path), { recursive: true });
  }
  return scratch;
}

test("tracked source alone produces deterministic bytes and a minimal contract closure", (t) => {
  const source = sourceOnly(t);
  const first = runtimeKnowledgeFiles(source);
  assert.deepEqual([...runtimeKnowledgeFiles(source)], [...first]);
  assert.equal(first.size, 9);
  assert.ok(Buffer.byteLength([...first.values()].join("")) < 64 * 1024);
  assert.ok([...first.keys()].every((path) => /^(build\/concepts\/physics\/electricity\/ohms-law.json|manifest\/sources.json|schemas\/[a-z-]+.schema.json|NOTICE.md)$/u.test(path)));
  const output = mkdtempSync(join(tmpdir(), "learnly-runtime-output-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  prepareRuntimeKnowledge(source, output);
  const bytes = [...first.keys()].map((path) => readFileSync(join(output, path)));
  prepareRuntimeKnowledge(source, output);
  assert.deepEqual([...first.keys()].map((path) => readFileSync(join(output, path))), bytes);
});

test("runtime preparation rejects missing source, changed reviewed prose and revoked source permission", (t) => {
  const source = sourceOnly(t);
  const bytes = readFileSync(join(source, concept));
  rmSync(join(source, concept));
  assert.throws(() => runtimeKnowledgeFiles(source), /ENOENT/u);
  writeFileSync(join(source, concept), Buffer.concat([bytes, Buffer.from("\nTampered prose\n")]));
  assert.throws(() => runtimeKnowledgeFiles(source));
  writeFileSync(join(source, concept), bytes);
  const manifestPath = join(source, "manifest/sources.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.sources.find((entry) => entry.source_id === "siyavula-physical-sciences-g10-g12-ccby").rag_permission_status = "reference_only";
  writeFileSync(manifestPath, JSON.stringify(manifest));
  assert.throws(() => runtimeKnowledgeFiles(source), /productionContentPermission/u);
});
