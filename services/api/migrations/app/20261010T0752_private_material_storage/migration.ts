#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8/contract';
import endContract from '../../snapshots/8626880030fb102dc56e134c700a5361c4189fc778f9fa79a0f825dd9c677bc8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract';
import startContract from '../../snapshots/d17a8bc493eb8d240a7a2d0c664b00ec49f5823963634f78f5385a01bd26b397/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';
import { MATERIAL_BUCKET, MATERIAL_BUCKET_MAX_BYTES, MATERIAL_BUCKET_MIMES, MATERIAL_STORAGE_POLICIES } from './storage-policy.ts';

const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const bucketMatches = `b.id = ${quote(MATERIAL_BUCKET)} AND b.public IS FALSE AND b.file_size_limit = ${MATERIAL_BUCKET_MAX_BYTES}
  AND ARRAY(SELECT unnest(b.allowed_mime_types) ORDER BY 1) = ARRAY[${[...MATERIAL_BUCKET_MIMES].sort().map(quote).join(',')}]::text[]`;

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'SourceMaterial',
        column: col('storageBucket', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      rawSql({
        id: 'storage.private-material-bucket', label: 'Create the private learner material bucket with MIME/size limits',
        operationClass: 'additive', target: { id: 'postgres' },
        precheck: [{ sql: `SELECT NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = ${quote(MATERIAL_BUCKET)}) OR EXISTS (SELECT 1 FROM storage.buckets b WHERE ${bucketMatches}) AS result`, params: [] }],
        execute: [{ sql: `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
          (${quote(MATERIAL_BUCKET)}, ${quote(MATERIAL_BUCKET)}, false, ${MATERIAL_BUCKET_MAX_BYTES}, ARRAY[${MATERIAL_BUCKET_MIMES.map(quote).join(',')}]) ON CONFLICT (id) DO NOTHING`, params: [] }],
        postcheck: [{ sql: `SELECT EXISTS (SELECT 1 FROM storage.buckets b WHERE ${bucketMatches}) AS result`, params: [] }],
      }),
      ...MATERIAL_STORAGE_POLICIES.map(policy => rawSql({
        id: 'storage.policy.' + policy.name, label: 'Protect private learner files: ' + policy.name,
        operationClass: 'additive', target: { id: 'postgres' },
        precheck: [{ sql: 'SELECT NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 AND policyname = $3) AS result', params: ['storage', 'objects', policy.name] }],
        execute: [{ sql: `CREATE POLICY "${policy.name}" ON storage.objects AS ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'}
          FOR ${policy.operation.toUpperCase()} TO ${policy.roles.join(', ')}${'using' in policy ? ` USING (${'using' in policy ? policy.using : ''})` : ''}${'withCheck' in policy ? ` WITH CHECK (${policy.withCheck})` : ''}`, params: [] }],
        postcheck: [{ sql: 'SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = $1 AND tablename = $2 AND policyname = $3 AND cmd = $4 AND permissive = $5) AS result',
          params: ['storage', 'objects', policy.name, policy.operation.toUpperCase(), policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'] }],
      })),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
