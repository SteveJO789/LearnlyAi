import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { FileHistoryCards, FileHistoryDetails } = require('../.web-test-build/app/components/file-history.js');
const files = require('../.web-test-build/lib/file-materials.js'), supabase = require('../.web-test-build/lib/supabase.js');
const originalFetch = globalThis.fetch, originalClient = supabase.getSupabaseClient;
afterEach(() => { globalThis.fetch = originalFetch; supabase.getSupabaseClient = originalClient; });
const file = { id: 'file-owned', sessionId: 'session-owned', sessionTitle: 'โจทย์คณิต', filename: 'โจทย์.pdf', type: 'PDF', mimeType: 'application/pdf', sizeBytes: 12,
  uploadedAt: null, normalizedText: 'x² = 9', reviewedByLearner: false, canReview: true };
const auth = () => { supabase.getSupabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'offline' } }, error: null }) } }); };

test('real file cards/dialog render actual names, unknown dates, Thai-day boundaries and accessible gated review', () => {
  const cards = renderToStaticMarkup(React.createElement(FileHistoryCards, { items: [file], language: 'th', onSelect: () => {} }));
  assert.match(cards, /โจทย์.pdf/); assert.match(cards, /ไม่ทราบวันอัปโหลด/); assert.match(cards, /ยังไม่ยืนยันข้อความ/);
  const dated = renderToStaticMarkup(React.createElement(FileHistoryCards, { items: [{ ...file, uploadedAt: '2026-10-10T18:00:00Z' }], language: 'en', onSelect: () => {} }));
  assert.match(dated, /Oct 11/);
  const dialog = props => renderToStaticMarkup(React.createElement(FileHistoryDetails, { file: props, language: 'th', onClose: () => {}, onReviewed: () => {} }));
  assert.match(dialog(file), /role="dialog"/); assert.match(dialog(file), /aria-modal="true"/); assert.match(dialog(file), /for="history-file-text"/);
  assert.match(dialog(file), /x² = 9/); assert.match(dialog(file), /ดาวน์โหลดไฟล์ต้นฉบับ/); assert.match(dialog(file), /\/Chat\/session-owned/);
  const closed = dialog({ ...file, canReview: false, reviewedByLearner: true });
  assert.match(closed, /readOnly/); assert.doesNotMatch(closed, /ยืนยันข้อความ<\/button>/);
});

test('file collection client binds auth/current filters and rejects spoofed cursor/date/type/duplicate responses', async () => {
  auth(); let call;
  globalThis.fetch = async (url, init) => { call = { url, init }; return Response.json({ data: { items: [file], nextCursor: 'file-owned' } }); };
  const page = await files.listFileHistory({ after: 'prior', from: '2026-10-11', to: '2026-10-11' });
  assert.equal(page.items[0].uploadedAt, null); assert.match(call.url, /^\/api\/users\/me\/files\?/); assert.ok(call.url.includes('from=2026-10-11'));
  assert.equal(call.init.headers.Authorization, 'Bearer offline'); assert.equal(call.init.redirect, 'error');
  for (const data of [{ items: [file], nextCursor: 'wrong' }, { items: [file, file], nextCursor: null },
    { items: [{ ...file, uploadedAt: 'bad' }], nextCursor: null }, { items: [{ ...file, mimeType: 'text/html' }], nextCursor: null }]) {
    globalThis.fetch = async () => Response.json({ data }); await assert.rejects(files.listFileHistory(), /invalid/);
  }
});

test('private download rejects oversized streamed/declared and empty/HTML bodies before creating a file blob', async () => {
  auth(); let cancelled = 0;
  globalThis.fetch = async () => new Response(new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(3 * 1024 * 1024 + 1)); }, cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/pdf' } });
  await assert.rejects(files.downloadFileMaterial('s', 'f'), /invalid/); assert.equal(cancelled, 1);
  for (const response of [new Response('html', { headers: { 'content-type': 'text/html' } }), new Response('', { headers: { 'content-type': 'application/pdf' } }),
    new Response('x', { headers: { 'content-type': 'application/pdf', 'content-length': String(3 * 1024 * 1024 + 1) } })]) {
    globalThis.fetch = async () => response; await assert.rejects(files.downloadFileMaterial('s', 'f'), /invalid/);
  }
});
