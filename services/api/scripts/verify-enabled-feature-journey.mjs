// Local-only end-to-end fixture for the enabled assessment/text-learning path.
// Uses a provisioned canonical database and local Supabase Auth; never rewrites
// the Prisma contract marker or calls a paid model/provider.
// Real local run: NODE_EXTRA_CA_CERTS=/workspace/learnly-activation-runtime/certs/local-cert.pem
//   node --env-file=/workspace/learnly-activation-runtime/local-status.env scripts/verify-enabled-feature-journey.mjs --local-supabase-fixture --real-storage
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { supabase } from '@prisma/orm-extension-supabase/runtime';
import pgvector from '@prisma/orm-extension-pgvector/runtime';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { PrismaAssessmentStore } from '../dist/modules/assessments/prisma-assessment-store.js';
import { MockModelProvider } from '../dist/modules/ai/providers/mock-model-provider.js';
import { textPdf } from '../test/real-file-fixtures.mjs';
import { requireLocalAuth, requireLocalDatabase } from './journey-target-guard.mjs';

const { Client } = pg;
const databaseUrl = process.env.LEARNLY_JOURNEY_DATABASE_URL;
const authUrl = process.env.LEARNLY_JOURNEY_SUPABASE_URL;
const publishableKey = process.env.LEARNLY_JOURNEY_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.LEARNLY_JOURNEY_SERVICE_ROLE_KEY;
const realStorageMode = process.argv.includes('--real-storage');
const { databaseName, isolatedSupabaseDb, phaseAFixtureDb } = requireLocalDatabase(databaseUrl, process.argv.slice(2));
if (realStorageMode && !isolatedSupabaseDb) throw new Error('--real-storage requires the explicitly isolated Supabase database target');
const localAuthUrl = requireLocalAuth(authUrl, { realStorageMode, phaseAFixtureDb, extraCaCerts: process.env.NODE_EXTRA_CA_CERTS });
if (!publishableKey || !serviceRoleKey) throw new Error('Local Supabase journey keys are required');
process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_URL = localAuthUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;
process.env.AI_PROVIDER = 'mock';

const evidence = [];
const capture = (name, extra = {}) => evidence.push({ name, result: 'PASS', ...extra });
const safeErrorCode = error => /^[A-Z0-9_.-]{1,80}$/u.test(String(error?.code ?? '')) ? error.code : 'VERIFICATION_FAILED';
function safeErrorCodes(error) {
  const codes = [], seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 4 || seen.has(value)) return;
    seen.add(value);
    for (const candidate of [value.sqlState, value.code, value.meta?.sqlState, value.meta?.code]) {
      if (typeof candidate === 'string' && /^[A-Z0-9]{5}$/u.test(candidate)) codes.push(candidate);
    }
    visit(value.cause, depth + 1);
    visit(value.meta, depth + 1);
  };
  visit(error);
  return [...new Set(codes)];
}
const authUsers = [];
const sessionIds = [];
const realStorageSessionIds = [];
const actors = [
  { authId: randomUUID(), appId: randomUUID(), email: `${randomUUID()}@journey.invalid`, password: `${randomUUID()}-Aa9!` },
  { authId: randomUUID(), appId: randomUUID(), email: `${randomUUID()}@journey.invalid`, password: `${randomUUID()}-Bb8!` },
];
let database;
let orm;
let apiDb;
let server;
let phase = 'initialize';
let databaseCleanupSucceeded = false;
let cleanupSucceeded = true;
let storageKeysVerifiedAbsent = 0;
let authUsersRemoved = 0;
let finalReport;
let failureReport;
let failureDetails;
let unblockUpload;
let pauseNextUpload = false;
const storedObjects = new Map();
const fixtureStorageSessions = new Set();
const storageHttpStatuses = [];
const fakeStorage = {
  bucketId: 'learnly-materials',
  async upload(key, bytes, file) {
    assert.equal(bytes.byteLength, file.sizeBytes);
    storedObjects.set(key, Buffer.from(bytes));
    if (pauseNextUpload) {
      pauseNextUpload = false;
      await new Promise(resolve => { unblockUpload = resolve; });
    }
  },
  async remove(key) { storedObjects.delete(key); },
  async verify(key, file) {
    const bytes = storedObjects.get(key);
    assert.ok(bytes && bytes.byteLength === file.sizeBytes && createHash('sha256').update(bytes).digest('hex') === file.contentHash);
  },
  async download(key, file) {
    const bytes = storedObjects.get(key);
    assert.ok(bytes && bytes.byteLength === file.sizeBytes && createHash('sha256').update(bytes).digest('hex') === file.contentHash);
    return Buffer.from(bytes);
  },
};

