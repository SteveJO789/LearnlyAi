import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';
import startContract from '../../snapshots/075d335ff9821e0a5aad5ebad02493ca3bbe76ef65d9e3fca3b49b2e4055abdd/contract.json' with { type: 'json' };
import endContract from '../../snapshots/e7b9c11c1ebe4d2562b5807fcf902c4582d33fe6b43370d7d6ba3da232f165b7/contract.json' with { type: 'json' };

export default class M extends Migration<typeof startContract, typeof endContract> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropRlsPolicy({ schema: 'public', table: 'AIRequest', policy: 'ai_request_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'AIRequest',
        policy: {
          naming: { kind: 'exact', name: 'ai_request_select_own' },
          tableName: 'AIRequest',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "AIRequest"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'AssessmentAnswer', policy: 'assessment_answer_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'AssessmentAnswer',
        policy: {
          naming: { kind: 'exact', name: 'assessment_answer_select_own' },
          tableName: 'AssessmentAnswer',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM (("Assessment" a JOIN "LearningSession" ls ON ((ls.id = a."learningSessionId"))) JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((a.id = "AssessmentAnswer"."assessmentId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'Assessment', policy: 'assessment_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Assessment',
        policy: {
          naming: { kind: 'exact', name: 'assessment_select_own' },
          tableName: 'Assessment',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "Assessment"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'LearningProfile', policy: 'learning_profile_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningProfile',
        policy: {
          naming: { kind: 'exact', name: 'learning_profile_select_own' },
          tableName: 'LearningProfile',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningProfile"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'LearningSession', policy: 'learning_session_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'LearningSession',
        policy: {
          naming: { kind: 'exact', name: 'learning_session_select_own' },
          tableName: 'LearningSession',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM "User" u WHERE ((u.id = "LearningSession"."userId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'Message', policy: 'message_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'Message',
        policy: {
          naming: { kind: 'exact', name: 'message_select_own' },
          tableName: 'Message',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "Message"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'SourceMaterial', policy: 'source_material_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'SourceMaterial',
        policy: {
          naming: { kind: 'exact', name: 'source_material_select_own' },
          tableName: 'SourceMaterial',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '(EXISTS ( SELECT 1 FROM ("LearningSession" ls JOIN "User" u ON ((u.id = ls."userId"))) WHERE ((ls.id = "SourceMaterial"."learningSessionId") AND (u."authUserId" = (( SELECT auth.uid() AS uid))::text))))',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'User', policy: 'user_insert_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'exact', name: 'user_insert_own' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'insert',
          roles: ['authenticated'],
          withCheck: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'User', policy: 'user_select_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'exact', name: 'user_select_own' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'select',
          roles: ['authenticated'],
          using: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),

      this.dropRlsPolicy({ schema: 'public', table: 'User', policy: 'user_update_own' }),
      this.createRlsPolicy({
        schema: 'public',
        table: 'User',
        policy: {
          naming: { kind: 'exact', name: 'user_update_own' },
          tableName: 'User',
          namespaceId: 'public',
          operation: 'update',
          roles: ['authenticated'],
          using: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          withCheck: '("authUserId" = (( SELECT auth.uid() AS uid))::text)',
          permissive: true,
        },
      }),

      rawSql({
        id: 'security.grant-authenticated-to-learnly-dev',
        label: 'Allow learnly_dev to SET ROLE authenticated for Supabase RLS',
        operationClass: 'additive',
        target: { id: 'postgres' },
        precheck: [
          {
            description: 'learnly_dev is not yet a member of authenticated with SET OPTION',
            sql: `
              SELECT NOT EXISTS (
                SELECT 1
                FROM pg_auth_members m
                JOIN pg_roles granted_role ON granted_role.oid = m.roleid
                JOIN pg_roles member_role ON member_role.oid = m.member
                WHERE granted_role.rolname = 'authenticated'
                  AND member_role.rolname = 'learnly_dev'
                  AND m.inherit_option = false
                  AND m.set_option = true
              )
            `,
          },
        ],
        execute: [
          {
            description: 'grant authenticated role to learnly_dev with SET',
            sql: `
              GRANT authenticated TO learnly_dev WITH INHERIT FALSE, SET TRUE, ADMIN FALSE
            `,
          },
        ],
        postcheck: [
          {
            description: 'learnly_dev can SET ROLE authenticated',
            sql: `
              SELECT EXISTS (
                SELECT 1
                FROM pg_auth_members m
                JOIN pg_roles granted_role ON granted_role.oid = m.roleid
                JOIN pg_roles member_role ON member_role.oid = m.member
                WHERE granted_role.rolname = 'authenticated'
                  AND member_role.rolname = 'learnly_dev'
                  AND m.inherit_option = false
                  AND m.set_option = true
              )
            `,
          },
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
