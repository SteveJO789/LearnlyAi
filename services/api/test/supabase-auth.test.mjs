import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { requireSupabaseUser, createSupabaseAuthenticator } from "../dist/modules/auth/supabase-auth.js";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;

  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
});

test("auth outage/rate limit are controlled 503 rather than invalid-login 401", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  for (const status of [429, 500, 503]) {
    const authenticate = createSupabaseAuthenticator({ fetch: async () => new Response("sensitive error", { status }) });
    const request = makeRequest("Bearer token-secret");
    const response = makeResponse();
    await authenticate(request, response, () => assert.fail("auth must fail closed"));
    assert.equal(response.statusCode, 503);
    assert.equal(response.body.error.code, "AUTH_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(response.body), /token-secret|sensitive error/);
  }
});

test("auth request has a bounded abort deadline and no credential-bearing failure", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  const authenticate = createSupabaseAuthenticator({ timeoutMs: 15, fetch: async (_url, init) => {
    assert.ok(init.signal instanceof AbortSignal);
    return new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error("timeout did not abort")), 1000);
      init.signal.addEventListener("abort", () => {
        clearTimeout(keepAlive);
        reject(new Error("token-secret cookie-secret email@example.com"));
      }, { once: true });
    });
  } });
  const response = makeResponse();
  await authenticate(makeRequest("Bearer token-secret"), response, () => assert.fail("must fail closed"));
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, "AUTH_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(response.body), /token-secret|cookie-secret|email@example.com/);
});

function makeRequest(authorization) {
  return {
    authUser: undefined,
    header(name) {
      if (name.toLowerCase() === "authorization") return authorization;
      return undefined;
    },
  };
}

function makeResponse() {
  return {
    locals: { requestId: "req-test" },
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("Supabase auth middleware rejects requests without a bearer token", async () => {
  const request = makeRequest(undefined);
  const response = makeResponse();
  let nextCalled = false;

  await requireSupabaseUser(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "UNAUTHORIZED");
  assert.equal(response.body.error.requestId, "req-test");
  assert.equal(nextCalled, false);
});

test("Supabase auth middleware rejects an invalid or expired token", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";

  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://example.supabase.co/auth/v1/user");
    assert.equal(init.headers.authorization, "Bearer bad-token");
    assert.equal(init.headers.apikey, "publishable-test-key");
    return new Response("{}", { status: 401 });
  };

  const request = makeRequest("Bearer bad-token");
  const response = makeResponse();
  let nextCalled = false;

  await requireSupabaseUser(request, response, () => {
    nextCalled = true;
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error.code, "UNAUTHORIZED");
  assert.equal(nextCalled, false);
});

test("Supabase auth middleware exposes normalized authenticated user context", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co/";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";

  globalThis.fetch = async () =>
    Response.json({
      id: "user-123",
      email: "student@example.com",
      user_metadata: {
        full_name: "Student Name",
        avatar_url: "https://example.com/avatar.png",
      },
    });

  const request = makeRequest("Bearer good-token");
  const response = makeResponse();
  let nextCalled = false;

  await requireSupabaseUser(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.authToken, "good-token");
  assert.deepEqual(request.authUser, {
    id: "user-123",
    email: "student@example.com",
    displayName: "Student Name",
    avatarUrl: "https://example.com/avatar.png",
  });
});
