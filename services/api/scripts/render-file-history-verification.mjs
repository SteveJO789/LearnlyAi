// Render-only current canonical rollback fixture + actual compiled file-history SQL.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PrismaFileHistory, fileHistoryQuery } from '../dist/modules/input/file-history.js';
const schema = 'learnly_history_verify', quoted = '"' + schema + '"';
const baseline = execFileSync(process.execPath, ['scripts/render-historical-migration-verification.mjs', '--path=fresh'],
  { cwd: new URL('../', import.meta.url), encoding: 'utf8', maxBuffer: 200000 });
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";
const plans = [];
const client = { raw: { sql: (parts, ...values) => ({ returnsRow: () => ({ build: () => {
  const sql = parts.map((part, i) => part + (i < values.length ? literal(values[i]) : '')).join('');
  return sql.replaceAll('public.', quoted + '.');
} }) }) }, query: sql => ({ toArray: async () => { plans.push(sql); return []; } }) };
const a = '11111111-1111-4111-8111-11111111ad01';
for (const [owner, query] of [[a, {}], [a, { from: '2026-10-11', to: '2026-10-11' }], [a, { after: 'a-extra-25' }], ['legacy-preserved-user', {}]]) {
  await new PrismaFileHistory(client, owner).list(fileHistoryQuery(query));
}
const check = (sql, message) => `DO $$ BEGIN IF NOT COALESCE((${sql}), false) THEN RAISE EXCEPTION '${message}'; END IF; END $$;`;
const extra = `
INSERT INTO ${quoted}."LearningSession" (id,"userId",title,state,"lifecycleState",stage,"progressPercent",version,"createdAt","updatedAt") VALUES
('files-a','${a}','Synthetic file session','INPUT','ACTIVE','EXPLAIN',0,0,now(),now()),
('files-b','legacy-preserved-user','Synthetic closed legacy session','COMPLETED','COMPLETED','REVIEW',100,3,now(),now());
INSERT INTO ${quoted}."SourceMaterial" (id,"learningSessionId",type,status,"storageKey","storageBucket","normalizedText","contentHash","mimeType","sizeBytes",metadata) VALUES
('a-file-known','files-a','PDF','READY','${a}/files-a/a-file-known.pdf','learnly-materials','x² = 9',repeat('a',64),'application/pdf',12,'{"filename":"synthetic.pdf","learningText":"x² = 16","reviewedByLearner":true}'),
('b-file-unknown','files-b','IMAGE','READY','11111111-1111-4111-8111-11111111ad02/files-b/b-file-unknown.png','learnly-materials','legacy text',repeat('b',64),'image/png',12,'{"filename":"synthetic.png"}');
INSERT INTO ${quoted}."FileUpload" (id,"learningSessionId",state,material,"createdAt") VALUES
('a-file-known','files-a','FINALIZED','{}','2026-10-10T18:00:00Z');
INSERT INTO ${quoted}."SourceMaterial" (id,"learningSessionId",type,status,"storageKey","storageBucket","normalizedText","contentHash","mimeType","sizeBytes",metadata)
SELECT 'a-extra-' || lpad(n::text,2,'0'),'files-a','PDF','READY','${a}/files-a/a-extra-' || lpad(n::text,2,'0') || '.pdf','learnly-materials','synthetic page',repeat('c',64),'application/pdf',12,'{"filename":"synthetic.pdf"}' FROM generate_series(1,27) n;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"${a}","role":"authenticated"}',true);
${check(`SELECT count(*) = 26 FROM (${plans[0]}) page`, 'Bounded first-page SQL failed')}
${check(`SELECT count(*) = 1 AND bool_and(id = 'a-file-known' AND "normalizedText" = 'x² = 16' AND "reviewedByLearner" AND "canReview") FROM (${plans[1]}) day`, 'Thai-day filter/confirmed correction/active review gate failed')}
${check(`SELECT count(*) = 3 FROM (${plans[2]}) next_page`, 'Cursor continuation failed')}
${check(`SELECT count(*) = 0 FROM (${plans[3]}) foreign_page`, 'Foreign file owner leakage')}
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-11111111ad02","role":"authenticated"}',true);
${check(`SELECT count(*) = 1 AND bool_and(id = 'b-file-unknown' AND "uploadedAt" = '' AND NOT "canReview") FROM (${plans[3]}) legacy_page`, 'Legacy owner/date/closed review gate failed')}
${check(`SELECT count(*) = 0 FROM (${plans[0]}) foreign_page`, 'Peer sees first owner files')}
RESET ROLE;
`;
const ending = 'RESET ROLE;\nROLLBACK;';
if (!baseline.includes(ending) || /\bpublic\./u.test(extra)) throw Error('Unexpected fixture template or unscoped SQL');
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (!output) throw Error('Explicit scratch output path required');
writeFileSync(output, baseline.replace(ending, ending.replace('ROLLBACK;', extra + '\nROLLBACK;')));
console.log(JSON.stringify({ output, schema, readGroups: 6, publicTablesChanged: false, paidCalls: 0, execution: 'NOT_EXECUTED' }));
