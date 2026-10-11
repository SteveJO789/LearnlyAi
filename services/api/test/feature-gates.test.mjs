import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { createApp } from '../dist/app.js';
import { readFeatures } from '../dist/shared/features.js';

test('operator flags default closed, reject truthy typos and require assessments for file learning', () => {
  for (const env of [{}, { LEARNLY_ASSESSMENTS_ENABLED: '1', LEARNLY_FILE_UPLOADS_ENABLED: 'true' },
    { LEARNLY_ASSESSMENTS_ENABLED: 'TRUE', LEARNLY_FILE_UPLOADS_ENABLED: 'true' }]) {
    assert.deepEqual(readFeatures(env), { assessments: false, fileUploads: false });
  }
  assert.deepEqual(readFeatures({ LEARNLY_ASSESSMENTS_ENABLED: 'true' }), { assessments: true, fileUploads: false });
  assert.deepEqual(readFeatures({ LEARNLY_ASSESSMENTS_ENABLED: 'true', LEARNLY_FILE_UPLOADS_ENABLED: 'true' }), { assessments: true, fileUploads: true });
});
test('disabled routes authenticate first and never initialize missing DB, Storage, extraction or scoring', async () => {
  let calls = 0;
  const forbidden = async () => { calls++; throw Error('Unavailable infrastructure must not be reached'); };
  const authenticate = (request, response, next) => {
    if (request.header('authorization') !== 'Bearer test') return response.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    request.authUser = { id: 'synthetic', email: null }; request.authToken = 'test'; next();
  };
  const server = createApp({ features: { assessments: false, fileUploads: false },
    materialApi: { authenticate, context: forbidden }, assessment: { authenticate, storeFactory: forbidden },
    fileHistory: { authenticate, store: forbidden } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [method, path, contentType] of [
      ['POST', '/learning-sessions/s/materials/files', 'application/pdf'],
      ['POST', '/learning-sessions/s/materials', 'application/json'],
      ['GET', '/learning-sessions/s/materials/uploads'],
      ['POST', '/learning-sessions/s/materials/uploads/m/resume', 'application/json'],
      ['POST', '/learning-sessions/s/materials/uploads/m/cancel', 'application/json'],
      ['PATCH', '/learning-sessions/s/materials/m/review', 'application/json'],
      ['GET', '/learning-sessions/s/materials/m/file'], ['GET', '/users/me/files'],
      ['GET', '/users/me/files/uploads'], ['GET', '/learning-sessions/s/assessments/PRE'],
      ['POST', '/learning-sessions/s/assessments/PRE/submissions', 'application/json'],
      ['GET', '/users/me/learning-profile'], ['GET', '/users/me/progress'],
    ]) {
      const init = { method, headers: contentType ? { 'content-type': contentType } : {},
        ...(contentType ? { body: contentType === 'application/json' ? '{}' : 'invalid-pdf' } : {}) };
      assert.equal((await fetch(base + '/api/v1' + path, init)).status, 401);
      const response = await fetch(base + '/api/v1' + path, { ...init, headers: { ...init.headers, authorization: 'Bearer test' } });
      assert.equal(response.status, 503, path);
      assert.equal((await response.json()).error.code, 'FEATURE_DISABLED');
    }
    assert.equal(calls, 0);
    const capabilities = await fetch(base + '/api/v1/capabilities');
    assert.equal(capabilities.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await capabilities.json()).data, { assessments: false, fileUploads: false });
    assert.equal((await fetch(base + '/health/live')).status, 200);
    assert.equal((await fetch(base + '/api/v1/users/me/unknown', { headers: { authorization: 'Bearer test' } })).status, 404);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
