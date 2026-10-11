import 'dotenv/config';
import { supabase } from '@prisma/orm-extension-supabase/runtime';
import pgvector from '@prisma/orm-extension-pgvector/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Delay DB initialization until an authenticated route needs it. CI and
// unauthenticated health checks do not need database credentials.
let clientPromise: ReturnType<typeof supabase<Contract>> | undefined;

export function getDb() {
  if (!clientPromise) {
    const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const databaseUrl = process.env['DATABASE_URL'];
    if (!url || !databaseUrl) {
      throw new Error('SUPABASE_URL and DATABASE_URL are required for persistent learning.');
    }
    clientPromise = supabase<Contract>({
      contractJson,
      extensions: [pgvector],
      url: databaseUrl,
      jwksUrl: `${url.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`,
      poolOptions: { connectionTimeoutMillis: 3000 },
    });
  }
  return clientPromise;
}

export type UserDb = Awaited<ReturnType<Awaited<ReturnType<typeof getDb>>['asUser']>>;
