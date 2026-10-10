#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract';
import endContract from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

// Explicit app grants: do not depend on dashboard-specific public default privileges.
// Ownership and API-write RLS remain active; no DELETE, anonymous or role-membership grant.
const APP_GRANTS = [
  ['User', ['SELECT', 'INSERT', 'UPDATE']],
  ['LearningSession', ['SELECT', 'INSERT', 'UPDATE']],
  ['Message', ['SELECT', 'INSERT']],
  ['SourceMaterial', ['SELECT', 'INSERT']],
  ['Assessment', ['SELECT', 'INSERT', 'UPDATE']],
  ['AssessmentAnswer', ['SELECT', 'INSERT']],
  ['LearningProfile', ['SELECT', 'INSERT', 'UPDATE']],
  ['AIRequest', ['SELECT']],
] as const;

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AIRequest',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('errorCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inputTokens', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('latencyMs', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('learningSessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('operation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('outputSnapshot', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('outputTokens', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('promptSnapshot', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AIRequest_status_check_f32a67f1',
            "\"status\" IN ('PENDING', 'SUCCESS', 'FAILED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Assessment',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('learningSessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('maxScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('phase', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('score', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('snapshot', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('submissionHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('topic', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Assessment_phase_check_0c021859',
            "\"phase\" IN ('PRE', 'POST', 'TRANSFER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'AssessmentAnswer',
        columns: [
          col('assessmentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('awardedScore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isCorrect', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('questionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('response', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'LearningProfile',
        columns: [
          col('mastery', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('strengths', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('weakPoints', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
        ],
        constraints: [primaryKey(['userId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'LearningSession',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('learningGoal', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lifecycleState', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('progressPercent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stage', 'text', {
            notNull: true,
            default: lit('EXPLAIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('state', 'text', {
            notNull: true,
            default: lit('INPUT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subject', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'LearningSession_lifecycleState_check_1f2ffd0e',
            "\"lifecycleState\" IN ('ACTIVE', 'COMPLETED', 'FAILED')",
          ),
          checkExpression(
            'LearningSession_stage_check_df720be3',
            "\"stage\" IN ('DIAGNOSE', 'EXPLAIN', 'PRACTICE', 'ASSESS', 'REVIEW')",
          ),
          checkExpression(
            'LearningSession_state_check_d925cf7a',
            "\"state\" IN ('INPUT', 'CONTENT_ANALYSIS', 'PRE_TEST', 'LEARNING', 'TRANSFER', 'POST_TEST', 'COMPLETED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Message',
        columns: [
          col('content', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('learningSessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Message_role_check_25286c5d', "\"role\" IN ('USER', 'TUTOR', 'SYSTEM')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'SourceMaterial',
        columns: [
          col('contentHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('learningSessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('mimeType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('normalizedText', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sizeBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('storageKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'SourceMaterial_status_check_c104a595',
            "\"status\" IN ('UPLOADED', 'PROCESSING', 'READY', 'FAILED')",
          ),
          checkExpression(
            'SourceMaterial_type_check_74d9d9d9',
            "\"type\" IN ('TEXT', 'PDF', 'IMAGE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('authUserId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AIRequest',
        constraint: 'AIRequest_requestId_key',
        columns: ['requestId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Assessment',
        constraint: 'Assessment_learningSessionId_phase_key',
        columns: ['learningSessionId', 'phase'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AssessmentAnswer',
        constraint: 'AssessmentAnswer_assessmentId_questionId_key',
        columns: ['assessmentId', 'questionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_authUserId_key',
        columns: ['authUserId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_username_key',
        columns: ['username'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AIRequest',
        index: 'AIRequest_learningSessionId_createdAt_idx_bdaff9b7',
        columns: ['learningSessionId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AIRequest',
        index: 'AIRequest_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Assessment',
        index: 'Assessment_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AssessmentAnswer',
        index: 'AssessmentAnswer_assessmentId_idx_1fe05216',
        columns: ['assessmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LearningSession',
        index: 'LearningSession_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'LearningSession',
        index: 'LearningSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Message',
        index: 'Message_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SourceMaterial',
        index: 'SourceMaterial_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'User',
        index: 'User_email_idx_46df9cad',
        columns: ['email'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AIRequest',
        foreignKey: {
          name: 'AIRequest_learningSessionId_fkey',
          columns: ['learningSessionId'],
          references: { schema: 'public', table: 'LearningSession', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Assessment',
        foreignKey: {
          name: 'Assessment_learningSessionId_fkey',
          columns: ['learningSessionId'],
          references: { schema: 'public', table: 'LearningSession', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AssessmentAnswer',
        foreignKey: {
          name: 'AssessmentAnswer_assessmentId_fkey',
          columns: ['assessmentId'],
          references: { schema: 'public', table: 'Assessment', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LearningProfile',
        foreignKey: {
          name: 'LearningProfile_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'LearningSession',
        foreignKey: {
          name: 'LearningSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Message',
        foreignKey: {
          name: 'Message_learningSessionId_fkey',
          columns: ['learningSessionId'],
          references: { schema: 'public', table: 'LearningSession', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SourceMaterial',
        foreignKey: {
          name: 'SourceMaterial_learningSessionId_fkey',
          columns: ['learningSessionId'],
          references: { schema: 'public', table: 'LearningSession', columns: ['id'] },
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'AIRequest' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Assessment' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'AssessmentAnswer' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'LearningProfile' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'LearningSession' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'Message' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'SourceMaterial' }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'User' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'AIRequest',
        policy: {
          naming: { kind: 'wire', prefix: 'ai_request_select_own', hash: '5424dd11' },
          tableName: 'AIRequest',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "AIRequest"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
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
          naming: { kind: 'wire', prefix: 'assessment_select_own', hash: 'd47c911a' },
          tableName: 'Assessment',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "Assessment"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
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
        table: 'AssessmentAnswer',
        policy: {
          naming: { kind: 'wire', prefix: 'assessment_answer_select_own', hash: 'c190452e' },
          tableName: 'AssessmentAnswer',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM (("Assessment" a JOIN "LearningSession" ls ON ((ls.id = a."learningSessionId"))) JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((a.id = "AssessmentAnswer"."assessmentId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
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
          naming: { kind: 'wire', prefix: 'learning_profile_select_own', hash: '13d05569' },
          tableName: 'LearningProfile',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningProfile"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
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
          naming: { kind: 'wire', prefix: 'learning_session_insert_own', hash: '2be3816c' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningSession"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningSession',
        policy: {
          naming: { kind: 'wire', prefix: 'learning_session_select_own', hash: 'a34ec569' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningSession"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningSession',
        policy: {
          naming: { kind: 'wire', prefix: 'learning_session_update_own', hash: '056e8007' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningSession"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          withCheck:
            '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningSession"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
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
      this.createRlsPolicy({
        schema: 'public',
        table: 'Message',
        policy: {
          naming: { kind: 'wire', prefix: 'message_insert_own', hash: '4f346578' },
          tableName: 'Message',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "Message"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Message',
        policy: {
          naming: { kind: 'wire', prefix: 'message_select_own', hash: '968c3fb0' },
          tableName: 'Message',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "Message"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'SourceMaterial',
        policy: {
          naming: { kind: 'wire', prefix: 'source_material_insert_api_own', hash: 'bbb50d09' },
          tableName: 'SourceMaterial',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "SourceMaterial"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'SourceMaterial',
        policy: {
          naming: { kind: 'wire', prefix: 'source_material_select_own', hash: 'f7e3ac0e' },
          tableName: 'SourceMaterial',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "SourceMaterial"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'wire', prefix: 'user_insert_own', hash: '770e92f4' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'wire', prefix: 'user_select_own', hash: '4f3aea31' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'wire', prefix: 'user_update_own', hash: '0788dd28' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          withCheck: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),
      ...APP_GRANTS.map(([table, privileges]) => rawSql({
        id: `security.fresh-app-grants.${table}`,
        label: `Grant authenticated application access to ${table}`,
        operationClass: 'additive',
        target: { id: 'postgres' },
        execute: [{ description: 'Grant only required app table privileges',
          sql: `GRANT ${privileges.join(', ')} ON TABLE "public"."${table}" TO authenticated` }],
        postcheck: [{ description: 'Verify each required privilege',
          sql: `SELECT ${privileges.map(privilege => `has_table_privilege('authenticated', '"public"."${table}"', '${privilege}')`).join(' AND ')} AS result` }],
      })),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
