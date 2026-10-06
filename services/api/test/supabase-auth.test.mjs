import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { requireSupabaseUser } from "../dist/modules/auth/supabase-auth.js";

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
  assert.deepEqual(request.authUser, {
    id: "user-123",
    email: "student@example.com",
    displayName: "Student Name",
    avatarUrl: "https://example.com/avatar.png",
  });
});
