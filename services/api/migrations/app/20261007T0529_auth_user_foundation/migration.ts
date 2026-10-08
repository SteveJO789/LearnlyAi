#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/075d335ff9821e0a5aad5ebad02493ca3bbe76ef65d9e3fca3b49b2e4055abdd/contract';
import endContract from '../../snapshots/075d335ff9821e0a5aad5ebad02493ca3bbe76ef65d9e3fca3b49b2e4055abdd/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/452158074d4d75d38f0c775bdb714abcc49090d7a429bc916b9a1a02c08bbcd1/contract';
import startContract from '../../snapshots/452158074d4d75d38f0c775bdb714abcc49090d7a429bc916b9a1a02c08bbcd1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
  return [
    this.addColumn({
      schema: 'public',
      table: 'User',
      column: col('username', 'text', { codecRef: { codecId: 'pg/text@1' } }),
    }),

    this.addColumn({
      schema: 'public',
      table: 'User',
      column: col('authUserId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
    }),

    rawSql({
      id: 'data.cleanup-duplicate-users',
      label: 'Remove duplicate public.User rows already represented by Supabase Auth',
      operationClass: 'destructive',
      target: { id: 'postgres' },
      precheck: [
        {
          description: 'duplicate user exists without dependent data',
          sql: `
            SELECT EXISTS (
              SELECT 1
              FROM "public"."User" legacy
              JOIN "auth"."users" auth_user
                ON lower(auth_user."email") = lower(legacy."email")
              JOIN "public"."User" canonical
                ON canonical."id" = auth_user."id"::text
              WHERE legacy."id" <> auth_user."id"::text
                AND NOT EXISTS (
                  SELECT 1
                  FROM "public"."LearningSession" s
                  WHERE s."userId" = legacy."id"
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM "public"."LearningProfile" p
                  WHERE p."userId" = legacy."id"
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM "public"."OAuthAccount" o
                  WHERE o."userId" = legacy."id"
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM "public"."AppSession" s
                  WHERE s."userId" = legacy."id"
                )
            )
          `,
        },
      ],
      execute: [
        {
          description: 'remove safe duplicate users',
          sql: `
            DELETE FROM "public"."User" legacy
            USING "auth"."users" auth_user, "public"."User" canonical
            WHERE lower(auth_user."email") = lower(legacy."email")
              AND canonical."id" = auth_user."id"::text
              AND legacy."id" <> auth_user."id"::text
              AND NOT EXISTS (
                SELECT 1
                FROM "public"."LearningSession" s
                WHERE s."userId" = legacy."id"
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "public"."LearningProfile" p
                WHERE p."userId" = legacy."id"
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "public"."OAuthAccount" o
                WHERE o."userId" = legacy."id"
              )
              AND NOT EXISTS (
                SELECT 1
                FROM "public"."AppSession" s
                WHERE s."userId" = legacy."id"
              )
          `,
        },
      ],
      postcheck: [
        {
          description: 'no unsafe duplicate users remain',
          sql: `
            SELECT NOT EXISTS (
              SELECT 1
              FROM "public"."User" legacy
              JOIN "auth"."users" auth_user
                ON lower(auth_user."email") = lower(legacy."email")
              JOIN "public"."User" canonical
                ON canonical."id" = auth_user."id"::text
              WHERE legacy."id" <> auth_user."id"::text
            )
          `,
        },
      ],
    }),

    rawSql({
      id: 'data.backfill-user-authUserId',
      label: 'Backfill User.authUserId from Supabase Auth',
      operationClass: 'data',
      target: { id: 'postgres' },
      precheck: [
        {
          description: 'User.authUserId still has NULL values',
          sql: `
            SELECT EXISTS (
              SELECT 1
              FROM "public"."User"
              WHERE "authUserId" IS NULL
            )
          `,
        },
      ],
      execute: [
        {
          description: 'set User.authUserId from auth.users',
          sql: `
            UPDATE "public"."User" u
            SET "authUserId" = auth_user."id"::text
            FROM "auth"."users" auth_user
            WHERE u."authUserId" IS NULL
              AND (
                u."id" = auth_user."id"::text
                OR (
                  lower(u."email") = lower(auth_user."email")
                  AND NOT EXISTS (
                    SELECT 1
                    FROM "public"."User" canonical
                    WHERE canonical."id" = auth_user."id"::text
                  )
                )
              )
          `,
        },
      ],
      postcheck: [
        {
          description: 'all User rows have authUserId',
          sql: `
            SELECT NOT EXISTS (
              SELECT 1
              FROM "public"."User"
              WHERE "authUserId" IS NULL
            )
          `,
        },
      ],
    }),

    this.dropTable({
      schema: 'public',
      table: 'AppSession',
    }),

    this.dropTable({
      schema: 'public',
      table: 'OAuthAccount',
    }),

    this.setNotNull({
      schema: 'public',
      table: 'User',
      column: 'authUserId',
    }),

    this.addUnique({
      schema: 'public',
      table: 'User',
      constraint: 'User_authUserId_key',
      columns: ['authUserId'],
    }),

    this.addUnique({
      schema: 'public',
      table: 'User',
      constraint: 'User_username_key',
      columns: ['username'],
    }),

    this.createIndex({
      schema: 'public',
      table: 'User',
      index: 'User_email_idx_46df9cad',
      columns: ['email'],
    }),
  ];
}
}

MigrationCLI.run(import.meta.url, M);
