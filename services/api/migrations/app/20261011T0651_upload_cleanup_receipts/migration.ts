#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab/contract';
import startContract from '../../snapshots/5e6080d9d23dfa0183e4bbecfe0e5dfc14556f2304e686f5dccabe42280ac2ab/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b/contract';
import endContract from '../../snapshots/f099e7f519b2f869ca1c2cbbff3f96852f44830005b5af5a15022f4b813ce52b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'FileUpload',
        column: col('cleanupAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'FileUpload',
        constraint: 'file_upload_cleanup_state_89133064',
        expression: '"cleanupAt" IS NULL OR state = \'CANCELLED\'',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
