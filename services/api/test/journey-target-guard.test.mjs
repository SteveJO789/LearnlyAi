import assert from "node:assert/strict";
import test from "node:test";
import { requireLocalAuth, requireLocalDatabase } from "../scripts/journey-target-guard.mjs";

const phaseADatabase = "learnly_activation_executor_phase_a_services_20261017";
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
