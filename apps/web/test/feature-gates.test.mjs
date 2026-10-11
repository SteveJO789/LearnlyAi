import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const supabase = require('../.web-test-build/lib/supabase.js');
const { getFeatures } = require('../.web-test-build/lib/features.js');
const { startTextLesson } = require('../.web-test-build/lib/start-text-lesson.js');
const originalFetch = globalThis.fetch, originalClient = supabase.getSupabaseClient;
afterEach(() => { globalThis.fetch = originalFetch; supabase.getSupabaseClient = originalClient; });
test('capabilities are server-owned, no-store and fail closed for unavailable/malformed responses', async () => {
  for (const value of [null, { data: { assessments: 'true', fileUploads: true } }, { data: { assessments: true } }]) {
    globalThis.fetch = async () => Response.json(value); await assert.rejects(getFeatures());
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, '/api/capabilities'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    return Response.json({ data: { assessments: false, fileUploads: true } });
  };
  assert.deepEqual(await getFeatures(), { assessments: false, fileUploads: false });
  globalThis.fetch = async () => Response.json({ data: { assessments: true, fileUploads: true } }, { status: 503 });
  await assert.rejects(getFeatures());
});
test('text start uses the authenticated message path when new schema is disabled and preserves enabled assessment flow', async () => {
  supabase.getSupabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'fixture-token' } } }) } });
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, init }); return Response.json({ data: {} }); };
  assert.equal(await startTextLesson('owned/slash', 'V = IR', { assessments: false, fileUploads: false }), '/Chat/owned%2Fslash');
  assert.equal(requests[0].url, '/api/learning-sessions/owned%2Fslash/interactions');
  assert.deepEqual(JSON.parse(requests[0].init.body), { input: 'V = IR', action: 'RESPOND' });
  assert.equal(requests[0].init.headers.Authorization, 'Bearer fixture-token');
  assert.equal(await startTextLesson('owned', '2x = 4', { assessments: true, fileUploads: false }), '/Assessment/owned?phase=PRE');
  assert.equal(requests[1].url, '/api/learning-sessions/owned/materials');
  assert.deepEqual(JSON.parse(requests[1].init.body), { type: 'TEXT', text: '2x = 4' });
  globalThis.fetch = async () => Response.json({ error: { code: 'UNAVAILABLE', message: 'Unavailable' } }, { status: 503 });
  await assert.rejects(startTextLesson('owned', 'Question', { assessments: false, fileUploads: false }));
});
