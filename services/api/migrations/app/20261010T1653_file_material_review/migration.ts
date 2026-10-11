#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620/contract';
import endContract from '../../snapshots/0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8/contract';
import startContract from '../../snapshots/076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'security.grant-material-review-metadata', label: 'Allow only RLS-protected learner metadata review',
        operationClass: 'additive', target: { id: 'postgres' },
        execute: [{ sql: 'GRANT UPDATE (metadata) ON TABLE public."SourceMaterial" TO authenticated', params: [] }],
        postcheck: [{ sql: `SELECT has_column_privilege('authenticated', 'public."SourceMaterial"', 'metadata', 'UPDATE') AS result`, params: [] }],
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'SourceMaterial',
        policy: {
          naming: {
            kind: 'wire',
            prefix: 'source_material_review_update_guard',
            hash: 'cd84f83e',
          },
          tableName: 'SourceMaterial',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using: "(current_setting('learnly.api_write', true) = '1')",
          withCheck: "(current_setting('learnly.api_write', true) = '1')",
          permissive: false,
        },
      }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'SourceMaterial',
        policy: {
          naming: { kind: 'wire', prefix: 'source_material_review_update_own', hash: 'c072fcc3' },
          tableName: 'SourceMaterial',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using:
            '("status" = \'READY\' AND "type" IN (\'PDF\', \'IMAGE\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "SourceMaterial"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text AND s."lifecycleState" = \'ACTIVE\' AND s."stage" = \'EXPLAIN\' AND s."version" = 0 AND s."state" IN (\'INPUT\', \'PRE_TEST\')))',
          withCheck:
            '("status" = \'READY\' AND "type" IN (\'PDF\', \'IMAGE\') AND EXISTS (SELECT 1 FROM "LearningSession" s JOIN "User" u ON u.id = s."userId" WHERE s.id = "SourceMaterial"."learningSessionId" AND u."authUserId" = (SELECT auth.uid())::text AND s."lifecycleState" = \'ACTIVE\' AND s."stage" = \'EXPLAIN\' AND s."version" = 0 AND s."state" IN (\'INPUT\', \'PRE_TEST\')))',
          permissive: true,
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
