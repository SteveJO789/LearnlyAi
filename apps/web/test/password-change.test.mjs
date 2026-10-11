import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const supabase = require('../.web-test-build/lib/supabase.js'), passwords = require('../.web-test-build/lib/password-change.js');
const { PasswordChangeForm } = require('../.web-test-build/app/components/password-change-form.js');
const originalMain = supabase.getSupabaseClient, originalIsolated = supabase.createIsolatedPasswordClient;
const originalFetch = globalThis.fetch;
afterEach(() => { supabase.getSupabaseClient = originalMain; supabase.createIsolatedPasswordClient = originalIsolated; globalThis.fetch = originalFetch; });
const user = { id: 'expected-user', email: 'synthetic@example.invalid', identities: [{ provider: 'email' }] };
function harness({ noUser, signInError, differentUser, updateError, updateThrow, cleanupThrow, oauthOnly } = {}) {
  const calls = [];
  supabase.getSupabaseClient = () => ({ auth: {
    getUser: async () => { calls.push(['lookup']); return { data: { user: noUser ? null : oauthOnly ? { ...user, identities: [{ provider: 'google' }] } : user }, error: null }; },
    signInWithPassword: () => assert.fail('must never change browser login'), updateUser: () => assert.fail('must bind isolated actor'), signOut: () => assert.fail('must never sign out main browser'),
  } });
  supabase.createIsolatedPasswordClient = () => ({ auth: {
    signInWithPassword: async value => { calls.push(['verify', value]); return { data: { user: differentUser ? { ...user, id: 'other' } : user }, error: signInError }; },
    updateUser: async value => { calls.push(['update', value]); if (updateThrow) throw updateThrow; return { data: { user }, error: updateError }; },
    signOut: async value => { calls.push(['signOut', value]); if (cleanupThrow) throw cleanupThrow; return { error: null }; },
    stopAutoRefresh: async () => { calls.push(['stop']); },
  } });
  return calls;
}
test('password mutation verifies exact actor/current password in isolated Auth client and never replaces browser session', async () => {
  const calls = harness(); await passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret');
  assert.deepEqual(calls.map(call => call[0]), ['lookup', 'verify', 'update', 'signOut', 'stop']);
  assert.deepEqual(calls[1][1], { email: user.email, password: 'old-secret' });
  assert.deepEqual(calls[2][1], { password: 'new-secret', current_password: 'old-secret' });
  assert.deepEqual(calls[3][1], { scope: 'local' });
});
test('invalid inputs/guest/OAuth-only/wrong current/identity mismatch cannot change a password', async () => {
  for (const args of [['', 'new-secret', 'new-secret'], ['old', 'short', 'short'], ['old', 'new-secret', 'different']]) {
    const calls = harness(); await assert.rejects(passwords.changeCurrentUserPassword(...args)); assert.equal(calls.length, 0);
  }
  for (const [config, code] of [[{ noUser: true }, 'AUTH_REQUIRED'], [{ oauthOnly: true, signInError: { code: 'invalid_credentials' } }, 'OAUTH_ONLY'],
    [{ signInError: { code: 'invalid_credentials', message: 'secret-upstream' } }, 'CURRENT_INVALID'], [{ differentUser: true }, 'IDENTITY_CHANGED']]) {
    const calls = harness(config);
    await assert.rejects(passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret'), error => error.code === code && !error.message.includes('secret'));
    assert.ok(!calls.some(call => call[0] === 'update'));
  }
  const linked = harness({ oauthOnly: true }); await passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret');
  assert.ok(linked.some(call => call[0] === 'update')); // Identity metadata alone does not prove absence of a valid password.
});
test('Auth rejection and ambiguous mutation are distinct, never fake success/retry and always clean temporary session', async () => {
  for (const [config, code] of [[{ updateError: { code: 'weak_password', message: 'raw-secret' } }, 'WEAK_PASSWORD'],
    [{ updateError: { code: 'same_password' } }, 'SAME_PASSWORD'], [{ updateError: { code: 'over_request_rate_limit' } }, 'RATE_LIMITED'],
    [{ updateError: { code: 'reauthentication_needed' } }, 'REAUTH_REQUIRED'], [{ updateThrow: Error('token-secret') }, 'UNKNOWN_OUTCOME']]) {
    const calls = harness(config);
    await assert.rejects(passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret'), error => error.code === code && !error.message.includes('secret'));
    assert.equal(calls.filter(call => call[0] === 'update').length, 1); assert.equal(calls.at(-2)[0], 'signOut'); assert.equal(calls.at(-1)[0], 'stop');
  }
  const calls = harness({ cleanupThrow: Error('cleanup-secret') }); await passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret');
  assert.equal(calls.at(-1)[0], 'stop');
});
test('stalled readonly account lookup times out before verification or mutation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  supabase.getSupabaseClient = () => ({ auth: { getUser: () => new Promise(() => {}) } });
  supabase.createIsolatedPasswordClient = () => assert.fail('no mutation client after stalled lookup');
  const request = passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret');
  t.mock.timers.tick(20001); await assert.rejects(request, error => error.code === 'UNAVAILABLE');
});
test('actual password form has labelled required password/autocomplete fields and never initially shows fake success', () => {
  const html = renderToStaticMarkup(React.createElement(PasswordChangeForm, { language: 'th' }));
  assert.match(html, /for="password-current"/); assert.match(html, /for="password-next"/); assert.match(html, /for="password-confirm"/);
  assert.match(html, /autoComplete="current-password"/); assert.match(html, /autoComplete="new-password"/);
  assert.equal((html.match(/type="password"/g) ?? []).length, 3); assert.match(html, /required/);
  assert.doesNotMatch(html, /เปลี่ยนรหัสผ่านเรียบร้อยแล้ว/);
});

test('installed Supabase SDK/factory executes password protocol with isolated memory session, exact user JWT and local-only cleanup (offline transport)', async t => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://synthetic-password.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'synthetic-public-key';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  });
  const now = Math.floor(Date.now() / 1000), actor = { ...user, aud: 'authenticated', role: 'authenticated', created_at: '2026-01-01T00:00:00Z' };
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: actor.id, role: 'authenticated', exp: now + 3600, iat: now })).toString('base64url'), 'offline-signature'].join('.');
  const calls = [];
  const transportErrors = [];
  globalThis.fetch = async (url, init) => { try {
    assert.ok(String(url).startsWith('https://synthetic-password.supabase.co/auth/v1/'));
    assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal); calls.push({ url: String(url), init });
    if (String(url).includes('/token?grant_type=password')) {
      assert.deepEqual(JSON.parse(init.body), { email: actor.email, password: 'old-secret', gotrue_meta_security: {} });
      return Response.json({ access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user: actor });
    }
    if (String(url).endsWith('/user')) {
      assert.equal(init.method, 'PUT'); assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer ' + token);
      const payload = JSON.parse(init.body);
      assert.equal(payload.password, 'new-secret'); assert.equal(payload.current_password, 'old-secret');
      assert.deepEqual(Object.keys(payload).sort(), ['code_challenge', 'code_challenge_method', 'current_password', 'password']);
      assert.equal(payload.code_challenge, null); assert.equal(payload.code_challenge_method, null);
      return Response.json(actor);
    }
    assert.ok(String(url).endsWith('/logout?scope=local')); return new Response(null, { status: 204 });
  } catch (error) { transportErrors.push({ message: error.message.split('\n')[0], path: new URL(String(url)).pathname,
    method: init.method, bodyKeys: init.body ? Object.keys(JSON.parse(init.body)) : [] }); throw Error('Offline transport expectation failed'); } };
  supabase.getSupabaseClient = () => ({ auth: { getUser: async () => ({ data: { user: actor }, error: null }) } });
  supabase.createIsolatedPasswordClient = originalIsolated;
  let failure; try { await passwords.changeCurrentUserPassword('old-secret', 'new-secret', 'new-secret'); } catch (error) { failure = error; }
  assert.deepEqual(transportErrors, []); if (failure) throw failure;
  assert.equal(calls.length, 3);
});
