#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620/contract';
import startContract from '../../snapshots/0039047422dff2448bd0223d8c5b74d4ef5beca41b455f665d5168bf03759620/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab/contract';
import endContract from '../../snapshots/5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      // Supabase installs pgvector in extensions; never move the shared extension.
      rawSql({
        id: 'knowledge.require-extensions-vector', label: 'Require Supabase pgvector type in extensions',
        operationClass: 'additive', target: { id: 'postgres' },
        execute: [{ sql: "DO $$ BEGIN IF to_regtype('extensions.vector') IS NULL THEN RAISE EXCEPTION 'Enable pgvector in extensions before the Knowledge migration'; END IF; END $$", params: [] }],
        postcheck: [{ sql: "SELECT to_regtype('extensions.vector') IS NOT NULL AS result", params: [] }],
      }),
      this.createTable({
        schema: 'public',
        table: 'KnowledgeChunk',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contentHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dimensions', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('documentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('documentVersion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('embedding', 'extensions.vector(1536)', {
            notNull: true,
            codecRef: { codecId: 'pg/vector@1', typeParams: { length: 1536 } },
          }),
          col('embeddingInputHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('embeddingModel', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('language', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ordinal', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('page', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('passageHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('passageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provenanceHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reviewed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('sources', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'knowledge_chunk_hashes_baf6cdf2',
            '"passageHash" ~ \'^[0-9a-f]{64}$\' AND "contentHash" ~ \'^[0-9a-f]{64}$\' AND "embeddingInputHash" ~ \'^[0-9a-f]{64}$\' AND "provenanceHash" ~ \'^[0-9a-f]{64}$\'',
          ),
          checkExpression(
            'knowledge_chunk_shape_ac4a864f',
            'dimensions = 1536 AND ordinal >= 0 AND (page IS NULL OR page > 0)',
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KnowledgeChunk',
        index: 'KnowledgeChunk_documentId_idx_825ef746',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'KnowledgeChunk',
        index: 'KnowledgeChunk_embeddingModel_subject_language_idx_1c48278e',
        columns: ['embeddingModel', 'subject', 'language'],
      }),
      this.enableRowLevelSecurity({ schema: 'public', table: 'KnowledgeChunk' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'KnowledgeChunk',
        policy: {
          naming: { kind: 'wire', prefix: 'knowledge_chunk_read_reviewed', hash: '72bac3b2' },
          tableName: 'KnowledgeChunk',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: 'reviewed = true',
          permissive: true,
        },
      }),
      rawSql({
        id: 'knowledge.read-only-grants', label: 'Allow authenticated reviewed reads only',
        operationClass: 'additive', target: { id: 'postgres' },
        execute: [
          { sql: 'REVOKE ALL ON TABLE public."KnowledgeChunk" FROM PUBLIC, anon, authenticated', params: [] },
          { sql: 'GRANT SELECT ON TABLE public."KnowledgeChunk" TO authenticated', params: [] },
        ],
        postcheck: [{ sql: `SELECT has_table_privilege('authenticated', 'public."KnowledgeChunk"', 'SELECT')
          AND NOT has_table_privilege('authenticated', 'public."KnowledgeChunk"', 'INSERT')
          AND NOT has_table_privilege('authenticated', 'public."KnowledgeChunk"', 'UPDATE')
          AND NOT has_table_privilege('authenticated', 'public."KnowledgeChunk"', 'DELETE')
          AND NOT has_table_privilege('anon', 'public."KnowledgeChunk"', 'SELECT') AS result`, params: [] }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
