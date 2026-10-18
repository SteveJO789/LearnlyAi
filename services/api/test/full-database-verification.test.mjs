import assert from "node:assert/strict";
import test from "node:test";
import contract from "../src/prisma/contract.json" with { type: "json" };
import signatures from "../src/shared/activation-catalog-signatures.json" with { type: "json" };
import { inspectFullPublicPolicyRls } from "../dist/shared/activation-schema-readiness.js";
import { verifyFullDatabase } from "../scripts/verify-full-database.mjs";

const entries = contract.storage.namespaces.public.entries;
const policyRows = () => Object.values(entries.policy).map(policy => {
  const id = `policy:public:${policy.tableName}:${policy.name}:using`;
  const withCheckId = `policy:public:${policy.tableName}:${policy.name}:withCheck`;
  return {
    tableName: policy.tableName, name: policy.name, permissive: policy.permissive,
    roles: [...policy.roles], cmd: policy.operation.toUpperCase(), qual: signatures.entries.find(item => item.id === id)?.deparsed ?? null,
    withCheck: signatures.entries.find(item => item.id === withCheckId)?.deparsed ?? null,
  };
});

function catalogClient({ policies = policyRows(), disabledTable } = {}) {
  return { async query(sql) {
    if (sql.includes("server_version_num")) return { rows: [{ version: signatures.postgresMajor * 10000 }] };
    if (sql.includes("FROM pg_class c JOIN pg_namespace")) return { rows: Object.keys(entries.table).map(tableName => ({
      tableName, kind: "r", enabled: tableName !== disabledTable,
    })) };
    if (sql.includes("FROM pg_policies WHERE schemaname = 'public'")) return { rows: policies };
    throw new Error(`Unexpected catalog query in test: ${sql}`);
  } };
}

test("full public catalog attestation accepts the complete contract and blocks weak, extra, or disabled policies", async () => {
  assert.equal(Object.keys(entries.policy).length, 30);
  assert.equal((await inspectFullPublicPolicyRls(catalogClient())).status, "PASS");

  const weak = policyRows();
  weak.find(row => row.tableName === "AIRequest").qual = "true";
  assert.equal((await inspectFullPublicPolicyRls(catalogClient({ policies: weak }))).status, "BLOCKED");

  const extra = [...policyRows(), { tableName: "AIRequest", name: "unexpected", permissive: true,
    roles: ["public"], cmd: "SELECT", qual: "true", withCheck: null }];
  assert.equal((await inspectFullPublicPolicyRls(catalogClient({ policies: extra }))).status, "BLOCKED");
  assert.equal((await inspectFullPublicPolicyRls(catalogClient({ disabledTable: "KnowledgeChunk" }))).status, "BLOCKED");
});

