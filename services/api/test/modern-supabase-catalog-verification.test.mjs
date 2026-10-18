import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sourceSignatures from "../scripts/lib/modern-supabase-catalog-source-signatures.json" with { type: "json" };
import { verifyModernSupabaseCatalogSupplement, verifyModernSupabaseCatalogSupplementMetadata } from "../scripts/lib/verify-modern-supabase-catalog.mjs";

function matchingMetadata() {
  return Object.fromEntries(["generatedColumns", "indexes", "constraints", "functions", "triggers"]
    .map(category => [category, structuredClone(sourceSignatures[category])]));
}

test("supplemental signatures retain byte-verified official SQL and the independently executed source fixture", async () => {
  for (const [name, expected] of Object.entries(sourceSignatures.sourceFixture.sourceSqlSha256)) {
    const primary = name.startsWith("auth/") ? name : `storage/${name}`;
    let bytes;
    try { bytes = await readFile(new URL(`./fixtures/modern-supabase-source/${primary}`, import.meta.url)); }
    catch { bytes = await readFile(new URL(`./fixtures/modern-supabase-supplemental-source/${name}`, import.meta.url)); }
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, name);
  }
  const execution = await readFile(new URL("../docs/evidence/production-rehearsal-official-source-fixture-execution.json", import.meta.url));
  assert.equal(createHash("sha256").update(execution).digest("hex"), sourceSignatures.sourceFixture.executionEvidenceSha256);
  const proof = JSON.parse(execution);
  assert.equal(proof.status, "PASS");
  assert.equal(proof.migrations.length, 148);
});

function fakeClient({ version = 170006, failQuery } = {}) {
  const calls = [];
  const client = {
    calls,
    async connect() { calls.push("CONNECT"); },
    async query(sql) {
      calls.push(sql);
      if (failQuery && sql === failQuery) throw new Error("fixture query failure");
      if (sql.includes("server_version_num")) return { rows: [{ version }] };
      if (sql.includes("FROM pg_attribute")) return { rows: matchingMetadata().generatedColumns };
      if (sql.includes("FROM pg_index")) return { rows: matchingMetadata().indexes };
      if (sql.includes("FROM pg_constraint")) return { rows: matchingMetadata().constraints };
      if (sql.includes("FROM pg_proc")) return { rows: matchingMetadata().functions };
      if (sql.includes("FROM pg_trigger")) return { rows: matchingMetadata().triggers };
      return { rows: [] };
    },
    async end() { calls.push("END"); },
  };
  return client;
}

test("source-bound modern catalog signatures pass and any SDK-gap metadata change blocks", () => {
  const pass = verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual: matchingMetadata(), expected: sourceSignatures });
  assert.equal(pass.status, "PASS");
  assert.equal(pass.findings.length, 5);

  for (const category of ["generatedColumns", "indexes", "constraints", "functions", "triggers"]) {
    const actual = matchingMetadata();
    const field = Object.keys(actual[category][0]).find(key => !["schema", "table", "column", "name", "identityArgs"].includes(key));
    actual[category][0][field] = typeof actual[category][0][field] === "boolean" ? !actual[category][0][field] : "changed";
    const result = verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual, expected: sourceSignatures });
    assert.equal(result.status, "BLOCKED", category);
    assert.equal(result.findings.find(item => item.id === `catalog.modern.${category}`).code, "SOURCE_SIGNATURE_MISMATCH");
  }
});

test("modern catalog checker fails closed for unsupported PostgreSQL and incomplete or changed source provenance", () => {
  assert.equal(verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 16, actual: matchingMetadata(), expected: sourceSignatures })
    .findings[0].code, "UNSUPPORTED_POSTGRES_VERSION");

  const missing = structuredClone(sourceSignatures);
  missing.constraints = undefined;
  assert.equal(verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual: matchingMetadata(), expected: missing })
    .findings[0].code, "SOURCE_SIGNATURES_UNAVAILABLE");

  const unpinnedSource = structuredClone(sourceSignatures);
  unpinnedSource.sourceFixture.sourceSqlSha256["0065-objects-key-version-index.sql"] = "0".repeat(64);
  assert.equal(verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual: matchingMetadata(), expected: unpinnedSource })
    .findings[0].code, "SOURCE_SIGNATURES_UNAVAILABLE");

  // An accidentally shortened manifest must not approve an equally incomplete target.
  const shortened = structuredClone(sourceSignatures);
  shortened.generatedColumns.pop();
  const shortenedActual = matchingMetadata();
  shortenedActual.generatedColumns.pop();
  assert.equal(verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual: shortenedActual, expected: shortened })
    .findings[0].code, "SOURCE_SIGNATURES_UNAVAILABLE");

  const forged = structuredClone(sourceSignatures);
  forged.functions[0].securityDefiner = !forged.functions[0].securityDefiner;
  const forgedActual = matchingMetadata();
  forgedActual.functions = structuredClone(forged.functions);
  assert.equal(verifyModernSupabaseCatalogSupplementMetadata({ postgresMajor: 17, actual: forgedActual, expected: forged })
    .findings[0].code, "SOURCE_SIGNATURES_UNAVAILABLE");
});

test("database inspection starts a repeatable read-only transaction and never continues after PG version rejection", async () => {
  const connected = fakeClient();
  const result = await verifyModernSupabaseCatalogSupplement({
    connectionString: "postgresql://unit:secret@127.0.0.1/source-fixture",
    clientFactory: () => connected,
  });
  assert.equal(result.status, "PASS");
  assert.equal(connected.calls[1], "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(connected.calls[2], "SET LOCAL search_path = public, extensions");
  assert.equal(connected.calls.at(-2), "COMMIT");
  assert.equal(connected.calls.at(-1), "END");
  assert.equal(connected.calls.filter(sql => typeof sql === "string" && sql.startsWith("SELECT ")).length, 6);
  assert.equal(JSON.stringify(result).includes("secret"), false);

  const unsupported = fakeClient({ version: 160000 });
  const rejected = await verifyModernSupabaseCatalogSupplement({ connectionString: "fixture", clientFactory: () => unsupported });
  assert.equal(rejected.status, "BLOCKED");
  assert.equal(rejected.findings[0].code, "UNSUPPORTED_POSTGRES_VERSION");
  assert.equal(unsupported.calls.at(-2), "ROLLBACK");
  assert.equal(unsupported.calls.includes("SELECT 1"), false);
});

test("database connection and read-only query failures block with bounded findings", async () => {
  const missing = await verifyModernSupabaseCatalogSupplement({ connectionString: "" });
  assert.equal(missing.findings[0].code, "DATABASE_URL_MISSING");

  const failed = fakeClient({ failQuery: "SET LOCAL search_path = public, extensions" });
  const unavailable = await verifyModernSupabaseCatalogSupplement({ connectionString: "fixture", clientFactory: () => failed });
  assert.equal(unavailable.status, "BLOCKED");
  assert.equal(unavailable.findings[0].code, "DATABASE_UNAVAILABLE");
  assert.equal(failed.calls.at(-2), "ROLLBACK");
});
