import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { withTestServer } from "./learning-test-helpers.mjs";
import { logSessionLoadFailure } from "../dist/shared/safe-diagnostics.js";

const env = { NODE_ENV: process.env.NODE_ENV, VERCEL: process.env.VERCEL };
afterEach(() => {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

for (const mode of ["default", "production", "vercel-preview"]) {
  test(`development AI routes are unreachable in ${mode}`, async () => {
    if (mode === "production") process.env.NODE_ENV = "production";
    if (mode === "vercel-preview") process.env.VERCEL = "1";
    let calls = 0;
    await withTestServer({
      enableDevelopmentLearningRoute: mode !== "default",
      learningEngine: { process: async () => { calls++; throw new Error("Must not run"); } },
    }, async (base) => {
      for (const path of ["/api/learning/respond", "/api/v1/learning/respond"]) {
        const response = await fetch(base + path, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: "victim-session", input: "question" }),
        });
        assert.equal(response.status, 404);
        const payload = await response.json();
        assert.equal(payload.error.code, "NOT_FOUND");
        assert.equal(payload.error.requestId, response.headers.get("x-request-id"));
      }
      const protectedResponse = await fetch(base + "/api/v1/learning-sessions");
      assert.equal(protectedResponse.status, 401);
    });
    assert.equal(calls, 0);
  });
}

test("session failure diagnostics expose only a generated request id and fixed phase", () => {
  const entries = [];
  const original = console.error;
  console.error = (...args) => entries.push(args);
  try { logSessionLoadFailure("generated-id", "messages"); }
  finally { console.error = original; }
  assert.deepEqual(entries, [["[learning-session-detail] failed", {
    requestId: "generated-id", phase: "messages",
  }]]);
});
