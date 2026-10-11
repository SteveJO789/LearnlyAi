import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { createSupabaseAuthenticator } from '../dist/modules/auth/supabase-auth.js';
import { PrismaFileHistory, fileHistoryQuery } from '../dist/modules/input/file-history.js';

const row = id => ({ id, sessionId: 'session-owned', sessionTitle: 'Synthetic owned session', type: 'PDF', mimeType: 'application/pdf',
  sizeBytes: 12, filename: 'โจทย์.pdf', uploadedAt: '', normalizedText: 'x² = 9', reviewedByLearner: false, canReview: true });
test('owned file SQL binds owner/cursor/Thai-day bounds, limits pages and never invents legacy upload dates', async () => {
  let captured;
  const records = Array.from({ length: 26 }, (_, i) => row(`file-${String(i).padStart(3, '0')}`));
  const client = { raw: { sql: (parts, ...values) => ({ returnsRow: () => ({ build: () => { captured = { text: parts.join('?'), values }; return captured; } }) }) },
    query: () => ({ toArray: async () => records }) };
  const page = await new PrismaFileHistory(client, 'legacy-owned-app-id').list(fileHistoryQuery({ after: 'file-old', from: '2026-10-11', to: '2026-10-11' }));
  assert.equal(page.items.length, 25); assert.equal(page.nextCursor, 'file-024'); assert.equal(page.items[0].uploadedAt, null);
  assert.ok(captured.values.includes('legacy-owned-app-id')); assert.ok(captured.values.includes('file-old'));
  assert.ok(captured.values.includes('2026-10-10T17:00:00.000Z')); assert.ok(captured.values.includes('2026-10-11T17:00:00.000Z'));
  assert.match(captured.text, /s\."userId" = \?/); assert.match(captured.text, /ORDER BY m.id ASC LIMIT 26/);
  assert.match(captured.text, /f\."learningSessionId" = m\."learningSessionId" AND f.state = 'FINALIZED'/);
  assert.match(captured.text, /LEFT\(COALESCE[\s\S]+8001/);
  assert.ok(!Object.keys(page.items[0]).some(key => /storage|bucket|owner|token/i.test(key)));
});

test('invalid dates/ranges/cursors and owner/storage overrides are rejected before SQL', () => {
  for (const bad of [{ from: '2026-02-30' }, { to: ['2026-10-11'] }, { from: '2026-10-12', to: '2026-10-11' },
    { after: "' OR true --" }, { owner: 'peer' }, { storageKey: 'peer/file' }]) assert.throws(() => fileHistoryQuery(bad));
  assert.deepEqual(fileHistoryQuery({}), { after: '', from: '', to: '' });
});

test('protected HTTP file collection returns owner-scoped page and rejects invalid auth/queries before store creation (offline service)', async () => {
  const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
  process.env.SUPABASE_URL = 'https://synthetic-auth.test'; process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-public';
  let contexts = 0;
  const authenticate = createSupabaseAuthenticator({ fetch: async (_url, init) => {
    const id = { 'Bearer owned': '11111111-1111-4111-8111-11111111ac01', 'Bearer peer': '11111111-1111-4111-8111-11111111ac02' }[init.headers.authorization];
    return id ? Response.json({ id, user_metadata: {} }) : Response.json({}, { status: 401 });
  } });
  const server = createApp({ fileHistory: { authenticate, store: async request => {
    contexts++;
    return { list: async query => ({ items: request.authUser.id.endsWith('ac01') ? [{ ...row('file'), uploadedAt: null }] : [], nextCursor: null }) };
  } } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1/users/me/files`;
  try {
    const call = (path = '', token = 'owned') => fetch(base + path, { headers: token ? { authorization: 'Bearer ' + token } : {} });
    const owned = await call(); assert.equal(owned.status, 200); assert.equal((await owned.json()).data.items[0].id, 'file');
    assert.equal(owned.headers.get('cache-control'), 'private, no-store');
    const peer = await call('', 'peer'); assert.deepEqual((await peer.json()).data.items, []);
    const count = contexts;
    assert.equal((await call('', '')).status, 401); assert.equal((await call('', 'bad')).status, 401);
    for (const query of ['?owner=peer', '?from=2026-02-30', '?after=%27%20OR%20true', '?from=2026-10-11&from=2026-10-12']) {
      assert.equal((await call(query)).status, 400);
    }
    assert.equal(contexts, count);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
