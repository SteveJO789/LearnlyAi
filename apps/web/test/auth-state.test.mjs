import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isCurrentInitialAuthCheck, readInitialAuthState } = require('../.web-test-build/lib/auth-state.js');

test('initial auth check distinguishes no session from returned and thrown SDK errors', async () => {
  assert.deepEqual(await readInitialAuthState({ getSession: async () => ({ data: { session: { user: { id: 'u1' } } }, error: null }) }), { status: 'authenticated', userId: 'u1' });
  assert.deepEqual(await readInitialAuthState({ getSession: async () => ({ data: { session: null }, error: null }) }), { status: 'unauthenticated' });
  assert.deepEqual(await readInitialAuthState({ getSession: async () => ({ data: { session: null }, error: new Error('offline') }) }), { status: 'error' });
  assert.deepEqual(await readInitialAuthState({ getSession: async () => { throw new Error('offline'); } }), { status: 'error' });
});

test('an auth event makes a pending initial session result stale', () => {
  assert.equal(isCurrentInitialAuthCheck(3, 3), true);
  assert.equal(isCurrentInitialAuthCheck(3, 4), false);
});
