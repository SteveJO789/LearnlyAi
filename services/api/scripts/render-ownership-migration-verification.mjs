// Render an isolated, rollback-only test of the new migration against empty clones.
// Does not execute SQL, alter public tables or read learner rows.
import { readFileSync } from 'node:fs';
import contract from '../src/prisma/contract.json' with { type: 'json' };
import operations from '../migrations/app/20261009T1032_session_ownership_contract/ops.json' with { type: 'json' };

const schema = 'learnly_mvp_ownership_verify';
const q = name => '"' + name.replaceAll('"', '""') + '"';
const rewrite = sql => sql.replaceAll('"public".', q(schema) + '.').replaceAll('public.', q(schema) + '.');
const tables = ['User', 'LearningSession', 'Message'];
const statements = ['BEGIN;', "SET LOCAL statement_timeout = '10s';", `CREATE SCHEMA ${q(schema)};`,
  `SET LOCAL search_path = ${q(schema)}, public;`, `GRANT USAGE ON SCHEMA ${q(schema)} TO authenticated;`];
for (const table of tables) statements.push(
  `CREATE TABLE ${q(schema)}.${q(table)} (LIKE public.${q(table)} INCLUDING ALL);`,
  `ALTER TABLE ${q(schema)}.${q(table)} ENABLE ROW LEVEL SECURITY;`,
  `GRANT SELECT ON ${q(schema)}.${q(table)} TO authenticated;`,
);
statements.push(`ALTER TABLE ${q(schema)}."LearningSession" ADD FOREIGN KEY ("userId") REFERENCES ${q(schema)}."User"("id");`,
  `ALTER TABLE ${q(schema)}."Message" ADD FOREIGN KEY ("learningSessionId") REFERENCES ${q(schema)}."LearningSession"("id");`);
const newNames = new Set(operations.filter(op => op.target?.details?.objectType === 'rlsPolicy').map(op => op.target.details.name));
for (const policy of Object.values(contract.storage.namespaces.public.entries.policy)) {
  if (!tables.includes(policy.tableName) || newNames.has(policy.name)) continue;
  statements.push(`CREATE POLICY ${q(policy.name)} ON ${q(schema)}.${q(policy.tableName)} AS PERMISSIVE FOR ${policy.operation.toUpperCase()} TO ${policy.roles.map(q).join(', ')}${policy.using ? ` USING (${policy.using})` : ''}${policy.withCheck ? ` WITH CHECK (${policy.withCheck})` : ''};`);
}
for (const operation of operations) {
  if (!['additive', 'widening'].includes(operation.operationClass)) throw new Error('Unexpected destructive migration');
  for (const step of operation.execute) {
    if (step.params?.length) throw new Error('Unexpected parameterized migration step');
    statements.push(rewrite(step.sql) + ';');
  }
}
const fixture = readFileSync(new URL('verify-session-rls.sql', import.meta.url), 'utf8');
const body = fixture.slice(fixture.indexOf('INSERT INTO'), fixture.indexOf('ROLLBACK;'));
if (!body || body.includes('COMMIT')) throw new Error('Unsafe verification fixture');
statements.push(rewrite(body), 'ROLLBACK;',
  `SELECT 'new canonical ownership migration checks passed; isolated schema rolled back' AS verification, to_regnamespace('${schema}') IS NULL AS schema_removed;`);
console.log(statements.join('\n'));
