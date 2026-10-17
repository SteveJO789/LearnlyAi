import { fileURLToPath } from "node:url";
import { activationTargetError, checkActivationSchema, checkVectorPrerequisites } from "../dist/shared/activation-schema-readiness.js";
import { verifyOcrModels } from "../dist/modules/input/ocr-models.js";
import { LocalReviewedKnowledgeReader } from "../dist/modules/knowledge/reviewed-knowledge-reader.js";
import { checkVectorIndexReadiness } from "../dist/shared/vector-index-readiness.js";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const match = /^--([a-z-]+)=(.*)$/u.exec(arg);
  if (!match) fail("INVALID_ARGUMENTS");
  if (args.has(match[1])) fail("INVALID_ARGUMENTS");
  args.set(match[1], match[2]);
}
function fail(code) {
  process.stdout.write(JSON.stringify({ status: "BLOCKED", findings: [{ id: "preflight", status: "BLOCKED", code }] }) + "\n");
  process.exit(2);
}
const target = args.get("target"), expectedDatabase = args.get("expect-database");
const stages = (args.get("stage") ?? "").split(",").filter(Boolean);
const expectedHost = args.get("expect-host"), expectedProject = args.get("expect-project");
if (stages.length === 0 || stages.some(stage => !["assessments", "uploads", "vector"].includes(stage))) fail("INVALID_ARGUMENTS");
const connectionString = process.env.DATABASE_URL;
const targetError = activationTargetError({ connectionString, target, expectedDatabase, expectedHost, expectedProject });
if (targetError) fail(targetError);

const findings = [];
try {
  if (stages.includes("uploads")) {
    const result = await checkActivationSchema({ uploads: true, connectionString, expectedDatabase });
    findings.push(...result.findings);
    try {
      await verifyOcrModels();
      findings.push({ id: "uploads.ocrModels", status: "PASS", code: "OK" });
    } catch {
      findings.push({ id: "uploads.ocrModels", status: "BLOCKED", code: "OCR_MODELS_INVALID_OR_MISSING" });
    }
  } else if (stages.includes("assessments")) {
    const result = await checkActivationSchema({ connectionString, expectedDatabase });
    findings.push(...result.findings);
  }
  if (stages.includes("vector")) {
    const result = await checkVectorPrerequisites({ connectionString, expectedDatabase });
    findings.push(...result.findings);
    try {
      const reader = new LocalReviewedKnowledgeReader(process.env.KNOWLEDGE_ROOT ?? fileURLToPath(new URL("../runtime-knowledge/", import.meta.url)));
      await checkVectorIndexReadiness(reader, AbortSignal.timeout(5000), process.env, undefined, expectedDatabase);
      findings.push({ id: "vector.index", status: "PASS", code: "OK" });
    } catch {
      findings.push({ id: "vector.index", status: "BLOCKED", code: "VECTOR_CONFIGURATION_OR_INDEX_NOT_READY" });
    }
  }
} catch {
  findings.push({ id: "preflight.connection", status: "BLOCKED", code: "DATABASE_UNAVAILABLE" });
}
if (!stages.includes("assessments") && !stages.includes("uploads")) findings.push({ id: "assessments", status: "NOT_RUN", code: "STAGE_NOT_SELECTED" });
if (!stages.includes("uploads")) findings.push({ id: "uploads", status: "NOT_RUN", code: "STAGE_NOT_SELECTED" });
if (!stages.includes("vector")) findings.push({ id: "vector", status: "NOT_RUN", code: "STAGE_NOT_SELECTED" });
const status = findings.every(item => item.status !== "BLOCKED") ? "PASS" : "BLOCKED";
process.stdout.write(JSON.stringify({ target, database: expectedDatabase, status, findings }) + "\n");
if (status !== "PASS") process.exitCode = 1;
