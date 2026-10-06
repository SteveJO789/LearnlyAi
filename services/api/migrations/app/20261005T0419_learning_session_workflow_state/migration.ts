#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/452158074d4d75d38f0c775bdb714abcc49090d7a429bc916b9a1a02c08bbcd1/contract';
import endContract from '../../snapshots/452158074d4d75d38f0c775bdb714abcc49090d7a429bc916b9a1a02c08bbcd1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d7a4d82ff050dcfdb7a55a6f4fc74436db9681957211d47bce23d8afcd84ce0b/contract';
import startContract from '../../snapshots/d7a4d82ff050dcfdb7a55a6f4fc74436db9681957211d47bce23d8afcd84ce0b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'LearningSession',
        constraint: 'LearningSession_state_check_f6e8ff79',
      }),
      this.addColumn({
        schema: 'public',
        table: 'LearningSession',
        column: col('lifecycleState', 'text', {
          notNull: true,
          default: lit('ACTIVE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.setDefault({
        schema: 'public',
        table: 'LearningSession',
        column: 'state',
        defaultSql: "DEFAULT 'INPUT'",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'LearningSession',
        constraint: 'LearningSession_lifecycleState_check_1f2ffd0e',
        expression: "\"lifecycleState\" IN ('ACTIVE', 'COMPLETED', 'FAILED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'LearningSession',
        constraint: 'LearningSession_state_check_d925cf7a',
        expression:
          "\"state\" IN ('INPUT', 'CONTENT_ANALYSIS', 'PRE_TEST', 'LEARNING', 'TRANSFER', 'POST_TEST', 'COMPLETED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
