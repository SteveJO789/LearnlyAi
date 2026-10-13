import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "learnly-fresh-runtime-"));
const run = (cwd, args) => {
  const output = execFileSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, KNOWLEDGE_ROOT: "", NODE_PATH: "" } });
  console.log(output.split("\n").filter((line) => /Prepared|tests |pass |fail |Validated|Runtime package/.test(line)).join("\n"));
};
function fingerprint(root, relative = "") {
  return readdirSync(join(root, relative)).sort().flatMap((name) => {
    const path = join(relative, name);
    return statSync(join(root, path)).isDirectory() ? fingerprint(root, path) : [{
      path: path.replaceAll("\\", "/"), bytes: statSync(join(root, path)).size,
      sha256: createHash("sha256").update(readFileSync(join(root, path))).digest("hex"),
    }];
  });
}
try {
  // Export the prospective source-controlled checkout, including unstaged P1/P2/P2.5.
  // Git's exclusion rules omit evidence, generated output, credentials and local tooling.
  const paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--",
    "knowledge", "services/api", "contracts"], { cwd: repository, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const path of new Set(paths)) {
    assert.doesNotMatch(path, /(?:^|\/)(?:raw|normalized|build|dist|node_modules|\.playwright-cli)(?:\/|$)/u);
    const target = join(scratch, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(repository, path), target);
  }
  // Installed locked third-party tools are copied as bytes, never linked. npm installation
  // is deliberately separate: this also works when a local package-manager trust gate blocks npm.
  for (const path of ["knowledge", "services/api"]) {
    cpSync(join(repository, path, "node_modules"), join(scratch, path, "node_modules"), { recursive: true, dereference: true });
  }
  const knowledge = join(scratch, "knowledge");
  const api = join(scratch, "services/api");
  for (const path of ["raw", "normalized", "build", "dist"]) assert.equal(existsSync(join(knowledge, path)), false);
  run(knowledge, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json", "--noEmit", "--incremental", "false"]);
  run(knowledge, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
  run(knowledge, ["scripts/prepare-runtime.mjs"]);
  const first = fingerprint(join(api, "runtime-knowledge"));
  run(knowledge, ["scripts/prepare-runtime.mjs"]);
  assert.deepEqual(fingerprint(join(api, "runtime-knowledge")), first);
  console.log(`Deterministic: ${first.length} files; identical paths, lengths, SHA-256 and bytes.`);
  run(api, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json", "--noEmit"]);
  run(api, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"]);
  run(api, ["scripts/copy-contract.mjs"]);
  assert.equal(existsSync(join(api, "runtime-ocr")), false);
  assert.equal(existsSync(join(api, "runtime-workers")), false);
  run(api, ["scripts/prepare-ocr-models.mjs", "--download"]);
  run(api, ["scripts/copy-input-runtime.mjs"]);
  run(api, ["--test", "test/*.test.mjs"]);
  // Relocate only deployable API files; no repository or Knowledge authoring inputs.
  const isolated = join(scratch, "isolated-api");
  mkdirSync(isolated);
  for (const path of ["package.json", "dist", "runtime-knowledge", "runtime-ocr", "runtime-workers", "test/runtime-knowledge.test.mjs", "test/learning-test-helpers.mjs",
    "test/real-file-extraction.test.mjs", "test/real-file-fixtures.mjs", "test/fixtures"]) {
    cpSync(join(api, path), join(isolated, path), { recursive: true });
  }
  renameSync(join(api, "node_modules"), join(isolated, "node_modules"));
  run(isolated, ["--test", "test/runtime-knowledge.test.mjs"]);
  run(isolated, ["--test", "test/real-file-extraction.test.mjs"]);
  for (const path of ["raw", "normalized", "build"]) assert.equal(existsSync(join(knowledge, path)), false);
  console.log("Fresh source-only export + relocated deployment runtime: PASS (no primary evidence paths or links).");
} finally {
  // Delete only the directory returned by mkdtemp, after checking its fixed parent/prefix.
  assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
  assert.ok(resolve(scratch).startsWith(join(resolve(tmpdir()), "learnly-fresh-runtime-")));
  rmSync(scratch, { recursive: true, force: true });
}
