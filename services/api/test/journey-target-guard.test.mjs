import assert from "node:assert/strict";
import test from "node:test";
import { requireLocalAuth, requireLocalDatabase } from "../scripts/journey-target-guard.mjs";

const phaseADatabase = "learnly_activation_executor_phase_a_services_20261017";
const productionRehearsalDatabase = "learnly_production_rehearsal_20261017";
const caPath = "/workspace/learnly-activation-runtime/certs/local-cert.pem";

test("journey target guard accepts only the explicitly named Phase A database at the fixture endpoint", () => {
  const args = ["--local-supabase-fixture", `--expect-database=${phaseADatabase}`];
  assert.deepEqual(requireLocalDatabase(`postgresql://postgres:secret@127.0.0.1:55434/${phaseADatabase}`, args), {
    databaseName: phaseADatabase,
    value: `postgresql://postgres:secret@127.0.0.1:55434/${phaseADatabase}`,
    isolatedSupabaseDb: true,
    phaseAFixtureDb: true,
  });
  assert.throws(() => requireLocalDatabase("postgresql://postgres@127.0.0.1:55434/postgres", args));
  assert.throws(() => requireLocalDatabase("postgresql://postgres@127.0.0.1:55434/other", args));
  assert.throws(() => requireLocalDatabase(`postgresql://postgres@127.0.0.1:55434/${phaseADatabase}`,
    ["--local-supabase-fixture", "--expect-database=other"]));
  assert.throws(() => requireLocalDatabase("postgresql://postgres@127.0.0.1:55432/learnly_activation_journey_test",
    ["--expect-database=other"]));
});

test("Phase A real storage requires its exact TLS gateway and the pinned CA; legacy mode remains accepted", () => {
  assert.equal(requireLocalAuth("https://127.0.0.1:54444", {
    realStorageMode: true, phaseAFixtureDb: true, extraCaCerts: caPath,
  }), "https://127.0.0.1:54444");
  assert.throws(() => requireLocalAuth("https://127.0.0.1:54444", {
    realStorageMode: true, phaseAFixtureDb: true, extraCaCerts: "/tmp/other.pem",
  }));
  assert.throws(() => requireLocalAuth("https://127.0.0.1:54444", {
    realStorageMode: true, phaseAFixtureDb: false, extraCaCerts: caPath,
  }));
  assert.equal(requireLocalAuth("https://127.0.0.1:54443", { realStorageMode: true, extraCaCerts: caPath }),
    "https://127.0.0.1:54443");
});

test("production rehearsal accepts only its explicitly named loopback database and dedicated gateway", () => {
  const args = ["--production-rehearsal-fixture", `--expect-database=${productionRehearsalDatabase}`];
  const databaseUrl = `postgresql://postgres:secret@127.0.0.1:55435/${productionRehearsalDatabase}`;
  assert.deepEqual(requireLocalDatabase(databaseUrl, args), {
    databaseName: productionRehearsalDatabase,
    value: databaseUrl,
    isolatedSupabaseDb: true,
    phaseAFixtureDb: false,
    productionRehearsalDb: true,
  });
  assert.throws(() => requireLocalDatabase(databaseUrl, ["--production-rehearsal-fixture"]));
  assert.throws(() => requireLocalDatabase(databaseUrl, ["--production-rehearsal-fixture", "--expect-database=other"]));
  assert.throws(() => requireLocalDatabase(databaseUrl, ["--production-rehearsal-fixture", "--local-supabase-fixture", `--expect-database=${productionRehearsalDatabase}`]));
  assert.throws(() => requireLocalDatabase(databaseUrl, ["--expect-database=" + productionRehearsalDatabase]));
  assert.throws(() => requireLocalDatabase(`postgresql://postgres@db.example:55435/${productionRehearsalDatabase}`, args));
  assert.throws(() => requireLocalDatabase(`postgresql://postgres@127.0.0.1:55434/${productionRehearsalDatabase}`, args));
  assert.throws(() => requireLocalDatabase(`postgresql://postgres@127.0.0.1:55435/other`, args));
  assert.throws(() => requireLocalDatabase(`${databaseUrl}?sslmode=disable`, args));
  assert.throws(() => requireLocalDatabase(`${databaseUrl}#fragment`, args));
});

test("production rehearsal real Storage requires its exact HTTPS gateway and pinned CA", () => {
  assert.equal(requireLocalAuth("https://127.0.0.1:54445", {
    realStorageMode: true, productionRehearsalDb: true, extraCaCerts: caPath,
  }), "https://127.0.0.1:54445");
  for (const [url, extraCaCerts, productionRehearsalDb, realStorageMode = true] of [
    ["https://example.com:54445", caPath, true],
    ["https://127.0.0.1:54444", caPath, true],
    ["https://127.0.0.1:54446", caPath, true],
    ["https://127.0.0.1:54445/path", caPath, true],
    ["https://127.0.0.1:54445?x=1", caPath, true],
    ["https://127.0.0.1:54445", "/tmp/other.pem", true],
    ["https://127.0.0.1:54445", caPath, false],
    ["https://127.0.0.1:54443", caPath, true],
    ["http://127.0.0.1:59999", caPath, true],
    ["http://127.0.0.1:59997", caPath, true],
    ["https://127.0.0.1:54445", caPath, true, false],
  ]) {
    assert.throws(() => requireLocalAuth(url, { realStorageMode, productionRehearsalDb, extraCaCerts }));
  }
});
