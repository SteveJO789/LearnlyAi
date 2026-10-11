import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import supabasePack from '@prisma/orm-extension-supabase/pack';
import pgvector from '@prisma/orm-extension-pgvector/control';

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    extensions: [supabasePack, pgvector],
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
