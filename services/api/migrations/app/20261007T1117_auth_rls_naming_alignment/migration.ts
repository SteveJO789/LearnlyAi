#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665/contract';
import endContract from '../../snapshots/c7b3938544e5e74ca8b9f22476cc7dbb3d987938d552a6e2214b5edd941b8665/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e7b9c11c1ebe4d2562b5807fcf902c4582d33fe6b43370d7d6ba3da232f165b7/contract';
import startContract from '../../snapshots/e7b9c11c1ebe4d2562b5807fcf902c4582d33fe6b43370d7d6ba3da232f165b7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.renameRlsPolicy({ schema: 'public', table: 'AIRequest', from: 'ai_request_select_own', to: 'ai_request_select_own_5424dd11' }),
      this.renameRlsPolicy({ schema: 'public', table: 'Assessment', from: 'assessment_select_own', to: 'assessment_select_own_d47c911a' }),
      this.renameRlsPolicy({ schema: 'public', table: 'AssessmentAnswer', from: 'assessment_answer_select_own', to: 'assessment_answer_select_own_c190452e' }),
      this.renameRlsPolicy({ schema: 'public', table: 'LearningProfile', from: 'learning_profile_select_own', to: 'learning_profile_select_own_13d05569' }),
      this.renameRlsPolicy({ schema: 'public', table: 'LearningSession', from: 'learning_session_select_own', to: 'learning_session_select_own_a34ec569' }),
      this.renameRlsPolicy({ schema: 'public', table: 'Message', from: 'message_select_own', to: 'message_select_own_968c3fb0' }),
      this.renameRlsPolicy({ schema: 'public', table: 'SourceMaterial', from: 'source_material_select_own', to: 'source_material_select_own_f7e3ac0e' }),
      this.renameRlsPolicy({ schema: 'public', table: 'User', from: 'user_insert_own', to: 'user_insert_own_770e92f4' }),
      this.renameRlsPolicy({ schema: 'public', table: 'User', from: 'user_select_own', to: 'user_select_own_4f3aea31' }),
      this.renameRlsPolicy({ schema: 'public', table: 'User', from: 'user_update_own', to: 'user_update_own_0788dd28' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);