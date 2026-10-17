import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createApp } from "../dist/app.js";
import { activationTargetError } from "../dist/shared/activation-schema-readiness.js";

async function withTestServer(run, options = {}) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    await run("http://127.0.0.1:" + address.port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test("GET /health/live returns the liveness envelope", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/health/live");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        status: "ok",
      },
    });
  });
});

test("GET /health/ready reports only the dependencies that were actually checked", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/health/ready");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        status: "ready",
        checks: {
          api: "ok",
          database: "ok",
          knowledge: "ok",
          authConfiguration: "ok",
        },
      },
    });
  }, { readiness: {
    database: async () => {}, knowledge: async () => {}, authConfiguration: async () => {},
  } });
});

test("readiness failure is 503, excludes raw errors, and liveness remains independent", async () => {
  await withTestServer(async base => {
    const response = await fetch(base + "/health/ready");
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.deepEqual(payload.data, { status: "not_ready", checks: {
      api: "ok", database: "failed", knowledge: "failed", authConfiguration: "ok",
    } });
    assert.doesNotMatch(JSON.stringify(payload), /secret|password|student@example/);
    assert.equal((await fetch(base + "/health/live")).status, 200);
  }, { readiness: {
    database: async () => { throw new Error("password-secret"); },
    knowledge: async () => { throw new Error("student@example"); },
    authConfiguration: async () => {},
  } });
});

test("stalled readiness probe receives an abort signal and cannot hang the HTTP response", async () => {
  let signal;
  await withTestServer(async base => {
    const response = await fetch(base + "/health/ready");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).data.checks.database, "failed");
    assert.equal(signal.aborted, true);
  }, { readiness: {
    timeoutMs: 20,
    database: async abort => { signal = abort; return new Promise(() => {}); },
    knowledge: async () => {}, authConfiguration: async () => {},
  } });
});

test('vector index failure is reported separately without exposing errors or claiming provider availability', async () => {
  await withTestServer(async base => {
    const response = await fetch(base + '/health/ready'); assert.equal(response.status, 503);
    const data = (await response.json()).data;
    assert.equal(data.checks.vectorIndex, 'failed'); assert.equal(data.checks.database, 'ok');
    assert.doesNotMatch(JSON.stringify(data), /provider|secret|raw-index|question/);
    assert.equal((await fetch(base + '/health/live')).status, 200);
  }, { readiness: { database: async () => {}, knowledge: async () => {}, authConfiguration: async () => {},
    vectorIndex: async () => { throw Error('raw-index-question-secret'); } } });
});

test("assessment readiness checks are added only when the feature is active", async () => {
  let called = 0;
  await withTestServer(async base => {
    const response = await fetch(base + "/health/ready");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.checks.assessmentSchema, "ok");
    assert.equal(called, 1);
  }, { features: { assessments: true, fileUploads: false }, readiness: {
    database: async () => {}, knowledge: async () => {}, authConfiguration: async () => {},
    assessmentSchema: async () => { called += 1; },
  } });
  await withTestServer(async base => {
    const response = await fetch(base + "/health/ready");
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.checks.assessmentSchema, undefined);
  }, { features: { assessments: false, fileUploads: false }, readiness: {
    database: async () => {}, knowledge: async () => {}, authConfiguration: async () => {},
    assessmentSchema: async () => { throw new Error("disabled probe ran"); },
  } });
});

test("local activation preflight rejects non-loopback database targets before connecting", async () => {
  assert.equal(activationTargetError({ connectionString: "postgresql://user:password@db.example.com/learnly_test",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://user:password@localhost/other",
    target: "local", expectedDatabase: "learnly_test" }), "DATABASE_TARGET_MISMATCH");
  assert.equal(activationTargetError({ connectionString: "postgresql://user:password@localhost/learnly_test",
    target: "local", expectedDatabase: "learnly_test" }), undefined);
  assert.equal(activationTargetError({ connectionString: "postgresql://user:password@projectref.supabase.co/postgres",
    target: "remote", expectedDatabase: "postgres", expectedProject: "projectref" }), undefined);
});
