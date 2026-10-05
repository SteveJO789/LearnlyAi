#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d7a4d82ff050dcfdb7a55a6f4fc74436db9681957211d47bce23d8afcd84ce0b/contract';
import endContract from '../../snapshots/d7a4d82ff050dcfdb7a55a6f4fc74436db9681957211d47bce23d8afcd84ce0b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

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
        table: 'AppSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('tokenDigest', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
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
          col('submittedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
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
          col('progressPercent', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stage', 'text', {
            notNull: true,
            default: lit('EXPLAIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'LearningSession_stage_check_df720be3',
            "\"stage\" IN ('DIAGNOSE', 'EXPLAIN', 'PRACTICE', 'ASSESS', 'REVIEW')",
          ),
          checkExpression(
            'LearningSession_state_check_f6e8ff79',
            "\"state\" IN ('ACTIVE', 'COMPLETED', 'FAILED')",
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
        table: 'OAuthAccount',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('emailAtProvider', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastLoginAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
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
        table: 'AppSession',
        constraint: 'AppSession_tokenDigest_key',
        columns: ['tokenDigest'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Assessment',
        constraint: 'Assessment_learningSessionId_phase_key',
        columns: ['learningSessionId', 'phase'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'OAuthAccount',
        constraint: 'OAuthAccount_provider_subject_key',
        columns: ['provider', 'subject'],
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
        table: 'AppSession',
        index: 'AppSession_userId_idx_a489d58a',
        columns: ['userId'],
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
        table: 'OAuthAccount',
        index: 'OAuthAccount_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SourceMaterial',
        index: 'SourceMaterial_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
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
        table: 'AppSession',
        foreignKey: {
          name: 'AppSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
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
        table: 'OAuthAccount',
        foreignKey: {
          name: 'OAuthAccount_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
