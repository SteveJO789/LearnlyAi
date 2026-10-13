#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a/contract';
import endContract from '../../snapshots/26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8/contract';
import startContract from '../../snapshots/8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'FileUpload',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('learningSessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('material', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'FileUpload_state_check_2cdd5b3d',
            "\"state\" IN ('PENDING', 'CANCELLED')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FileUpload',
        index: 'FileUpload_learningSessionId_createdAt_idx_bdaff9b7',
        columns: ['learningSessionId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'FileUpload',
        index: 'FileUpload_learningSessionId_idx_3c4d5acd',
        columns: ['learningSessionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'FileUpload',
        foreignKey: {
          name: 'FileUpload_learningSessionId_fkey',
          columns: ['learningSessionId'],
          references: { schema: 'public', table: 'LearningSession', columns: ['id'] },
        },
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'FileUpload' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'FileUpload',
        policy: {
          naming: { kind: 'wire', prefix: 'file_upload_insert_api_own', hash: 'd6a3a6ba' },
          tableName: 'FileUpload',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck:
            '((current_setting(\'learnly.api_write\', true) = \'1\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "FileUpload"."learningSessionId" AND s."lifecycleState" = \'ACTIVE\' AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      rawSql({
        id: 'security.grant-file-upload-api-access', label: 'Grant RLS-protected upload receipt access',
        operationClass: 'additive', target: { id: 'postgres' },
        execute: [{ sql: 'GRANT SELECT, INSERT, UPDATE ON TABLE public."FileUpload" TO authenticated', params: [] }],
        postcheck: [{ sql: `SELECT has_table_privilege('authenticated', 'public."FileUpload"', 'SELECT')
          AND has_table_privilege('authenticated', 'public."FileUpload"', 'INSERT')
          AND has_table_privilege('authenticated', 'public."FileUpload"', 'UPDATE') AS result`, params: [] }],
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'FileUpload',
        policy: {
          naming: { kind: 'wire', prefix: 'file_upload_insert_guard', hash: '649e1632' },
          tableName: 'FileUpload',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'FileUpload',
        policy: {
          naming: { kind: 'wire', prefix: 'file_upload_select_own', hash: '5472d21c' },
          tableName: 'FileUpload',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using:
            '(EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "FileUpload"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'FileUpload',
        policy: {
          naming: { kind: 'wire', prefix: 'file_upload_update_api_own', hash: 'e13f9bb0' },
          tableName: 'FileUpload',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using:
            '(EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "FileUpload"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          withCheck:
            '(EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "FileUpload"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text))',
          permissive: true,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'FileUpload',
        policy: {
          naming: { kind: 'wire', prefix: 'file_upload_update_guard', hash: 'cd84f83e' },
          tableName: 'FileUpload',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using: "(current_setting('learnly.api_write', true) = '1')",
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
