#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189/contract';
import startContract from '../../snapshots/83b04ea696bd26dd1a9e5a109b700a70987bd081d0011d1299ab84dabb5b9189/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract';
import endContract from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({ id: 'grant.material-owned-api-write', label: 'Grant material access subject to ownership/API-context RLS',
        operationClass: 'widening', target: { id: 'postgres' }, precheck: [],
        execute: [{ sql: 'GRANT SELECT, INSERT ON TABLE public."SourceMaterial" TO authenticated', params: [] }],
        postcheck: [{ sql: `SELECT has_table_privilege('authenticated', 'public."SourceMaterial"', 'INSERT') AS result`, params: [] }],
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
