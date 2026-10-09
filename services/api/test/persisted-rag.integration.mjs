// Verification-only harness: actual router/auth/engine/retriever/validators/Prisma
// persistence and JSON decoder, with a simulated role-bound database and auth service.
// This does not prove real PostgreSQL RLS or deployed browser behavior.
import assert from 'node:assert/strict';
import { test, mock, after } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const api = resolve(import.meta.dirname, '..');
const load = path => import(pathToFileURL(resolve(api, path)).href);
const realFetch = globalThis.fetch;
const originalEnv = { AI_PROVIDER: process.env.AI_PROVIDER, SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY, KNOWLEDGE_ROOT: process.env.KNOWLEDGE_ROOT };
process.env.AI_PROVIDER = 'mock';
process.env.SUPABASE_URL = 'https://synthetic-auth.test';
process.env.SUPABASE_PUBLISHABLE_KEY = 'synthetic-public-test-key';
delete process.env.KNOWLEDGE_ROOT;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://synthetic-auth.test/auth/v1/user')) {
    const id = { 'Bearer test-token-a': 'synthetic-user-a', 'Bearer test-token-b': 'synthetic-user-b' }[init.headers.authorization];
    return id ? Response.json({ id, email: `${id}@example.invalid`, user_metadata: { full_name: 'Synthetic Learner' } }) : Response.json({}, { status: 401 });
  }
  assert.ok(String(url).startsWith('http://127.0.0.1:'), 'Offline verification must not call external services');
  return realFetch(url, init);
};
let store;
function reset() { store = { User: [], LearningSession: [], Message: [], writes: 0, boundUsers: [] }; }
const clone = x => x === undefined ? undefined : structuredClone(x);
function dbClient(userId) {
  const visible = (table, row) => table === 'User' ? row.id === userId : table === 'LearningSession' ? row.userId === userId : store.LearningSession.some(s => s.id === row.learningSessionId && s.userId === userId);
  function tableApi(table, filters = {}) {
    const rows = () => store[table].filter(row => visible(table, row) && Object.entries(filters).every(([key,value]) => row[key] === value));
    return {
      where: more => tableApi(table, { ...filters, ...more }), select: () => tableApi(table, filters),
      orderBy: () => tableApi(table, filters), first: async () => clone(rows()[0] ?? null), all: async () => clone(rows()),
      update: async values => { const row = rows()[0]; if (!row) return 0; Object.assign(row, clone(values)); store.writes++; return 1; },
      create: async row => { assert.ok(visible(table,row)); store[table].push(clone(row)); store.writes++; return clone(row); },
    };
  }
  const sql = (strings, ...values) => {
    const plan = { text: strings.join('?'), values };
    const builder = { affectedCount: () => builder, returnsRow: () => builder, build: () => plan };
    return builder;
  };
  return {
    orm: { public: Object.fromEntries(['User','LearningSession','Message'].map(table => [table, tableApi(table)])) }, raw: { sql },
    query: plan => ({ toArray: async () => {
      if (/FROM public\."SourceMaterial"/.test(plan.text)) return [];
      if (/FROM public\."Assessment"/.test(plan.text)) return [];
      assert.match(plan.text, /SELECT[\s\S]+FROM public\."Message"/);
      const [sessionId] = plan.values;
      return clone(store.Message.filter(m => m.learningSessionId === sessionId && visible('Message',m)).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(({content,...row}) => ({ ...row, contentJson: JSON.stringify(content) })));
    }}),
    transaction: async fn => {
      const snapshot = clone(store);
      let apiWrite = false;
      try { return await fn({ execute: async plan => {
        if (/set_config\('learnly.api_write'/.test(plan.text)) { apiWrite = true; return { affectedRows: 1 }; }
        assert.ok(apiWrite, 'Server-managed writes require the transaction-local API context');
        if (/INSERT INTO public\."LearningSession"/.test(plan.text)) {
          const [id, owner, title, goal, subject, state, lifecycleState, stage, progressPercent, version, createdAt, updatedAt] = plan.values;
          assert.equal(owner, userId);
          if (store.LearningSession.some(row => row.id === id)) return { affectedRows: 0 };
          store.LearningSession.push({ id, userId: owner, title, learningGoal: goal || null, subject: subject || null,
            state, lifecycleState, stage, progressPercent, version, createdAt, updatedAt, completedAt: null });
          store.writes++; return { affectedRows: 1 };
        }
        if (/UPDATE public\."LearningSession"/.test(plan.text)) {
          const [goal,subject,state,lifecycleState,stage,progressPercent,version,updatedAt,id,owner,expected] = plan.values;
          const row = store.LearningSession.find(s => s.id === id && s.userId === owner && s.userId === userId && s.version === expected);
          if (!row) return { affectedRows: 0 };
          Object.assign(row, { learningGoal: goal || null, subject: subject || null, state,lifecycleState,stage,progressPercent,version,updatedAt });
          store.writes++; return { affectedRows: 1 };
        }
        assert.match(plan.text, /INSERT INTO public\."Message"/);
        const [id,learningSessionId,role,contentJson,createdAt] = plan.values;
        assert.ok(store.LearningSession.some(s => s.id === learningSessionId && s.userId === userId));
        store.Message.push({ id,learningSessionId,role,content: JSON.parse(contentJson),createdAt });
        store.writes++; return { affectedRows: 1 };
      }}); } catch(error) { store = snapshot; throw error; }
    },
  };
}
mock.module(pathToFileURL(resolve(api, 'dist/prisma/db.js')), { namedExports: { getDb: async () => ({ asUser: token => {
  const userId = { 'test-token-a': 'synthetic-user-a', 'test-token-b': 'synthetic-user-b' }[token];
  assert.ok(userId, 'Only validated synthetic bearer tokens may reach the DB');
  store.boundUsers.push(userId); return dbClient(userId);
}}) }});
const { createApp } = await load('dist/app.js');
const { MockModelProvider } = await load('dist/modules/ai/providers/mock-model-provider.js');
const { mockTutorScenario } = await load('dist/modules/ai/mock-tutor-scenario.js');
const { validateTutorOutput } = await load('dist/modules/ai/tutor-output-validator.js');
after(() => { globalThis.fetch = realFetch; mock.restoreAll(); for (const [key,value] of Object.entries(originalEnv)) { if(value === undefined) delete process.env[key]; else process.env[key] = value; } });
async function withApp(scenario, run) {
  reset(); const requests = [];
  const provider = new MockModelProvider({ scenario: request => { requests.push(request); return scenario(request); } });
  const server = createApp({ modelProvider: provider }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/v1/learning-sessions`;
  const call = async (path='', { token='test-token-a', method='GET', body }={}) => {
    const response = await fetch(base+path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  try { await run({ call,requests }); } finally { server.closeIdleConnections(); await new Promise((resolve,reject) => server.close(e => e ? reject(e) : resolve())); }
}
async function session(call) {
  const r = await call('', { method: 'POST', body: { title: 'Synthetic RAG verification', subject: 'physics' } });
  assert.equal(r.status,201); return r.body.data.id;
}
test('creating another learning session preserves the user-selected profile avatar', async () => {
  await withApp(mockTutorScenario, async ({ call }) => {
    await session(call);
    store.User[0].avatarUrl = 'https://example.invalid/custom-avatar.png';
    await session(call);
    assert.equal(store.User[0].avatarUrl, 'https://example.invalid/custom-avatar.png');
  });
});
test('authenticated persisted route retrieves reviewed Knowledge, restores citations and uses history with engine-owned metadata', async () => {
  await withApp(request => ({ ...mockTutorScenario(request), sessionId: 'foreign-session', responseId: 'foreign-response', stage:'COMPLETED', progress: { percent:100,canAdvance:false,nextAction:null } }), async ({ call,requests }) => {
    const id = await session(call);
    const first = await call(`/${id}/interactions`, { method:'POST', body:{ input:"Explain Ohm's law." } });
    assert.equal(first.status,200); const output = first.body.data;
    assert.deepEqual(validateTutorOutput(output),{valid:true,errors:[]});
    assert.equal(output.sessionId,id); assert.notEqual(output.responseId,'foreign-response');
    assert.equal(output.stage,'LEARNING'); assert.equal(output.progress.percent,25);
    assert.match(output.citations[0].id, /@0\.2\.0:teaching-v1$/);
    assert.deepEqual(output.blocks[0].citationIds,[output.citations[0].id]);
    const detail = await call(`/${id}`); assert.equal(detail.status,200);
    assert.equal(detail.body.data.messages.length,2);
    assert.deepEqual(detail.body.data.messages.find(m => m.role==='TUTOR').content,output);
    const followup = await call(`/${id}/interactions`, { method:'POST',body:{input:"What if resistance doubles at constant voltage?"} });
    assert.equal(followup.status,200); assert.equal(followup.body.data.progress.percent,25);
    assert.deepEqual(followup.body.data.blocks[0].citationIds, [output.citations[0].id]);
    assert.equal(requests.length,2); assert.equal(requests[1].messages.length-2,2);
    assert.ok(requests[1].messages.some(m => m.role==='assistant' && JSON.parse(m.content).responseId===output.responseId));
    assert.equal((await call(`/${id}`)).body.data.messages.length,4);
    assert.equal(store.LearningSession[0].stage,'EXPLAIN'); assert.equal(store.LearningSession[0].lifecycleState,'ACTIVE');
  });
});
test('no-match persisted interaction has no trusted citations', async () => {
  await withApp(mockTutorScenario, async ({ call,requests }) => {
    const id = await session(call);
    const r = await call(`/${id}/interactions`, {method:'POST',body:{input:'Explain photosynthesis.'}});
    assert.equal(r.status,200); assert.deepEqual(r.body.data.citations,[]);
    assert.deepEqual(JSON.parse(requests[0].messages.at(-1).content).sourceMaterials,[]);
  });
});
test('pending pre-test and missing post-test gate learning/complete before model calls or writes', async () => {
  await withApp(mockTutorScenario, async ({ call, requests }) => {
    const id = await session(call);
    store.LearningSession[0].state = 'PRE_TEST';
    const before = store.writes;
    const pre = await call(`/${id}/interactions`, { method: 'POST', body: { input: "Explain Ohm's law" } });
    assert.equal(pre.status, 400); assert.equal(pre.body.error.code, 'INVALID_STAGE_TRANSITION');
    store.LearningSession[0].state = 'POST_TEST'; store.LearningSession[0].stage = 'ASSESS';
    const post = await call(`/${id}/interactions`, { method: 'POST', body: { action: 'ADVANCE' } });
    assert.equal(post.status, 400); assert.equal(post.body.error.code, 'INVALID_STAGE_TRANSITION');
    assert.equal(requests.length, 0); assert.equal(store.writes, before); assert.equal(store.Message.length, 0);
  });
});
for(const mode of ['missing','invalid']) test(`${mode} Knowledge rejects persisted interaction with no model call or turn writes`, async () => {
  const root = mkdtempSync(join(tmpdir(),'learnly-merged-rag-'));
  try {
    if(mode==='invalid') { cpSync(resolve(api,'runtime-knowledge'),root,{recursive:true}); writeFileSync(join(root,'build/concepts/physics/electricity/ohms-law.json'),'{bad-json'); }
    process.env.KNOWLEDGE_ROOT = root;
    await withApp(mockTutorScenario, async ({call,requests}) => {
      const id = await session(call); const before = store.writes;
      const r = await call(`/${id}/interactions`, {method:'POST',body:{input:"Explain Ohm's law."}});
      assert.equal(r.status,503); assert.equal(r.body.error.code,'KNOWLEDGE_UNAVAILABLE');
      assert.equal(requests.length,0); assert.equal(store.writes,before); assert.equal(store.Message.length,0);
      assert.equal(store.LearningSession[0].version,0);
    });
  } finally { delete process.env.KNOWLEDGE_ROOT; assert.equal(dirname(root),resolve(tmpdir())); assert.ok(root.startsWith(join(resolve(tmpdir()),'learnly-merged-rag-'))); rmSync(root,{recursive:true,force:true}); }
});
for(const mode of ['invalid-json','fabricated-citation']) test(`${mode} provider output is rejected and never persisted as tutor content`, async () => {
  await withApp(request => {
    if(mode==='invalid-json') return '{invalid';
    const output = mockTutorScenario(request); output.citations[0].id='fabricated'; output.blocks[0].citationIds=['fabricated']; return output;
  }, async ({call}) => {
    const id = await session(call);
    const r = await call(`/${id}/interactions`,{method:'POST',body:{input:"Explain Ohm's law."}});
    assert.equal(r.status,502); assert.equal(r.body.error.code,'AI_INVALID_OUTPUT');
    assert.deepEqual(r.body.error.details,[]); assert.equal(store.Message.length,0);
    assert.equal(store.LearningSession[0].lifecycleState,'FAILED');
  });
});
test('auth rejects missing/invalid bearer before DB and a second user cannot access another session in the simulated DB', async () => {
  await withApp(mockTutorScenario, async ({call,requests}) => {
    assert.equal((await call('',{token:null})).status,401);
    assert.equal((await call('',{token:'invalid-token'})).status,401); assert.equal(store.boundUsers.length,0);
    const id = await session(call);
    assert.equal((await call(`/${id}`,{token:'test-token-b'})).status,404);
    assert.equal((await call(`/${id}/interactions`,{token:'test-token-b',method:'POST',body:{input:"Explain Ohm's law."}})).status,404);
    assert.equal(requests.length,0); assert.equal(store.Message.length,0);
  });
});
