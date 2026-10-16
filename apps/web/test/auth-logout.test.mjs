import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const supabase = require('../.web-test-build/lib/supabase.js');
const authState = require('../.web-test-build/lib/auth-state.js');
const { signOutCurrentUser, SignOutFailure, takeLogoutNotice, LOGOUT_LOCAL_ONLY_NOTICE, LOGOUT_UNCONFIRMED_NOTICE, LOGOUT_NOTICE_EVENT } = authState;
const original = supabase.getSupabaseClient;
const originalWindow = globalThis.window;
afterEach(() => { supabase.getSupabaseClient = original; if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow; });

function fakeWindow() {
  const values = new Map();
  const events = new EventTarget();
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    dispatchEvent: (event) => events.dispatchEvent(event),
    addEventListener: events.addEventListener.bind(events),
  };
  return values;
}

test('logout resolves only after Supabase returns success', async () => {
  let calls = 0;
  const values = fakeWindow();
  values.set('learnlyai.logout.notice', '{"createdAt":1,"message":"old notice"}');
  supabase.getSupabaseClient = () => ({ auth: { signOut: async () => { calls++; return { error: null }; } } });
  await signOutCurrentUser();
  assert.equal(calls, 1);
  assert.equal(values.has('learnlyai.logout.notice'), false, 'success clears any old notice');
});

test('logout error records a bounded notice when local session was removed', async () => {
  fakeWindow();
  let eventMessage;
  window.addEventListener(LOGOUT_NOTICE_EVENT, (event) => { eventMessage = event.detail; });
  supabase.getSupabaseClient = () => ({ auth: { signOut: async () => ({ error: new Error('upstream failure') }), getSession: async () => ({ data: { session: null }, error: null }) } });
  await assert.rejects(signOutCurrentUser(), (error) => error instanceof SignOutFailure && error.localSessionCleared);
  assert.equal(eventMessage, LOGOUT_LOCAL_ONLY_NOTICE);
  assert.equal(takeLogoutNotice(), LOGOUT_LOCAL_ONLY_NOTICE);
  assert.equal(takeLogoutNotice(), null, 'notice is consumed once');
});

test('logout failure with a retained or unknown session reports uncertainty without claiming local sign-out', async () => {
  fakeWindow();
  supabase.getSupabaseClient = () => ({ auth: { signOut: async () => { throw new Error('offline'); }, getSession: async () => ({ data: { session: { user: { id: 'u' } } }, error: null }) } });
  await assert.rejects(signOutCurrentUser(), (error) => error instanceof SignOutFailure && !error.localSessionCleared);
  assert.equal(takeLogoutNotice(), LOGOUT_UNCONFIRMED_NOTICE);

  supabase.getSupabaseClient = () => ({ auth: { signOut: async () => { throw new Error('offline'); }, getSession: async () => { throw new Error('offline'); } } });
  await assert.rejects(signOutCurrentUser(), (error) => error instanceof SignOutFailure && !error.localSessionCleared);
  assert.equal(takeLogoutNotice(), LOGOUT_UNCONFIRMED_NOTICE);
});

test('blocked sessionStorage does not prevent a same-tab logout warning', async () => {
  fakeWindow();
  window.sessionStorage.setItem = () => { throw new Error('storage blocked'); };
  let eventMessage;
  window.addEventListener(LOGOUT_NOTICE_EVENT, (event) => { eventMessage = event.detail; });
  supabase.getSupabaseClient = () => ({ auth: { signOut: async () => ({ error: new Error('upstream failure') }), getSession: async () => ({ data: { session: null }, error: null }) } });
  await assert.rejects(signOutCurrentUser(), (error) => error instanceof SignOutFailure && error.localSessionCleared);
  assert.equal(eventMessage, LOGOUT_LOCAL_ONLY_NOTICE);
});
