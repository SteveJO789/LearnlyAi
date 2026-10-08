import 'dotenv/config';
import { supabase } from '@prisma/orm-extension-supabase/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// A role-neutral root has no ORM access. Every learning route must bind the
// verified Supabase JWT before querying Postgres so RLS sees auth.uid().
const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
if (!url) {
  throw new Error('SUPABASE_URL must be configured for authenticated database access.');
}

export const db = await supabase<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
  jwksUrl: `${url.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`,
});
