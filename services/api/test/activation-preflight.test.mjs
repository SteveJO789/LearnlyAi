import assert from "node:assert/strict";
import test from "node:test";
import { activationTargetError } from "../dist/shared/activation-schema-readiness.js";

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
