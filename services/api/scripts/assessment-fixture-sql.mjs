import contract from '../src/prisma/contract.json' with { type: 'json' };
import ownership from '../migrations/app/20261009T1032_session_ownership_contract/ops.json' with { type: 'json' };
import assessment from '../migrations/app/20261009T1446_assessments_server_writes/ops.json' with { type: 'json' };

export function assessmentFixtureSql(schema, actors, persistent = false) {
  if (!/^learnly_verify_[0-9a-f]{12}$/.test(schema)) throw new Error('Unsafe fixture schema');
  if (actors.some(actor => !/^[0-9a-f-]{36}$/.test(actor))) throw new Error('Unsafe synthetic actor id');
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const rewrite = sql => sql.replaceAll('"public".', quote(schema) + '.').replaceAll('public.', quote(schema) + '.');
  const tables = ['User', 'LearningSession', 'Message', 'Assessment', 'AssessmentAnswer', 'LearningProfile'];
  const out = ['BEGIN;', "SET LOCAL statement_timeout = '10s';", `CREATE SCHEMA ${quote(schema)};`,
    `COMMENT ON SCHEMA ${quote(schema)} IS 'LearnlyAI isolated verification fixture; no live learner data';`,
    `GRANT USAGE ON SCHEMA ${quote(schema)} TO authenticated;`, `SET LOCAL search_path = ${quote(schema)}, public;`];
  for (const table of tables) out.push(`CREATE TABLE ${quote(schema)}.${quote(table)} (LIKE public.${quote(table)} INCLUDING ALL);`,
    `ALTER TABLE ${quote(schema)}.${quote(table)} ENABLE ROW LEVEL SECURITY;`, `GRANT SELECT ON ${quote(schema)}.${quote(table)} TO authenticated;`);
  for (const [table, column, parent, parentColumn] of [
    ['LearningSession', 'userId', 'User', 'id'], ['Message', 'learningSessionId', 'LearningSession', 'id'],
    ['Assessment', 'learningSessionId', 'LearningSession', 'id'], ['AssessmentAnswer', 'assessmentId', 'Assessment', 'id'],
    ['LearningProfile', 'userId', 'User', 'id'],
  ]) out.push(`ALTER TABLE ${quote(schema)}.${quote(table)} ADD FOREIGN KEY (${quote(column)}) REFERENCES ${quote(schema)}.${quote(parent)}(${quote(parentColumn)});`);
  const operations = [...ownership, ...assessment];
  const plannedPolicies = new Set(operations.filter(op => op.target?.details?.objectType === 'rlsPolicy').map(op => op.target.details.name));
  for (const policy of Object.values(contract.storage.namespaces.public.entries.policy)) {
    if (!tables.includes(policy.tableName) || plannedPolicies.has(policy.name)) continue;
    out.push(`CREATE POLICY ${quote(policy.name)} ON ${quote(schema)}.${quote(policy.tableName)} AS ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} FOR ${policy.operation.toUpperCase()} TO ${policy.roles.map(quote).join(', ')}${policy.using ? ` USING (${policy.using})` : ''}${policy.withCheck ? ` WITH CHECK (${policy.withCheck})` : ''};`);
  }
  for (const op of operations) {
    if (!['additive', 'widening'].includes(op.operationClass)) throw new Error('Unsafe fixture migration operation');
    for (const step of op.execute) {
      if (step.params?.length) throw new Error('Parameterized fixture DDL not supported');
      out.push(rewrite(step.sql) + ';');
    }
  }
  actors.forEach((actor, index) => {
    out.push(`INSERT INTO ${quote(schema)}."User" ("id", "authUserId", "displayName", "updatedAt") VALUES ('${actor}', '${actor}', 'Synthetic assessment learner', now());`);
    // Two sessions per learner make simultaneous mastery updates observable.
    for (let n = 0; n < 2; n++) out.push(`INSERT INTO ${quote(schema)}."LearningSession"
      ("id", "userId", "title", "state", "lifecycleState", "stage", "progressPercent", "version", "createdAt", "updatedAt")
      VALUES ('fixture-${index}-${n}', '${actor}', 'Synthetic assessment fixture', 'INPUT', 'ACTIVE', 'EXPLAIN', 0, 0, now(), now());`);
  });
  if (persistent) out.push('COMMIT;', `SELECT '${schema}' AS fixture_schema;`);
  else out.push(rollbackChecks(schema, actors), 'ROLLBACK;', `SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed, 'RLS/API-context checks passed in rollback-only transaction' AS verification;`);
  return out.join('\n');
}

