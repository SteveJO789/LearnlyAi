import { getDb } from "../prisma/db.js";
import type { AuthenticatedRequest } from "../modules/auth/supabase-auth.js";

export function verifiedUser(request: AuthenticatedRequest) {
  if (!request.authUser || !request.authToken) throw new Error("Missing verified authentication context.");
  return request.authUser;
}

export async function authenticatedDb(request: AuthenticatedRequest) {
  verifiedUser(request);
  return (await getDb()).asUser(request.authToken!);
}
