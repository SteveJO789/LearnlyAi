// Read-only unless --write is explicitly supplied. No acquisition or review approval.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { auditSourcePilot } from "../dist/pilot-audit.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const artifactId = process.argv[2];
if (!artifactId) throw new Error("Pass an acquired artifact ID [--write]");
const report = auditSourcePilot(root, artifactId);
if (process.argv.includes("--write")) {
  mkdirSync(join(root, "acquisition/pilots"), { recursive: true });
  const path = join(root, "acquisition/pilots", `${report.artifact_id}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Audit written: ${path}`);
}
console.log(JSON.stringify({ ...report, normalized_units: undefined }, null, 2));
