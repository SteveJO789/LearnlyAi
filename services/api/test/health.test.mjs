import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createApp } from "../dist/app.js";

async function withTestServer(run) {
  const server = createApp().listen(0, "127.0.0.1");
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

test("GET /health/ready reports the API readiness check", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(baseUrl + "/health/ready");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        status: "ready",
        checks: {
          api: "ok",
        },
      },
    });
  });
});
