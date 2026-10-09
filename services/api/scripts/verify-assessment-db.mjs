// Explicit real PostgreSQL fixture test. No paid AI, real Auth accounts, or public table writes.
// Auth transport uses locally signed test identities; Prisma/RLS/SQL transactions are real.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { supabase } from '@prisma/orm-extension-supabase/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { PrismaAssessmentStore } from '../dist/modules/assessments/prisma-assessment-store.js';
import { withApiWrite } from '../dist/prisma/api-write.js';
import { MockModelProvider } from '../dist/modules/ai/providers/mock-model-provider.js';

const schema = process.argv[2], actorA = process.argv[3], actorB = process.argv[4];
if (!/^learnly_verify_[0-9a-f]{12}$/.test(schema ?? '') || [actorA, actorB].some(id => !/^[0-9a-f-]{36}$/.test(id ?? ''))) {
  throw new Error('Explicit isolated fixture schema and actors are required');
}
process.env.AI_PROVIDER = 'mock';
const key = randomBytes(32).toString('hex');
const encodedKey = new TextEncoder().encode(key);
const token = id => new SignJWT({ sub: id, role: 'authenticated', user_metadata: { 'learnly.api_write': '1' } })
  .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(encodedKey);
const tokens = await Promise.all([token(actorA), token(actorB)]);
let root, server;
let phase = 'initialize';
const evidence = [];
const capture = (name, extra = {}) => { evidence.push({ name, result: 'PASS', ...extra }); };
function scoped(client) {
  return { ...client, raw: { ...client.raw, sql: (parts, ...values) => {
    const replace = part => part.replaceAll('"public".', `"${schema}".`).replaceAll('public.', `"${schema}".`);
    const mapped = parts.map(replace);
    Object.defineProperty(mapped, 'raw', { value: parts.raw.map(replace) });
    return client.raw.sql(mapped, ...values);
  } } };
}
try {
root = await supabase({ contractJson, url: process.env.DATABASE_URL, jwtSecret: key,
  poolOptions: { connectionTimeoutMillis: 3000 } });
const clients = await Promise.all(tokens.map(async jwt => scoped(await root.asUser(jwt))));
const stores = clients.map((client, index) => new PrismaAssessmentStore(client, [actorA, actorB][index]));
const { createApp } = await import('../dist/app.js');
  const authenticate = async (request, response, next) => {
    try {
      const jwt = request.header('authorization')?.replace(/^Bearer /, '');
      const verified = await jwtVerify(jwt ?? '', encodedKey, { algorithms: ['HS256'] });
      if (![actorA, actorB].includes(verified.payload.sub)) throw new Error('Unknown synthetic identity');
      request.authUser = { id: verified.payload.sub, email: null, displayName: 'Synthetic learner', avatarUrl: null };
      request.authToken = jwt; next();
    } catch { response.status(401).json({ error: { code: 'UNAUTHORIZED' } }); }
  };
  server = createApp({ modelProvider: new MockModelProvider(), assessment: { authenticate,
    storeFactory: async request => stores[request.authUser.id === actorA ? 0 : 1] } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1/`;
  const call = async (path, { actor = 0, method = 'GET', body } = {}) => {
    assert.ok(/^(?:learning-sessions\/fixture-[01]-[01]\/assessments\/(?:PRE|POST|TRANSFER)(?:\/submissions)?|users\/me\/(?:learning-profile|progress))$/.test(path));
    const response = await fetch(base + path, { method, headers: { authorization: `Bearer ${tokens[actor]}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const solve = questions => questions.map(question => {
    if (question.unit) {
      const numbers = [...question.prompt.matchAll(/(\d+) (?:A|V|Ω)/gu)].map(match => Number(match[1]));
      return { questionId: question.id, answer: question.unit === 'V' ? numbers[0] * numbers[1] : numbers[0] / numbers[1] };
    }
    const numbers = /Solve (\d+)x \+ (\d+) = (\d+)/.exec(question.prompt);
    assert.ok(numbers);
    return { questionId: question.id, answer: (Number(numbers[3]) - Number(numbers[2])) / Number(numbers[1]) };
  });
  async function moveToAssessment(sessionId) {
    await withApiWrite(clients[0], async tx => tx.execute(clients[0].raw.sql`
      UPDATE public."LearningSession" SET "stage" = 'ASSESS', "state" = 'POST_TEST', "progressPercent" = 75, "version" = 1
      WHERE "id" = ${sessionId} AND "userId" = ${actorA}`.affectedCount().build()));
  }
  phase = 'pre-test';
  const prePath = 'learning-sessions/fixture-0-0/assessments/PRE';
  const pre = await call(prePath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(pre.status, 201, JSON.stringify(pre.body.error));
  assert.doesNotMatch(JSON.stringify(pre.body), /"rule"|submissionHash|correctAnswer/);
  const preAnswers = solve(pre.body.data.questions);
  preAnswers[0].answer = -1;
  const submittedPre = await call(prePath + '/submissions', { method: 'POST', body: { answers: preAnswers } });
  assert.equal(submittedPre.status, 200, JSON.stringify(submittedPre.body.error));
  assert.equal(submittedPre.body.data.score, 2);
  assert.equal(submittedPre.body.data.answers.length, 3);
  assert.equal((await call('users/me/learning-profile')).body.data.updatedAt, null);
  assert.equal((await call(prePath + '/submissions', { method: 'POST', body: { answers: [...preAnswers].reverse() } })).status, 200);
  capture('PRE score/answer persistence and exact-retry idempotency', { score: 2, maxScore: 3 });

  phase = 'post-tests';
  await moveToAssessment('fixture-0-0');
  await moveToAssessment('fixture-0-1');
  const postPath = 'learning-sessions/fixture-0-0/assessments/POST';
  const post = await call(postPath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(post.status, 201, JSON.stringify(post.body.error));
  const mathPath = 'learning-sessions/fixture-0-1/assessments/POST';
  const math = await call(mathPath, { method: 'POST', body: { topic: 'linear-equations', language: 'en' } });
  assert.equal(math.status, 201, JSON.stringify(math.body.error));
  const postAnswers = solve(post.body.data.questions).map(answer => ({ ...answer, answer: -1 }));
  const mathAnswers = solve(math.body.data.questions);
  const results = await Promise.all([
    call(postPath + '/submissions', { method: 'POST', body: { answers: postAnswers } }),
    call(mathPath + '/submissions', { method: 'POST', body: { answers: mathAnswers } }),
  ]);
  results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body.error)));
  assert.equal(results[0].body.data.score, 0); assert.equal(results[1].body.data.score, 3);
  const profile = (await call('users/me/learning-profile')).body.data;
  assert.equal(profile.mastery['ohms-law'].percent, 0);
  assert.equal(profile.mastery['linear-equations'].percent, 100);
  assert.deepEqual(profile.strengths, ['linear-equations']);
  assert.deepEqual(profile.weakPoints, ['ohms-law']);
  const progress = (await call('users/me/progress')).body.data;
  assert.equal(progress.sessionCount, 2);
  const pair = progress.comparisons.find(item => item.sessionId === 'fixture-0-0');
  assert.deepEqual([pair.prePercent, pair.postPercent, pair.deltaPercent], [67, 0, -67]);
  capture('Concurrent POST submissions preserve both topic mastery samples');
  capture('PRE/POST comparison reflects persisted scores', { prePercent: 67, postPercent: 0, deltaPercent: -67 });

  phase = 'isolation';
  assert.equal((await call(postPath, { actor: 1 })).status, 404);
  assert.equal((await call(postPath + '/submissions', { actor: 1, method: 'POST', body: { answers: postAnswers } })).status, 404);
  assert.deepEqual((await call('users/me/learning-profile', { actor: 1 })).body.data.mastery, {});
  assert.equal(await stores[1].getAssessment('fixture-0-0', 'POST'), null);
  capture('Second signed learner cannot access another learner assessment/profile');

  for (const plan of [
    clients[0].raw.sql`UPDATE public."Assessment" SET "score" = 99 WHERE "id" = ${post.body.data.id}`.affectedCount().build(),
    clients[0].raw.sql`UPDATE public."LearningSession" SET "progressPercent" = 100 WHERE "id" = 'fixture-0-0'`.affectedCount().build(),
    clients[0].raw.sql`UPDATE public."LearningProfile" SET "mastery" = '{}'::json WHERE "userId" = ${actorA}`.affectedCount().build(),
  ]) await assert.rejects(clients[0].execute(plan));
  assert.equal((await stores[0].getAssessment('fixture-0-0', 'POST')).score, 0);
  capture('Unmarked direct writes cannot change own score, progress or mastery; context resets after commit');

  phase = 'rollback';
  const transferPath = 'learning-sessions/fixture-0-0/assessments/TRANSFER';
  const transfer = await call(transferPath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(transfer.status, 201, JSON.stringify(transfer.body.error));
  const record = await stores[0].getAssessment('fixture-0-0', 'TRANSFER');
  const input = solve(transfer.body.data.questions).map(answer => ({ questionId: answer.questionId,
    response: answer.answer, isCorrect: true, awardedScore: 1 }));
  await assert.rejects(stores[0].submitAssessment(record, [input[0], input[0], input[2]], 'fault-injection-only', new Date().toISOString()));
  const after = await stores[0].getAssessment('fixture-0-0', 'TRANSFER');
  assert.equal(after.score, null); assert.equal(after.submittedAt, null);
  assert.deepEqual(await stores[0].getAnswers(after.id), []);
  assert.deepEqual((await stores[0].getLearningProfile()).mastery, profile.mastery);
  capture('Answer uniqueness failure rolls back score/answers/profile atomically');
  console.log(JSON.stringify({ category: 'REAL_POSTGRESQL_API_PRISMA_RLS_FIXTURE', schema, evidence,
    limitations: ['Signed test identities and injected Auth transport, not real Supabase login/OAuth',
      'Isolated empty clones plus new migration operations, not full historical migration replay',
      'No deployment smoke test or paid model calls'] }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ phase, failed: true, code: /^[A-Z0-9_.-]{1,80}$/.test(String(error?.code ?? '')) ? error.code : 'VERIFICATION_FAILED' }));
  process.exitCode = 1;
} finally {
  if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
  if (root) await root.close();
}
