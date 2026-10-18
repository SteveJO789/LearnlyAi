import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { AuthApiError, AuthSessionMissingError } = require('@supabase/supabase-js');
const supabase = require('../.web-test-build/lib/supabase.js');
const profile = require('../.web-test-build/lib/user-profile.js');
const original = supabase.getSupabaseClient;
afterEach(() => { supabase.getSupabaseClient = original; });

function clientForAuthError(error, session = { user: { id: 'auth-user' }, access_token: 'fixture-token' }) {
  const calls = [];
  supabase.getSupabaseClient = () => ({
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: null }, error }),
      signOut: async (options) => { calls.push(options); return { error: null }; },
    },
    from: () => assert.fail('Auth rejection must be resolved before profile lookup'),
  });
  return calls;
}

test('confirmed missing or invalid Auth sessions clear via SDK local signOut and return null', async () => {
  for (const error of [
    new AuthSessionMissingError(),
    new AuthApiError('JWT rejected', 401, 'bad_jwt'),
    new AuthApiError('User missing', 400, 'user_not_found'),
  ]) {
    const calls = clientForAuthError(error, error instanceof AuthSessionMissingError ? null : undefined);
    assert.equal(await profile.getCurrentUserProfile(), null);
    assert.deepEqual(calls, [{ scope: 'local' }]);
  }
});

test('network, Auth server failures, and profile database errors remain retryable failures', async () => {
  for (const error of [new Error('network unavailable'), new AuthApiError('Auth unavailable', 503, 'server_error')]) {
    const calls = clientForAuthError(error);
    await assert.rejects(profile.getCurrentUserProfile());
    assert.deepEqual(calls, []);
  }

  let signOutCalls = 0;
  supabase.getSupabaseClient = () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'auth-user' }, access_token: 'fixture-token' } }, error: null }),
      getUser: async () => ({ data: { user: { id: 'auth-user', email: 'learner@example.invalid', user_metadata: {} } }, error: null }),
      signOut: async () => { signOutCalls++; return { error: null }; },
    },
    from: () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: new Error('profile RLS denied') }) };
      return query;
    },
  });
  await assert.rejects(profile.getCurrentUserProfile(), /profile RLS denied/);
  assert.equal(signOutCalls, 0);
});

test('a late bad_jwt response for account A cannot sign out the newly active account B', async () => {
  let currentSession = { user: { id: 'account-a' }, access_token: 'token-a' };
  let finishFirstAuthRequest;
  let authRequests = 0;
  let signOutCalls = 0;
  supabase.getSupabaseClient = () => ({
    auth: {
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      getUser: async () => {
        authRequests++;
        if (authRequests === 1) return new Promise((resolve) => { finishFirstAuthRequest = resolve; });
        return { data: { user: { id: 'account-b', email: 'b@example.invalid', user_metadata: {} } }, error: null };
      },
      signOut: async () => { signOutCalls++; return { error: null }; },
    },
    from: () => {
      const query = { select: () => query, eq: (_key, value) => { assert.equal(value, 'account-b'); return query; }, maybeSingle: async () => ({ data: { id: 'profile-b', email: 'b@example.invalid', displayName: 'B', avatarUrl: null }, error: null }) };
      return query;
    },
  });

  const pendingProfile = profile.getCurrentUserProfile();
  await Promise.resolve();
  currentSession = { user: { id: 'account-b' }, access_token: 'token-b' };
  finishFirstAuthRequest({ data: { user: null }, error: new AuthApiError('JWT rejected', 401, 'bad_jwt') });

  assert.equal((await pendingProfile).id, 'profile-b');
  assert.equal(signOutCalls, 0);
  assert.equal(authRequests, 2);
});
