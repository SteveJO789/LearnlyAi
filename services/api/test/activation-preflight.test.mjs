import assert from "node:assert/strict";
import test from "node:test";
import { activationTargetError, inspectActivationSchema } from "../dist/shared/activation-schema-readiness.js";

test("activation preflight requires an exact local database identity", () => {
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@localhost/learnly_test",
    target: "local", expectedDatabase: "learnly_test" }), undefined);
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@localhost/learnly_test?host=db.example",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@localhost/learnly_test?dbname=other",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@db.example/learnly_test",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@localhost/other",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@localhost/learnly_test",
    target: "local" }), "INVALID_ARGUMENTS");
});

test("remote read-only preflight requires an explicit expected host or project identity", () => {
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@ref.supabase.co/postgres",
    target: "remote", expectedDatabase: "postgres", expectedProject: "ref" }), undefined);
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@wrong.supabase.co/postgres",
    target: "remote", expectedDatabase: "postgres", expectedProject: "ref" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://u:p@ref.supabase.co/postgres",
    target: "remote", expectedDatabase: "postgres" }), "INVALID_ARGUMENTS");
});

function catalogClient() {
  const statements = [];
  return {
    statements,
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes("current_setting('server_version_num')")) return { rows: [{ version: 170000 }] };
      if (sql.includes("to_regclass('prisma_contract.marker')")) return { rows: [{ exists: false }] };
      if (sql.includes("FROM storage.buckets WHERE id = 'learnly-materials'")) return { rows: [{
        id: "learnly-materials", public: true, fileSizeLimit: 3145728,
        allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      }] };
      if (sql.includes("to_regclass('storage.buckets')")) return { rows: [{ exists: true }] };
      return { rows: [] };
    },
  };
}

test("runtime activation inspection uses app-visible catalogs and skips private bucket rows", async () => {
  const client = catalogClient();
  const result = await inspectActivationSchema(client, { uploads: true, catalogMode: "runtime" });
  const sql = client.statements.map(statement => statement.sql).join("\n");

  assert.match(sql, /FROM pg_attribute/);
  assert.match(sql, /has_table_privilege\('authenticated'/);
  assert.doesNotMatch(sql, /information_schema\.(?:columns|table_privileges)/);
  assert.doesNotMatch(sql, /to_reg(?:class|namespace)\('(public|storage)\./);
  assert.doesNotMatch(sql, /has_(?:table|schema)_privilege\('authenticated',\s*'(public|storage)\./);
  assert.doesNotMatch(sql, /FROM storage\.buckets/);
  assert.equal(result.findings.some(item => item.id === "uploads.bucket"), false);
});

test("default operator inspection retains strict bucket checks and reports bucket drift", async () => {
  const client = catalogClient();
  const result = await inspectActivationSchema(client, { uploads: true });
  const sql = client.statements.map(statement => statement.sql).join("\n");

  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /information_schema\.table_privileges/);
  assert.match(sql, /FROM storage\.buckets/);
  assert.equal(result.findings.find(item => item.id === "uploads.bucket")?.status, "BLOCKED");
});
