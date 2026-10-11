#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8/contract';
import endContract from '../../snapshots/076ce8306edb1f37c9956a00b70b92978b153db404524f05d4d39a9e13b04ce8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a/contract';
import startContract from '../../snapshots/26370da7801afacb9339a0042e2e9a52e649a78266738c309f99ea103867fa0a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';
import { JOURNAL_CHECK, JOURNAL_POLICY } from './journal-policy.ts';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'FileUpload',
        constraint: 'FileUpload_state_check_2cdd5b3d',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'FileUpload',
        constraint: 'FileUpload_state_check_d8fae83c',
        expression: "\"state\" IN ('PENDING', 'FINALIZED', 'CANCELLED')",
      }),
      rawSql({
        id: 'storage.pending-upload-intent-guard', label: 'Require exact owned pending journal before private Storage insertion',
        operationClass: 'additive', target: { id: 'postgres' },
        precheck: [{ sql: 'SELECT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 AND policyname = $3) AS result',
          params: ['storage', 'objects', JOURNAL_POLICY] }],
        execute: [{ sql: `CREATE POLICY "${JOURNAL_POLICY}" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (${JOURNAL_CHECK})`, params: [] }],
        postcheck: [{ sql: `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 AND policyname = $3 AND cmd = 'INSERT' AND permissive = 'RESTRICTIVE') AS result`,
          params: ['storage', 'objects', JOURNAL_POLICY] }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
