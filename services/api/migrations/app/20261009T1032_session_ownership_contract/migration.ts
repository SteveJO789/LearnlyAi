#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef/contract';
import endContract from '../../snapshots/909232ef628ba8386f0750907474dc43f24d85090276eb3ea0f292b2672000ef/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665/contract';
import startContract from '../../snapshots/c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'grant.session-message-write',
        label: 'Grant authenticated session and message writes subject to RLS',
        operationClass: 'widening',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          sql: 'GRANT INSERT, UPDATE ON TABLE public."LearningSession" TO authenticated',
          params: [],
        }, {
          sql: 'GRANT INSERT ON TABLE public."Message" TO authenticated',
          params: [],
        }],
        postcheck: [{
          sql: `SELECT has_table_privilege('authenticated', 'public."LearningSession"', 'INSERT')
            AND has_table_privilege('authenticated', 'public."LearningSession"', 'UPDATE')
            AND has_table_privilege('authenticated', 'public."Message"', 'INSERT') AS result`,
          params: [],
        }],
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
