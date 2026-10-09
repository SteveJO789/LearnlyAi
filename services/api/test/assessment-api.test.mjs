import assert from 'node:assert/strict';
import test from 'node:test';
import { withTestServer } from './learning-test-helpers.mjs';
import { createAssessmentSnapshot } from '../dist/modules/assessments/scoring.js';

// Offline contract/service checks. Real Prisma/RLS/transaction tests are separate.
function fixture() {
  const records = new Map(), answers = new Map();
  const sessions = new Map([['session-a', { id: 'session-a', userId: 'a', stage: 'EXPLAIN', lifecycleState: 'ACTIVE', version: 0 }],
    ['session-b', { id: 'session-b', userId: 'b', stage: 'EXPLAIN', lifecycleState: 'ACTIVE', version: 0 }]]);
  let creates = 0, submissions = 0, factoryCalls = 0;
  const clone = value => value === undefined ? null : structuredClone(value);
  const authenticate = (request, response, next) => {
    const token = request.header('authorization');
    if (!['Bearer a', 'Bearer b'].includes(token)) return response.status(401).json({ error: { code: 'UNAUTHORIZED' } });
    request.authUser = { id: token.slice(-1), email: null, displayName: 'Test', avatarUrl: null };
    request.authToken = token.slice(-1); next();
  };
  const storeFactory = async request => {
    factoryCalls++;
    const owner = request.authUser.id;
    const owns = id => sessions.get(id)?.userId === owner;
    return {
      getSession: async id => owns(id) ? clone(sessions.get(id)) : null,
      getAssessment: async (id, phase) => owns(id) ? clone(records.get(`${id}:${phase}`)) : null,
      createAssessment: async record => {
        assert.ok(owns(record.learningSessionId));
        const key = `${record.learningSessionId}:${record.phase}`;
        if (records.has(key)) return false;
        records.set(key, clone(record)); creates++; return true;
      },
      submitAssessment: async (record, graded, hash, at) => {
        assert.ok(owns(record.learningSessionId));
        const stored = records.get(`${record.learningSessionId}:${record.phase}`);
        if (stored.submittedAt) return false;
        stored.score = graded.reduce((sum, answer) => sum + answer.awardedScore, 0);
        stored.maxScore = graded.length; stored.submittedAt = at; stored.submissionHash = hash;
        answers.set(stored.id, clone(graded)); submissions++; return true;
      },
      getAnswers: async id => clone(answers.get(id)) ?? [],
      getLearningProfile: async () => null,
      getProgress: async () => ({ sessionCount: [...sessions.values()].filter(s => s.userId === owner).length,
        completedSessionCount: 0, averageProgressPercent: 0, comparisons: [] }),
    };
  };
  return { options: { assessment: { authenticate, storeFactory } }, sessions, records,
    counts: () => ({ creates, submissions, factoryCalls }) };
}
const call = async (base, path, { token = 'a', method = 'GET', body, contentType = 'application/json' } = {}) => {
  const response = await fetch(base + '/api/v1/' + path, { method, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': contentType }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
};
const path = 'learning-sessions/session-a/assessments/PRE';
const correctAnswers = record => createAssessmentSnapshot(record.id, record.topic, record.phase, record.snapshot.language).questions.map(question => {
  const { kind, left, right, target } = question.rule;
  return { questionId: question.id, answer: kind === 'LINEAR' ? (target - right) / left : kind === 'VOLTAGE' ? left * right : left / right };
});

test('create -> fetch -> submit -> reload persists deterministic score and makes exact retries idempotent', async () => {
  const f = fixture();
  await withTestServer(f.options, async base => {
    const created = await call(base, path, { method: 'POST', body: { topic: 'linear-equations', language: 'th' } });
    assert.equal(created.status, 201); assert.equal(created.body.data.questions.length, 3);
    assert.equal(created.body.data.score, null);
    assert.doesNotMatch(JSON.stringify(created.body), /"rule"|correctAnswer|submissionHash/);
    const repeated = await call(base, path, { method: 'POST', body: { topic: 'linear-equations', language: 'th' } });
    assert.equal(repeated.body.data.id, created.body.data.id);
    const input = correctAnswers(f.records.get('session-a:PRE'));
    const submitted = await call(base, path + '/submissions', { method: 'POST', body: { answers: input } });
    assert.equal(submitted.status, 200); assert.equal(submitted.body.data.score, 3);
    assert.equal(submitted.body.data.answers.length, 3);
    const retry = await call(base, path + '/submissions', { method: 'POST', body: { answers: [...input].reverse() } });
    assert.equal(retry.status, 200); assert.deepEqual(retry.body, submitted.body);
    assert.deepEqual((await call(base, path)).body, submitted.body);
    const changed = await call(base, path + '/submissions', { method: 'POST', body: { answers: input.map((answer, i) => i ? answer : { ...answer, answer: -1 }) } });
    assert.equal(changed.status, 409); assert.equal(changed.body.error.code, 'ASSESSMENT_CONFLICT');
    assert.equal(f.counts().creates, 1); assert.equal(f.counts().submissions, 1);
  });
});

test('auth and cross-user ownership reject read/create/submit without protected writes', async () => {
  const f = fixture();
  await withTestServer(f.options, async base => {
    assert.equal((await call(base, path, { token: null })).status, 401);
    assert.equal(f.counts().factoryCalls, 0);
    for (const method of ['GET', 'POST']) {
      assert.equal((await call(base, path, { token: 'b', method, ...(method === 'POST' ? { body: { topic: 'ohms-law' } } : {}) })).status, 404);
    }
    assert.equal((await call(base, path + '/submissions', { token: 'b', method: 'POST', body: { answers: [] } })).status, 404);
    assert.equal(f.counts().creates, 0); assert.equal(f.counts().submissions, 0);
  });
});

test('bad phase/topic/language, media and client score metadata return controlled errors', async () => {
  const f = fixture();
  await withTestServer(f.options, async base => {
    for (const input of [{ topic: 'biology' }, { topic: 'ohms-law', language: 'fr' },
      { topic: 'ohms-law', userId: 'b' }, { topic: 'ohms-law', score: 100 }, []]) {
      const r = await call(base, path, { method: 'POST', body: input });
      assert.equal(r.status, 400); assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.ok(r.body.error.requestId);
    }
    assert.equal((await call(base, path.replace('PRE', 'bogus'), { method: 'POST', body: { topic: 'ohms-law' } })).status, 400);
    assert.equal((await call(base, path, { method: 'POST', body: { topic: 'ohms-law' }, contentType: 'text/plain' })).status, 415);
    assert.equal(f.counts().creates, 0);
  });
});

test('assessment stage gates prevent pre-tests after learning and post-tests before assessment stage', async () => {
  const f = fixture();
  await withTestServer(f.options, async base => {
    assert.equal((await call(base, path.replace('PRE', 'POST'), { method: 'POST', body: { topic: 'ohms-law' } })).status, 409);
    f.sessions.get('session-a').version = 1;
    assert.equal((await call(base, path, { method: 'POST', body: { topic: 'ohms-law' } })).status, 409);
    f.sessions.get('session-a').stage = 'ASSESS';
    const post = await call(base, path.replace('PRE', 'POST'), { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
    assert.equal(post.status, 201);
    assert.equal(f.counts().creates, 1);
  });
});

test('empty profile/progress reflect owned data and require authentication', async () => {
  const f = fixture();
  await withTestServer(f.options, async base => {
    const profile = await call(base, 'users/me/learning-profile');
    assert.equal(profile.status, 200); assert.deepEqual(profile.body.data, { mastery: {}, strengths: [], weakPoints: [], updatedAt: null });
    assert.equal((await call(base, 'users/me/progress')).body.data.sessionCount, 1);
    assert.equal((await call(base, 'users/me/progress', { token: null })).status, 401);
  });
});
