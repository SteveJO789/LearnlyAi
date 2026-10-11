import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { UploadReceiptCards } = require('../.web-test-build/app/components/upload-history.js');
const files = require('../.web-test-build/lib/file-materials.js'), supabase = require('../.web-test-build/lib/supabase.js');
const originalFetch = globalThis.fetch, originalClient = supabase.getSupabaseClient;
afterEach(() => { globalThis.fetch = originalFetch; supabase.getSupabaseClient = originalClient; });
const pending = { id: 'pending', sessionId: 'owned', sessionTitle: 'โจทย์คณิต', state: 'PENDING', filename: 'โจทย์.pdf', type: 'PDF', createdAt: '2026-10-11T00:00:00Z', canResume: true };
const auth = () => { supabase.getSupabaseClient = () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'offline' } }, error: null }) } }); };

test('actual receipt cards show gated recovery, explicit abandonment confirmation and no resume for cancelled/closed records', () => {
  const html = (items, confirmId = null, busyId = null) => renderToStaticMarkup(React.createElement(UploadReceiptCards, {
    items, language: 'th', confirmId, busyId, onResume: () => {}, onConfirm: () => {}, onCancel: () => {},
  }));
  assert.match(html([pending]), /ตรวจและกู้คืน/); assert.doesNotMatch(html([pending]), /ยืนยันยกเลิก<\/button>/);
  assert.match(html([pending], pending.id), /ยืนยันยกเลิก/); assert.match(html([pending], pending.id), /ไฟล์ที่บันทึกในบทเรียนแล้ว/);
  assert.doesNotMatch(html([{ ...pending, state: 'CANCELLED', canResume: false }]), /ตรวจและกู้คืน/);
  assert.match(html([{ ...pending, state: 'CANCELLED', canResume: false }]), /ลองลบไฟล์ที่ค้างอีกครั้ง/);
  assert.match(html([pending], null, 'refresh-required'), /disabled/);
});

test('receipt client uses owned collection and empty-body cancellation, distinguishes SAVED winner and rejects forged payloads', async () => {
  auth(); const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ data: url.includes('/files/uploads') ? { items: [pending], nextCursor: null } : { id: 'pending', materialId: 'pending', status: 'CANCELLED' } }); };
  assert.equal((await files.listUploadHistory()).items[0].id, 'pending');
  assert.equal((await files.cancelFileUpload('owned', 'pending')).status, 'CANCELLED');
  assert.equal(calls[0].url, '/api/users/me/files/uploads'); assert.equal(calls[1].init.body, '{}');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer offline'); assert.ok(calls[1].url.endsWith('/pending/cancel'));
  const ready = { id: 'pending', materialId: 'pending', status: 'READY', type: 'PDF', normalizedText: 'x² = 4', contentHash: 'a'.repeat(64), mimeType: 'application/pdf', sizeBytes: 10 };
  globalThis.fetch = async () => Response.json({ data: ready }); assert.equal((await files.cancelFileUpload('owned', 'pending')).status, 'READY');
  globalThis.fetch = async () => Response.json({ data: { ...ready, id: 'foreign', materialId: 'foreign' } }); await assert.rejects(files.cancelFileUpload('owned', 'pending'), /invalid/);
  for (const data of [{ items: [{ ...pending, state: 'FINALIZED' }], nextCursor: null },
    { items: [{ ...pending, state: 'CANCELLED' }], nextCursor: null }, { items: [pending], nextCursor: 'forged' }]) {
    globalThis.fetch = async () => Response.json({ data }); await assert.rejects(files.listUploadHistory(), /invalid/);
  }
});
