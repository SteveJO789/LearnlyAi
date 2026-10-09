// Read-only verification of restored evidence. No download, normalization or approval.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  root: { type: "string" },
  "raw-only": { type: "boolean", default: false },
} });
const root = resolve(values.root ?? fileURLToPath(new URL("../", import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function listFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    assert(!entry.isSymbolicLink(), `Evidence must not contain symbolic links: ${path}`);
    return entry.isDirectory() ? listFiles(path) : [path];
  }).filter((path) => !path.endsWith("/.gitkeep")).sort();
}

try {
  const inventory = readJson("acquisition/evidence-inventory.json");
  const manifest = readJson("acquisition/manifest.json");
  assert.equal(inventory.schema_version, "1.0");
  assert.equal(inventory.artifact_storage_provider, "NOT YET SELECTED");
  assert.equal(inventory.raw.length, manifest.artifacts.length);
  for (const artifact of manifest.artifacts) {
    const record = inventory.raw.find((entry) => entry.path === artifact.raw_path);
    assert(record, `Artifact missing from inventory: ${artifact.artifact_id}`);
    assert.equal(record.sha256, artifact.sha256, `Manifest checksum: ${record.path}`);
  }

  let verified = 0;
  for (const category of values["raw-only"] ? ["raw"] : ["raw", "normalized"]) {
    const records = inventory[category];
    const paths = records.map((entry) => entry.path).sort();
    assert.equal(new Set(paths).size, paths.length, "Duplicate inventory path");
    for (const entry of records) {
      assert(entry.path.startsWith(`${category}/`) && !entry.path.includes("\\")
        && entry.path.split("/").every((part) => part && part !== "." && part !== ".."),
      `Invalid inventory path: ${entry.path}`);
      assert(/^[a-f0-9]{64}$/u.test(entry.sha256), `Invalid SHA-256: ${entry.path}`);
      assert(lstatSync(join(root, entry.path)).isFile(), `Not a regular file: ${entry.path}`);
      const bytes = readFileSync(join(root, entry.path));
      assert.equal(bytes.length, entry.bytes, `Byte length: ${entry.path}`);
      assert.equal(digest(bytes), entry.sha256, `Checksum: ${entry.path}`);
      verified++;
    }
    assert.deepEqual(listFiles(category), paths, `Unexpected or missing files in ${category}/`);
  }
  console.log(`Verified ${verified} evidence files (${values["raw-only"] ? "raw only" : "raw and normalized"}); no files changed.`);
} catch (error) {
  console.error(`Evidence verification failed: ${error.message}`);
  process.exitCode = 1;
}