function rollbackChecks(schema, actors) {
  return `SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"${actors[0]}","role":"authenticated","user_metadata":{"learnly.api_write":"1"}}', true);
SELECT set_config('learnly.api_write', '', true);
DO $verify$
BEGIN
  BEGIN
    UPDATE "${schema}"."LearningSession" SET "progressPercent"=100 WHERE id='fixture-0-0';
    RAISE EXCEPTION 'unmarked own progress update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO "${schema}"."Message" (id,"learningSessionId",role,content,"createdAt")
      VALUES ('untrusted-tutor','fixture-0-0','TUTOR','{}',now());
    RAISE EXCEPTION 'unmarked fabricated tutor insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO "${schema}"."Assessment" (id,"learningSessionId",phase,"maxScore") VALUES ('untrusted-grade','fixture-0-0','PRE',3);
    RAISE EXCEPTION 'unmarked assessment insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
SELECT set_config('learnly.api_write', '1', true);
INSERT INTO "${schema}"."Assessment" (id,"learningSessionId",phase,topic,"snapshot","maxScore")
  VALUES ('marked-grade','fixture-0-0','PRE','ohms-law','{}',3);
UPDATE "${schema}"."Assessment" SET score=2,"submittedAt"=now() WHERE id='marked-grade';
INSERT INTO "${schema}"."AssessmentAnswer" (id,"assessmentId","questionId",response,"isCorrect","awardedScore")
  VALUES ('marked-answer','marked-grade','fixture-question','2',true,1);
INSERT INTO "${schema}"."LearningProfile" ("userId",mastery,strengths,"weakPoints","updatedAt")
  VALUES ('${actors[0]}','{}','[]','[]',now());
SELECT set_config('learnly.api_write', '', true);
DO $verify$
BEGIN
  BEGIN
    UPDATE "${schema}"."Assessment" SET score=99 WHERE id='marked-grade';
    RAISE EXCEPTION 'unmarked own score update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE "${schema}"."LearningProfile" SET mastery='{"fake":100}' WHERE "userId"='${actors[0]}';
    RAISE EXCEPTION 'unmarked own mastery update allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
SELECT set_config('request.jwt.claims', '{"sub":"${actors[1]}","role":"authenticated"}', true);
SELECT set_config('learnly.api_write', '1', true);
DO $verify$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "${schema}"."Assessment" WHERE id='marked-grade';
  IF n <> 0 THEN RAISE EXCEPTION 'cross-user assessment read allowed'; END IF;
  UPDATE "${schema}"."Assessment" SET score=99 WHERE id='marked-grade';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'cross-user score update allowed'; END IF;
  BEGIN
    INSERT INTO "${schema}"."AssessmentAnswer" (id,"assessmentId","questionId",response) VALUES ('foreign-answer','marked-grade','foreign','1');
    RAISE EXCEPTION 'cross-user answer insert allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $verify$;
RESET ROLE;`;
}

export function fixtureCleanupSql(schema) {
  if (!/^learnly_verify_[0-9a-f]{12}$/.test(schema)) throw new Error('Unsafe cleanup schema');
  return `DROP SCHEMA "${schema}" CASCADE; SELECT to_regnamespace('${schema}') IS NULL AS fixture_removed;`;
}

if (process.argv[2]) {
  const persistent = process.argv.includes('--persistent');
  const [schema, ...actors] = process.argv.slice(2).filter(arg => arg !== '--persistent');
  console.log(schema === '--cleanup' ? fixtureCleanupSql(actors[0]) : assessmentFixtureSql(schema, actors, persistent));
}
