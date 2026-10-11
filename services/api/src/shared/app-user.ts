import type { UserDb } from "../prisma/db.js";

/** JWT identity is Supabase auth.uid(); application FKs use the owned User primary key. */
export async function appUserIdForAuthUser(client: UserDb, authUserId: string): Promise<string> {
  const user = await client.orm.public.User.where({ authUserId }).select("id").first();
  // New/uninitialized accounts have no owned data; keep the canonical new-account id.
  return user?.id ?? authUserId;
}
