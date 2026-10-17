import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import pgvector from '@prisma/orm-extension-pgvector/control';
import { resolveSupabaseCatalogProfile } from './scripts/lib/supabase-catalog-profile.mjs';
import { isSupabaseVerificationOverlayPath } from './scripts/lib/supabase-verification-overlay.mjs';

const command = process.argv.slice(2);
if (command[0] !== 'db' || command[1] !== 'verify') {
  throw new Error('prisma.verify.config.ts only permits `prisma db verify`.');
}
const profile = resolveSupabaseCatalogProfile(process.env.LEARNLY_SUPABASE_CATALOG_PROFILE);
if (profile.id !== 'gotrue-pop6-v6.1.1') {
  throw new Error('prisma.verify.config.ts requires the explicit GoTrue Pop 6.1.1 catalog profile.');
}
const migrationsDir = process.env.LEARNLY_SUPABASE_VERIFY_MIGRATIONS_DIR;
if (!migrationsDir || !isSupabaseVerificationOverlayPath(migrationsDir)) {
  throw new Error('prisma.verify.config.ts requires the guarded temporary migrations overlay.');
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    extensions: [profile.pack, pgvector],
    migrations: { dir: migrationsDir },
    db: { connection: process.env.DATABASE_URL! },
  }),
});
