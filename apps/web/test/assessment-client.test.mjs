import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const supabase = require('../.web-test-build/lib/supabase.js');
const originalClient = supabase.getSupabaseClient, originalFetch = globalThis.fetch;
const client = require('../.web-test-build/lib/assessments.js');
const api = require('../.web-test-build/lib/learning-sessions.js');
afterEach(() => { supabase.getSupabaseClient = originalClient; globalThis.fetch = originalFetch; });
const authenticated = () => { supabase.getSupabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test-only-token' } }, error: null }) } }); };
const dto = { id: 'a', sessionId: 's', phase: 'PRE', topic: 'ohms-law', language: 'en', questions: [{ id: 'q', prompt: 'question', format: 'NUMBER' }], score: null, maxScore: 1, submittedAt: null };
test('assessment client uses authenticated current endpoints and sends only answer data', async () => {
  authenticated();
  const requests = [];
  globalThis.fetch = async (url, init) => { requests.push({ url, init }); return Response.json({ data: dto }); };
  await client.createAssessment('session/slash', 'PRE', 'ohms-law', 'en');
  await client.submitAssessment('session/slash', 'PRE', [{ questionId: 'q', answer: 12 }]);
  assert.equal(requests[0].url, '/api/learning-sessions/session%2Fslash/assessments/PRE');
  assert.equal(requests[0].init.headers.Authorization, 'Bearer test-only-token');
  assert.equal(requests[0].init.redirect, 'error');
  assert.deepEqual(JSON.parse(requests[1].init.body), { answers: [{ questionId: 'q', answer: 12 }] });
  assert.doesNotMatch(requests[1].init.body, /userId|score|awardedScore/);
});
test('unauthenticated requests never call the API, and tokens cannot be sent to external origins', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; return Response.json({ data: dto }); };
  supabase.getSupabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }) } });
  await assert.rejects(client.getAssessment('s', 'PRE'), /log in/);
  authenticated(); await assert.rejects(api.authenticatedRequest('https://outside.invalid'), /same-origin/);
  assert.equal(calls, 0);
});
test('controlled API errors retain status/request ID and malformed assessment payload is rejected', async () => {
  authenticated();
  globalThis.fetch = async () => Response.json({ error: { code: 'ASSESSMENT_CONFLICT', message: 'Reload assessment', requestId: 'req-safe' } }, { status: 409 });
  await assert.rejects(client.getAssessment('s', 'PRE'), error => error.status === 409 && error.code === 'ASSESSMENT_CONFLICT' && error.message.includes('req-safe'));
  globalThis.fetch = async () => Response.json({ data: { ...dto, questions: [], score: 99 } });
  await assert.rejects(client.getAssessment('s', 'PRE'), /invalid response/);
});

test('profile/progress clients reject malformed metrics before rendering', async () => {
  authenticated();
  globalThis.fetch = async () => Response.json({ data: { mastery: { 'ohms-law': { percent: 999 } }, strengths: [], weakPoints: [] } });
  await assert.rejects(client.getLearningProfile(), /invalid response/);
  globalThis.fetch = async () => Response.json({ data: { sessionCount: 1, completedSessionCount: 2, averageProgressPercent: 0, comparisons: [] } });
  await assert.rejects(client.getLearningProgress(), /invalid response/);
});