async function authRequest(path, { key = publishableKey, bearer = key, method = 'GET', body } = {}) {
  if (body !== undefined && method === 'GET') throw new Error('Local Auth request with a body requires an explicit write method');
  const response = await fetch(`${localAuthUrl}${path}`, {
    method, redirect: 'error',
    headers: { apikey: key, authorization: `Bearer ${bearer}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { /* report status only */ }
  if (!response.ok) {
    const error = new Error(`Local Auth request failed with status ${response.status}`);
    error.code = 'LOCAL_AUTH_REQUEST_FAILED';
    throw error;
  }
  return payload;
}

async function createAuthActor(actor) {
  const created = await authRequest('/auth/v1/admin/users', {
    key: serviceRoleKey, bearer: serviceRoleKey, method: 'POST',
    body: { email: actor.email, password: actor.password, email_confirm: true },
  });
  if (created.id !== actor.authId) actor.authId = created.id;
  authUsers.push(actor.authId);
  const session = await authRequest('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email: actor.email, password: actor.password },
  });
  assert.equal(session.user?.id, actor.authId);
  assert.ok(typeof session.access_token === 'string' && session.access_token.length > 20);
  actor.token = session.access_token;
}

function expectedAnswers(questions) {
  return questions.map(question => {
    const numbers = [...question.prompt.matchAll(/(\d+(?:\.\d+)?)\s*(?:A|V|Ω)/gu)].map(match => Number(match[1]));
    if (question.unit) {
      assert.equal(numbers.length, 2);
      return { questionId: question.id, answer: question.unit === 'V' ? numbers[0] * numbers[1] : numbers[0] / numbers[1] };
    }
    const equation = /Solve (\d+)x \+ (\d+) = (\d+)/u.exec(question.prompt);
    assert.ok(equation);
    return { questionId: question.id, answer: (Number(equation[3]) - Number(equation[2])) / Number(equation[1]) };
  });
}

try {
  database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  await database.connect();
  const markerExists = await database.query(`SELECT to_regclass('prisma_contract.marker') IS NOT NULL AS present`);
  if (!markerExists.rows[0]?.present) {
    const error = new Error('Canonical Prisma migration marker is missing from the isolated journey database.');
    error.code = 'CANONICAL_MARKER_MISSING';
    throw error;
  }
  const marker = await database.query(`SELECT core_hash AS "coreHash", profile_hash AS "profileHash" FROM prisma_contract.marker WHERE space = 'app'`);
  assert.equal(marker.rowCount, 1, 'canonical application migration marker must exist exactly once');
  assert.equal(marker.rows[0].coreHash, contractJson.storage.storageHash, 'canonical storage marker must match the API contract');
  assert.equal(marker.rows[0].profileHash, contractJson.profileHash, 'canonical profile marker must match the API contract');
  capture('Canonical Prisma contract marker matches storage and profile hashes', { databaseName, localSupabaseDb: isolatedSupabaseDb });

  phase = 'local-auth';
  for (const actor of actors) await createAuthActor(actor);

  phase = 'legacy-user-seed';
  for (const actor of actors) {
    await database.query(`INSERT INTO public."User" (id, "authUserId", email, "displayName", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, now(), now())`, [actor.appId, actor.authId, actor.email, 'Journey learner']);
  }
  capture('Two local Auth identities map to distinct legacy application User IDs');

  orm = await supabase({ contractJson, extensions: [pgvector], url: databaseUrl,
    jwksUrl: `${localAuthUrl}/auth/v1/.well-known/jwks.json`, poolOptions: { connectionTimeoutMillis: 5000 } });
  const actorClients = await Promise.all(actors.map(actor => orm.asUser(actor.token)));
  const { createApp } = await import('../dist/app.js');
  const { getDb } = await import('../dist/prisma/db.js');
  apiDb = await getDb();
  const { appUserIdForAuthUser } = await import('../dist/shared/app-user.js');
  const { PrismaTextMaterials } = await import('../dist/modules/input/text-materials.js');
  const { PrismaFileMaterials } = await import('../dist/modules/input/prisma-file-materials.js');
  const { FileIngestion } = await import('../dist/modules/input/file-ingestion.js');
  const { PrivateMaterialStorage } = await import('../dist/modules/input/private-material-storage.js');
  const { RealFileTextExtractor } = await import('../dist/modules/input/real-file-text-extractor.js');
  const testExtractor = { extract: async () => ({ method: 'PDF_TEXT', pages: [{ page: 1, text: 'Extracted Ohm law fixture: V = I × R.' }], confidence: null }) };
  server = createApp({
    features: { assessments: true, fileUploads: true },
    modelProvider: new MockModelProvider({ fixture: {
      schemaVersion: '1.0', responseId: 'journey-response', sessionId: 'journey-session', stage: 'LEARNING',
      blocks: [{ id: 'journey-explanation', type: 'explanation', title: 'Local fixture lesson', content: 'This deterministic response verifies persistence without an external model.' }],
      progress: { percent: 40, canAdvance: true, nextAction: 'CONTINUE' }, citations: [],
    } }),
    knowledgeRetriever: { retrieve: async () => [] },
    materialApi: { context: async request => {
      const client = await (await getDb()).asUser(request.authToken);
      const appUserId = await appUserIdForAuthUser(client, request.authUser.id);
      const files = new PrismaFileMaterials(client, appUserId);
      const useFixtureStorage = !realStorageMode || fixtureStorageSessions.has(request.params.sessionId);
      const storageAdapter = useFixtureStorage ? fakeStorage : new PrivateMaterialStorage({ url: localAuthUrl,
        bucket: 'learnly-materials', publishableKey, token: request.authToken, authUserId: request.authUser.id,
        fetchImpl: async (...args) => {
          const response = await fetch(...args);
          storageHttpStatuses.push({ status: response.status, requestId: response.headers.get('x-request-id') ?? response.headers.get('sb-request-id') ?? null });
          return response;
        } });
      const extractor = useFixtureStorage ? testExtractor : new RealFileTextExtractor();
      return { texts: new PrismaTextMaterials(client, appUserId), files,
        storage: bucket => {
          assert.equal(bucket, 'learnly-materials');
          return storageAdapter;
        },
        ingestion: new FileIngestion(files, storageAdapter, extractor, request.authUser.id),
      };
    } },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1/`;
  const call = async (actorIndex, path, { method = 'GET', body } = {}) => {
    const response = await fetch(base + path, {
      method, redirect: 'error',
      headers: { authorization: `Bearer ${actors[actorIndex].token}`, apikey: publishableKey,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    return { status: response.status, body: payload };
  };
  const upload = async (actorIndex, sessionId, bytes, filename = 'lesson.pdf') => {
    const response = await fetch(`${base}learning-sessions/${sessionId}/materials/files`, {
      method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${actors[actorIndex].token}`, apikey: publishableKey,
        'content-type': 'application/pdf', 'x-file-name': encodeURIComponent(filename) }, body: bytes,
      signal: AbortSignal.timeout(20000),
    });
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    return { status: response.status, body: payload };
  };

  phase = 'capabilities';
  const capabilities = await call(0, 'capabilities');
  assert.equal(capabilities.status, 200);
  assert.deepEqual(capabilities.body.data, { assessments: true, fileUploads: true });
  capture('Assessment and file-upload API capabilities enabled only in this local app instance');

  phase = 'session-and-text';
  const created = await call(0, 'learning-sessions', { method: 'POST', body: {
    title: 'Activation journey', subject: 'Physics', learningGoal: "Learn Ohm's law",
  } });
  assert.equal(created.status, 201, JSON.stringify(created.body?.error));
  const sessionId = created.body.data.id;
  sessionIds.push(sessionId);
  if (realStorageMode) realStorageSessionIds.push(sessionId);
  assert.match(sessionId, /^[0-9a-f-]{36}$/iu);
  const sessionOwner = await database.query(`SELECT "userId" FROM public."LearningSession" WHERE id = $1`, [sessionId]);
  assert.equal(sessionOwner.rows[0]?.userId, actors[0].appId, 'API must preserve the legacy application user ID');
  const text = 'Ohm’s law relates voltage, current, and resistance: V = I × R. A 2 A current through 5 Ω gives 10 V.';
  const material = await call(0, `learning-sessions/${sessionId}/materials`, { method: 'POST', body: { type: 'TEXT', text } });
  assert.equal(material.status, 201, JSON.stringify(material.body?.error));
  assert.equal(material.body.data.normalizedText, text);
  assert.equal(material.body.data.sizeBytes, Buffer.byteLength(text));
  const listedMaterials = await call(0, `learning-sessions/${sessionId}/materials`);
  assert.equal(listedMaterials.status, 200);
  assert.equal(listedMaterials.body.data[0].normalizedText, text);
  capture('Create session and persist learner text material under the legacy owner ID', { sessionId });

  phase = 'file-upload-review-download';
  const pdfBytes = textPdf(['Voltage = Current * Resistance']);
  const uploaded = await upload(0, sessionId, pdfBytes);
  if (uploaded.status !== 201) failureDetails = { uploadStatus: uploaded.status, uploadCode: safeErrorCode({ code: uploaded.body?.error?.code }), storageHttpStatuses: [...storageHttpStatuses] };
  assert.equal(uploaded.status, 201, `Upload failed with HTTP ${uploaded.status} (${safeErrorCode({ code: uploaded.body?.error?.code })})`);
  const fileId = uploaded.body.data.id;
  const uploadRows = await database.query(`SELECT state FROM public."FileUpload" WHERE id = $1 AND "learningSessionId" = $2`, [fileId, sessionId]);
  assert.equal(uploadRows.rows[0]?.state, 'FINALIZED');
  const uploadHistory = await call(0, 'users/me/files/uploads');
  assert.equal(uploadHistory.status, 200);
  assert.equal(uploadHistory.body.data.items.some(item => item.id === fileId), false, 'finalized uploads must leave the unresolved receipt journal');
  const fileHistory = await call(0, 'users/me/files');
  assert.equal(fileHistory.status, 200);
  assert.ok(fileHistory.body.data.items.some(item => item.id === fileId), 'finalized file must appear in learner material history');
  const fileJournal = await call(0, `learning-sessions/${sessionId}/materials/uploads`);
  assert.equal(fileJournal.status, 200);
  assert.ok(fileJournal.body.data.some(item => item.id === fileId && item.state === 'FINALIZED'));
  const reviewedText = 'Learner-approved extracted text: voltage equals current times resistance.';
  const reviewed = await call(0, `learning-sessions/${sessionId}/materials/${fileId}/review`, { method: 'PATCH', body: { text: reviewedText } });
  assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body?.error));
  assert.equal(reviewed.body.data.normalizedText, reviewedText);
  const reviewedRecord = await database.query(`SELECT "normalizedText", metadata->>'reviewedByLearner' AS reviewed
    FROM public."SourceMaterial" WHERE id = $1 AND "learningSessionId" = $2`, [fileId, sessionId]);
  assert.equal(reviewedRecord.rows[0]?.reviewed, 'true');
  const extractedText = realStorageMode ? 'Voltage = Current * Resistance' : 'Extracted Ohm law fixture: V = I × R.';
  assert.equal(reviewedRecord.rows[0]?.normalizedText, extractedText);
  const download = await fetch(`${base}learning-sessions/${sessionId}/materials/${fileId}/file`, {
    redirect: 'error', headers: { authorization: `Bearer ${actors[0].token}`, apikey: publishableKey }, signal: AbortSignal.timeout(10000),
  });
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdfBytes);
  const storageKey = `${actors[0].authId}/${sessionId}/${fileId}.pdf`;
  const foreignStorageRead = await fetch(`${localAuthUrl}/storage/v1/object/authenticated/learnly-materials/${storageKey.split('/').map(encodeURIComponent).join('/')}`, {
    redirect: 'error', headers: { authorization: `Bearer ${actors[1].token}`, apikey: publishableKey }, signal: AbortSignal.timeout(10000),
  });
  const foreignStorageStatus = foreignStorageRead.status;
  await foreignStorageRead.body?.cancel();
  assert.ok([400, 403, 404].includes(foreignStorageStatus), 'other owner must be denied direct Storage object access');
  assert.equal((await call(1, `learning-sessions/${sessionId}/materials/uploads`)).status, 404);
  assert.equal((await call(1, `learning-sessions/${sessionId}/materials/${fileId}/file`)).status, 404);
  capture('Direct local Storage object access is denied to the second owner', { httpStatus: foreignStorageStatus });
  capture('File upload journal finalizes in PostgreSQL; review metadata and owner-gated download persist', { fileId,
    storageBoundary: realStorageMode ? 'Actual private Supabase Storage over the local HTTPS gateway; PDF.js extraction and PostgreSQL/RLS persistence' :
      'Deterministic local Storage transport and extractor; FileUpload/SourceMaterial are actual Prisma/RLS persistence' });

  phase = 'file-cancel-race';
  const cancelSession = await call(0, 'learning-sessions', { method: 'POST', body: { title: 'Upload cancellation race', subject: 'Physics' } });
  assert.equal(cancelSession.status, 201, JSON.stringify(cancelSession.body?.error));
  const cancelSessionId = cancelSession.body.data.id;
  sessionIds.push(cancelSessionId);
  fixtureStorageSessions.add(cancelSessionId);
  pauseNextUpload = true;
  const pendingUploadPromise = upload(0, cancelSessionId, pdfBytes, 'cancel-me.pdf');
  let pendingRow;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await database.query(`SELECT id, state FROM public."FileUpload" WHERE "learningSessionId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [cancelSessionId]);
    pendingRow = result.rows[0];
    if (pendingRow?.state === 'PENDING' && unblockUpload) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(pendingRow?.state, 'PENDING');
  const cancelled = await call(0, `learning-sessions/${cancelSessionId}/materials/uploads/${pendingRow.id}/cancel`, { method: 'POST', body: {} });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body?.error));
  assert.equal(cancelled.body.data.status, 'CANCELLED');
  unblockUpload?.();
  const pendingUploadResult = await pendingUploadPromise;
  assert.ok([409, 503].includes(pendingUploadResult.status));
  const finalReceipt = await database.query(`SELECT state, "cleanupAt" FROM public."FileUpload" WHERE id = $1`, [pendingRow.id]);
  assert.equal(finalReceipt.rows[0]?.state, 'CANCELLED');
  assert.ok(finalReceipt.rows[0]?.cleanupAt);
  assert.equal(storedObjects.has(`${actors[0].authId}/${cancelSessionId}/${pendingRow.id}.pdf`), false);
  capture('Cancellation racing an in-flight Storage upload leaves a cleaned CANCELLED durable receipt');

  phase = 'pre-assessment';
  const prePath = `learning-sessions/${sessionId}/assessments/PRE`;
  const pre = await call(0, prePath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(pre.status, 201, JSON.stringify(pre.body?.error));
  const preAnswers = expectedAnswers(pre.body.data.questions);
  const submittedPre = await call(0, `${prePath}/submissions`, { method: 'POST', body: { answers: preAnswers } });
  assert.equal(submittedPre.status, 200, JSON.stringify(submittedPre.body?.error));
  assert.equal(submittedPre.body.data.score, 3);
  assert.equal(submittedPre.body.data.answers.length, 3);
  capture('PRE assessment persists score and answer rows through the API');

  phase = 'learning';
  const respond = await call(0, `learning-sessions/${sessionId}/interactions`, { method: 'POST', body: { input: 'Explain the relationship between voltage and current using my notes.' } });
  assert.equal(respond.status, 200, JSON.stringify(respond.body?.error));
  const advancePractice = await call(0, `learning-sessions/${sessionId}/interactions`, { method: 'POST', body: { action: 'ADVANCE' } });
  assert.equal(advancePractice.status, 200, JSON.stringify(advancePractice.body?.error));
  const practice = await call(0, `learning-sessions/${sessionId}/interactions`, { method: 'POST', body: { input: 'If resistance doubles at a fixed voltage, what happens to current?' } });
  assert.equal(practice.status, 200, JSON.stringify(practice.body?.error));
  const advanceAssess = await call(0, `learning-sessions/${sessionId}/interactions`, { method: 'POST', body: { action: 'ADVANCE' } });
  assert.equal(advanceAssess.status, 200, JSON.stringify(advanceAssess.body?.error));
  const assessState = await database.query(`SELECT stage, state, "userId" FROM public."LearningSession" WHERE id = $1`, [sessionId]);
  assert.deepEqual(assessState.rows[0], { stage: 'ASSESS', state: 'POST_TEST', userId: actors[0].appId });
  capture('Text learning interactions advance persisted session through PRACTICE to ASSESS');

  phase = 'post-assessment-and-profile';
  const postPath = `learning-sessions/${sessionId}/assessments/POST`;
  const post = await call(0, postPath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(post.status, 201, JSON.stringify(post.body?.error));
  const wrongPostAnswers = expectedAnswers(post.body.data.questions).map(answer => ({ ...answer, answer: answer.answer + 10000 }));
  const postSubmission = await call(0, `${postPath}/submissions`, { method: 'POST', body: { answers: wrongPostAnswers } });
  assert.equal(postSubmission.status, 200, JSON.stringify(postSubmission.body?.error));
  assert.equal(postSubmission.body.data.score, 0);
  assert.equal(postSubmission.body.data.answers.filter(answer => answer.isCorrect).length, 0);
  const exactRetry = await call(0, `${postPath}/submissions`, { method: 'POST', body: { answers: [...wrongPostAnswers].reverse() } });
  assert.equal(exactRetry.status, 200, JSON.stringify(exactRetry.body?.error));
  const conflict = await call(0, `${postPath}/submissions`, { method: 'POST', body: { answers: expectedAnswers(post.body.data.questions) } });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, 'ASSESSMENT_CONFLICT');
  const profileResponse = await call(0, 'users/me/learning-profile');
  assert.equal(profileResponse.status, 200);
  assert.equal(profileResponse.body.data.mastery['ohms-law'].percent, 0);
  const progressResponse = await call(0, 'users/me/progress');
  assert.equal(progressResponse.status, 200);
  const comparison = progressResponse.body.data.comparisons.find(item => item.sessionId === sessionId);
  assert.deepEqual([comparison?.prePercent, comparison?.postPercent, comparison?.deltaPercent], [100, 0, -100]);
  capture('POST zero score, exact retry idempotency, conflict rejection, persisted profile/progress');

  phase = 'owner-isolation';
  assert.equal((await call(1, `learning-sessions/${sessionId}`)).status, 404);
  assert.equal((await call(1, `learning-sessions/${sessionId}/assessments/POST`)).status, 404);
  assert.deepEqual((await call(1, 'users/me/learning-profile')).body.data.mastery, {});
  capture('Second local identity cannot read another learner session, assessment or profile');

  phase = 'direct-write-rls';
  const assessmentId = post.body.data.id;
  const visibleScore = actorClients[0].raw.sql`SELECT score FROM public."Assessment" WHERE id = ${assessmentId}`
    .returnsRow({ score: 'pg/int4@1' }).build();
  assert.equal((await actorClients[0].query(visibleScore).toArray())[0]?.score, 0, 'the authenticated client must read its own persisted row');
  const ownWrite = actorClients[0].raw.sql`UPDATE public."Assessment" SET score = 99 WHERE id = ${assessmentId}`.affectedCount().build();
  let ownRows = 0, ownWriteSqlState = null;
  try { ownRows = (await actorClients[0].execute(ownWrite)).affectedRows; }
  catch (error) { const codes = safeErrorCodes(error); failureDetails = { directOwnWriteCodes: codes }; assert.ok(codes.includes('42501'), 'write failure must expose PostgreSQL SQLSTATE 42501'); ownWriteSqlState = '42501'; }
  assert.equal(ownRows, 0, 'direct authenticated client must not write its own score');
  const foreignWrite = actorClients[1].raw.sql`UPDATE public."Assessment" SET score = 99 WHERE id = ${assessmentId}`.affectedCount().build();
  let foreignRows = 0, foreignWriteSqlState = null;
  try { foreignRows = (await actorClients[1].execute(foreignWrite)).affectedRows; }
  catch (error) { const codes = safeErrorCodes(error); failureDetails = { ...(failureDetails ?? {}), directForeignWriteCodes: codes }; assert.ok(codes.includes('42501'), 'foreign write failure must expose PostgreSQL SQLSTATE 42501'); foreignWriteSqlState = '42501'; }
  assert.equal(foreignRows, 0, 'direct authenticated client must not write another owner score');
  const storedScore = await database.query(`SELECT score FROM public."Assessment" WHERE id = $1`, [assessmentId]);
  assert.equal(storedScore.rows[0]?.score, 0);
  capture('Direct authenticated SQL cannot alter own or another owner assessment score', { ownWriteRows: ownRows,
    ownWriteSqlState, foreignWriteRows: foreignRows, foreignWriteSqlState });

  phase = 'rollback';
  const transferPath = `learning-sessions/${sessionId}/assessments/TRANSFER`;
  const transfer = await call(0, transferPath, { method: 'POST', body: { topic: 'ohms-law', language: 'en' } });
  assert.equal(transfer.status, 201, JSON.stringify(transfer.body?.error));
  const store = new PrismaAssessmentStore(actorClients[0], actors[0].appId);
  const record = await store.getAssessment(sessionId, 'TRANSFER');
  const profileBeforeRollback = await store.getLearningProfile();
  const answers = expectedAnswers(transfer.body.data.questions).map(item => ({ questionId: item.questionId,
    response: item.answer, isCorrect: true, awardedScore: 1 }));
  let rollbackError;
  try { await store.submitAssessment(record, [answers[0], answers[0], answers[2]], 'fault-injection-only', new Date().toISOString()); }
  catch (error) { rollbackError = error; }
  assert.ok(rollbackError, 'duplicate answer fixture must fail');
  assert.ok(safeErrorCodes(rollbackError).includes('23505'), 'duplicate answer fixture must fail with unique-constraint SQLSTATE 23505');
  const afterRollback = await store.getAssessment(sessionId, 'TRANSFER');
  assert.equal(afterRollback.score, null);
  assert.equal(afterRollback.submittedAt, null);
  assert.deepEqual(await store.getAnswers(afterRollback.id), []);
  assert.deepEqual(await store.getLearningProfile(), profileBeforeRollback);
  capture('Answer uniqueness SQLSTATE 23505 rolls back assessment score/answers/profile atomically');

  phase = 'completion-history';
  const completed = await call(0, `learning-sessions/${sessionId}/interactions`, { method: 'POST', body: { action: 'ADVANCE' } });
  assert.equal(completed.status, 200, JSON.stringify(completed.body?.error));
  const history = await call(0, 'learning-sessions');
  assert.equal(history.status, 200);
  const historyItem = history.body.data.find(item => item.id === sessionId);
  assert.equal(historyItem?.stage, 'REVIEW');
  assert.equal(historyItem?.lifecycleState, 'COMPLETED');
  const detail = await call(0, `learning-sessions/${sessionId}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.data.materials.some(item => item.id === material.body.data.id && item.normalizedText === text));
  assert.ok(detail.body.data.materials.some(item => item.id === fileId && item.normalizedText === reviewedText));
  assert.ok(detail.body.data.messages.some(message => message.role === 'USER'));
  capture('Completed lesson restores in History with persisted transcript and learner text');

  finalReport = { category: 'LOCAL_ENABLED_FEATURE_PRISMA_RLS_JOURNEY', databaseName, evidence,
    limitations: ['Local Supabase Auth and local database only; no production account, data or model provider',
      realStorageMode ? 'Cancellation race uses the deterministic Storage adapter after real Storage upload/download coverage' :
        'Private Storage transport is a deterministic local fixture; PostgreSQL upload journal and material ownership are real'] };
} catch (error) {
  const sourceLocation = String(error?.stack ?? '').match(/verify-enabled-feature-journey\.mjs:(\d+):(\d+)/u);
  failureReport = { phase, failed: true, code: safeErrorCode(error), ...(sourceLocation ? { sourceLine: Number(sourceLocation[1]) } : {}), ...failureDetails };
  process.exitCode = 1;
} finally {
  unblockUpload?.();
  if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
  storedObjects.clear();
  if (database) {
    try {
      const ids = [...new Set(sessionIds)];
      if (ids.length) {
        if (realStorageMode && realStorageSessionIds.length) {
          const objects = await database.query(`SELECT DISTINCT storage_key AS "storageKey" FROM (
            SELECT material->>'storageKey' AS storage_key FROM public."FileUpload" WHERE "learningSessionId" = ANY($1::text[])
            UNION ALL
            SELECT "storageKey" FROM public."SourceMaterial" WHERE "learningSessionId" = ANY($1::text[]) AND "storageKey" IS NOT NULL
          ) AS fixture_objects WHERE storage_key IS NOT NULL`, [realStorageSessionIds]);
          for (const { storageKey } of objects.rows) {
            if (!actors.some(actor => realStorageSessionIds.some(sessionId => storageKey.startsWith(`${actor.authId}/${sessionId}/`)))) {
              throw new Error('Fixture storage key escaped generated owner/session prefix');
            }
            const response = await fetch(`${localAuthUrl}/storage/v1/object/learnly-materials`, {
              method: 'DELETE', redirect: 'error', headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
              body: JSON.stringify({ prefixes: [storageKey] }), signal: AbortSignal.timeout(10000),
            });
            await response.body?.cancel();
            if (!response.ok) throw new Error('Local fixture Storage cleanup failed');
          }
          if (objects.rowCount) {
            const remaining = await database.query(`SELECT count(*)::int AS count FROM storage.objects
              WHERE bucket_id = 'learnly-materials' AND name = ANY($1::text[])`, [objects.rows.map(row => row.storageKey)]);
            if (remaining.rows[0]?.count !== 0) throw new Error('Generated fixture Storage objects remain after cleanup');
            storageKeysVerifiedAbsent = objects.rowCount;
          }
        }
        await database.query(`DELETE FROM public."AssessmentAnswer" WHERE "assessmentId" IN
          (SELECT id FROM public."Assessment" WHERE "learningSessionId" = ANY($1::text[]))`, [ids]);
        for (const table of ['"Assessment"', '"Message"', '"SourceMaterial"', '"FileUpload"', '"AIRequest"']) {
          await database.query(`DELETE FROM public.${table} WHERE "learningSessionId" = ANY($1::text[])`, [ids]);
        }
        await database.query(`DELETE FROM public."LearningSession" WHERE id = ANY($1::text[])`, [ids]);
      }
      await database.query(`DELETE FROM public."LearningProfile" WHERE "userId" = ANY($1::text[])`, [actors.map(actor => actor.appId)]);
      await database.query(`DELETE FROM public."User" WHERE id = ANY($1::text[])`, [actors.map(actor => actor.appId)]);
      databaseCleanupSucceeded = true;
    } catch { cleanupSucceeded = false; process.exitCode = 1; }
    try { await database.end(); } catch { cleanupSucceeded = false; process.exitCode = 1; }
  }
  if (!databaseCleanupSucceeded && authUsers.length) {
    // Keep synthetic Auth identities when their DB rows could not be cleaned;
    // deleting them would make leftover local fixture data harder to inspect.
    cleanupSucceeded = false;
    process.exitCode = 1;
  } else {
    for (const id of authUsers) {
      try { await authRequest(`/auth/v1/admin/users/${id}`, { key: serviceRoleKey, bearer: serviceRoleKey, method: 'DELETE' }); authUsersRemoved += 1; }
      catch { cleanupSucceeded = false; process.exitCode = 1; }
    }
  }
  if (apiDb) { try { await apiDb.close(); } catch { cleanupSucceeded = false; process.exitCode = 1; } }
  if (orm) { try { await orm.close(); } catch { cleanupSucceeded = false; process.exitCode = 1; } }
}

if (failureReport) console.error(JSON.stringify({ ...failureReport, cleanupSucceeded, databaseCleanupSucceeded, storageKeysVerifiedAbsent, authUsersRemoved }));
else if (finalReport && cleanupSucceeded) console.log(JSON.stringify({ ...finalReport,
  cleanup: { databaseRowsRemoved: databaseCleanupSucceeded, storageKeysVerifiedAbsent, authUsersRemoved, allCleanupSucceeded: cleanupSucceeded } }, null, 2));
else {
  process.exitCode = 1;
  console.error(JSON.stringify({ phase: 'cleanup', failed: true, code: 'CLEANUP_FAILED' }));
}