test("full verification rejects target identity before invoking Prisma or opening catalog connections", async () => {
  let touched = false;
  const checks = Object.fromEntries(["checkActivationSchema", "checkVectorPrerequisites", "checkFullPublicPolicyRls"]
    .map(name => [name, async () => { touched = true; throw new Error("connection attempted"); }]));
  const result = await verifyFullDatabase({ argv: ["--target=local", "--expect-database=learnly_test"],
    env: { DATABASE_URL: "postgresql://user:secret@remote.invalid/learnly_test" }, checks,
    runPrisma: () => { touched = true; throw new Error("Prisma invoked"); } });
  assert.equal(result.status, "BLOCKED");
  assert.equal(touched, false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("the modern catalog profile requires its supplemental security gate after native full strict verification", async () => {
  const pass = async () => ({ status: "PASS", findings: [{ id: "pass", status: "PASS", code: "OK" }] });
  let checked = false, cleaned = false;
  const result = await verifyFullDatabase({
    argv: ["--target=local", "--expect-database=learnly_test"],
    env: { DATABASE_URL: "postgresql://unit:secret@127.0.0.1/learnly_test",
      LEARNLY_SUPABASE_CATALOG_PROFILE: "supabase-auth-20260831180000-storage-73-multitenant-pg17" },
    createOverlay: async () => ({ migrationsDir: "/tmp/learnly-supabase-catalog-verify-unit/migrations",
      evidence: {}, cleanup: async () => { cleaned = true; } }),
    runPrisma: (args, env) => {
      assert.equal(args.includes("--strict"), true);
      assert.equal(args.some(arg => arg.includes("prisma.verify.config.ts")), true);
      assert.equal(env.LEARNLY_SUPABASE_VERIFY_MIGRATIONS_DIR, "/tmp/learnly-supabase-catalog-verify-unit/migrations");
      return { exitCode: 0, events: [{ kind: "result", envelope: { ok: true, result: {
        ok: true, mode: "full", meta: { schemaVerification: "performed" }, schema: { strict: true },
      } } }], stdout: "", stderr: "" };
    },
    checks: { checkActivationSchema: pass, checkVectorPrerequisites: pass, checkFullPublicPolicyRls: pass },
    verifyModernCatalog: async () => { checked = true; return { status: "BLOCKED", findings: [
      { id: "catalog.modern.indexes", status: "BLOCKED", code: "SOURCE_SIGNATURE_MISMATCH" },
    ] }; },
  });
  assert.equal(checked, true);
  assert.equal(cleaned, true);
  assert.equal(result.canonical.issueCount, 0);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.findings.some(f => f.id === "catalog.modern.indexes" && f.status === "BLOCKED"), true);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("canonical Prisma schema issues and failures remain visible and block the gate", async () => {
  const calls = [];
  const pass = async () => ({ status: "PASS", findings: [{ id: "pass", status: "PASS", code: "OK" }] });
  const result = await verifyFullDatabase({ argv: ["--target=local", "--expect-database=learnly_test"],
    env: { DATABASE_URL: "postgresql://user:secret@localhost/learnly_test" },
    runPrisma: (args) => {
      calls.push(args);
      return { exitCode: 1, events: [{ kind: "result", envelope: { ok: false,
        result: { ok: false, schema: { issues: [{ path: ["database", "public", "AIRequest"], reason: "policy changed" }] } } } }],
      stdout: "", stderr: "schema drift" };
    }, checks: { checkActivationSchema: pass, checkVectorPrerequisites: pass, checkFullPublicPolicyRls: pass } });
  assert.equal(result.status, "BLOCKED");
  assert.deepEqual(calls[0].slice(0, 2), ["db", "verify"]);
  assert.equal(calls[0].includes("--strict"), true);
  assert.equal(calls[0].some(arg => arg.includes("marker-only") || arg.includes("finding")), false);
  assert.equal(result.canonical.issueCount, 1);
  assert.equal(result.canonical.result.schema.issues[0].reason, "policy changed");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("malformed Prisma JSON, nonzero exit with no issues, and a failed result envelope all block and redact", async () => {
  const pass = async () => ({ status: "PASS", findings: [{ id: "pass", status: "PASS", code: "OK" }] });
  const base = { argv: ["--target=local", "--expect-database=learnly_test"],
    env: { DATABASE_URL: "postgresql://user:secret@localhost/learnly_test" },
    checks: { checkActivationSchema: pass, checkVectorPrerequisites: pass, checkFullPublicPolicyRls: pass } };
  const malformed = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 1, events: [], stdout: "not json", stderr: "" }) });
  assert.equal(malformed.status, "BLOCKED");
  assert.equal(malformed.canonical.issueCount, null);

  const nonzeroNoIssues = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 1, events: [
    { kind: "result", envelope: { ok: true, result: { ok: true, schema: { issues: [] }, detail: "postgres://user:secret@host/db" } } },
  ], stdout: "", stderr: "" }) });
  assert.equal(nonzeroNoIssues.status, "BLOCKED");
  assert.equal(JSON.stringify(nonzeroNoIssues).includes("secret"), false);

  const failedResult = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 0, events: [
    { kind: "result", envelope: { ok: true, result: { ok: false, schema: { issues: [] } } } },
  ], stdout: "", stderr: "" }) });
  assert.equal(failedResult.status, "BLOCKED");
});

test("full Prisma result without an issues array passes only with performed full schema verification", async () => {
  const pass = async () => ({ status: "PASS", findings: [{ id: "pass", status: "PASS", code: "OK" }] });
  const base = { argv: ["--target=local", "--expect-database=learnly_test"],
    env: { DATABASE_URL: "postgresql://user:secret@localhost/learnly_test" },
    checks: { checkActivationSchema: pass, checkVectorPrerequisites: pass, checkFullPublicPolicyRls: pass } };
  const successfulResult = { ok: true, mode: "full", schema: { summary: "Database schema satisfies contract", strict: true, warnings: [] },
    meta: { schemaVerification: "performed" }, unclaimed: [] };
  const successful = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 0, events: [
    { kind: "result", envelope: { ok: true, result: successfulResult } },
  ], stdout: "", stderr: "" }) });
  assert.equal(successful.status, "PASS");
  assert.equal(successful.canonical.issueCount, 0);

  const notStrict = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 0, events: [
    { kind: "result", envelope: { ok: true, result: { ...successfulResult, schema: { ...successfulResult.schema, strict: false } } } },
  ], stdout: "", stderr: "" }) });
  assert.equal(notStrict.status, "BLOCKED");

  const skipped = await verifyFullDatabase({ ...base, runPrisma: () => ({ exitCode: 0, events: [
    { kind: "result", envelope: { ok: true, result: { ok: true, mode: "marker-only",
      schema: { summary: "skipped", issues: [] }, meta: { schemaVerification: "skipped" } } } },
  ], stdout: "", stderr: "" }) });
  assert.equal(skipped.status, "BLOCKED");
  assert.equal(skipped.canonical.issueCount, 0);
});
