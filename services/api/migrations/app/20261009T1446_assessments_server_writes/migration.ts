#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189/contract';
import endContract from '../../snapshots/83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef/contract';
import startContract from '../../snapshots/909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'grant.assessment-profile-owned-writes',
        label: 'Grant assessment/profile operations protected by API-context ownership RLS',
        operationClass: 'widening', target: { id: 'postgres' }, precheck: [],
        execute: [
          { sql: 'GRANT SELECT, INSERT, UPDATE ON TABLE public."Assessment" TO authenticated', params: [] },
          { sql: 'GRANT SELECT, INSERT ON TABLE public."AssessmentAnswer" TO authenticated', params: [] },
          { sql: 'GRANT SELECT, INSERT, UPDATE ON TABLE public."LearningProfile" TO authenticated', params: [] },
        ],
        postcheck: [{ sql: `SELECT has_table_privilege('authenticated', 'public."Assessment"', 'INSERT')
          AND has_table_privilege('authenticated', 'public."Assessment"', 'UPDATE')
          AND has_table_privilege('authenticated', 'public."AssessmentAnswer"', 'INSERT')
          AND has_table_privilege('authenticated', 'public."LearningProfile"', 'UPDATE') AS result`, params: [] }],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Assessment',
        column: col('snapshot', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Assessment',
        column: col('submissionHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'Assessment',
        column: col('topic', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'AssessmentAnswer',
        constraint: 'AssessmentAnswer_assessmentId_questionId_key',
        columns: ['assessmentId', 'questionId'],
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Assessment',
        policy: {
          naming: { kind: 'wire', prefix: 'assessment_insert_api_own', hash: '277fff40' },
          tableName: 'Assessment',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "Assessment"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Assessment',
        policy: {
          naming: { kind: 'wire', prefix: 'assessment_update_api_own', hash: '168c1514' },
          tableName: 'Assessment',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using:
            '(EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "Assessment"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "Assessment"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'AssessmentAnswer',
        policy: {
          naming: { kind: 'wire', prefix: 'assessment_answer_insert_api_own', hash: '6ac7083b' },
          tableName: 'AssessmentAnswer',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "Assessment" a JOIN "LearningSession" s ON s.id = a."learningSessionId" JOIN "User" u ON u.id = s."userId" WHERE a.id = "AssessmentAnswer"."assessmentId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningProfile',
        policy: {
          naming: { kind: 'wire', prefix: 'learning_profile_insert_api_own', hash: '62b5c283' },
          tableName: 'LearningProfile',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LearningProfile"."userId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningProfile',
        policy: {
          naming: { kind: 'wire', prefix: 'learning_profile_update_api_own', hash: '40a07354' },
          tableName: 'LearningProfile',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using:
            '(EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LearningProfile"."userId" AND u."authUserId" = (SELECT auth.uid())::text))',
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "User" u WHERE u.id = "LearningProfile"."userId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningSession',
        policy: {
          naming: { kind: 'wire', prefix: 'session_api_insert_guard', hash: '649e1632' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningSession',
        policy: {
          naming: { kind: 'wire', prefix: 'session_api_update_guard', hash: 'cca2e683' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using: 'true',
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Message',
        policy: {
          naming: { kind: 'wire', prefix: 'message_api_insert_guard', hash: '649e1632' },
          tableName: 'Message',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
