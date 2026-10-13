"use client";
import { createIsolatedPasswordClient, getSupabaseClient } from "./supabase";

export type PasswordChangeCode = "AUTH_REQUIRED" | "CURRENT_INVALID" | "NEW_INVALID" | "MISMATCH" | "OAUTH_ONLY" |
  "WEAK_PASSWORD" | "SAME_PASSWORD" | "RATE_LIMITED" | "REAUTH_REQUIRED" | "IDENTITY_CHANGED" | "UNAVAILABLE" | "UNKNOWN_OUTCOME";
export class PasswordChangeError extends Error {
  constructor(readonly code: PasswordChangeCode) { super("The password operation could not be completed."); }
}
async function boundedLookup<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new PasswordChangeError("UNAVAILABLE")), 20000);
  })]); } finally { clearTimeout(timer); }
}
function mapAuthCode(error: unknown, changing: boolean): PasswordChangeError {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "weak_password") return new PasswordChangeError("WEAK_PASSWORD");
  if (code === "same_password") return new PasswordChangeError("SAME_PASSWORD");
  if (["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"].includes(String(code))) return new PasswordChangeError("RATE_LIMITED");
  if (["reauthentication_needed", "reauthentication_not_valid", "insufficient_aal"].includes(String(code))) return new PasswordChangeError("REAUTH_REQUIRED");
  if (code === "invalid_credentials") return new PasswordChangeError("CURRENT_INVALID");
  if (["session_not_found", "user_not_found", "bad_jwt", "refresh_token_not_found"].includes(String(code))) return new PasswordChangeError("AUTH_REQUIRED");
  // HTTP rejection codes are conclusive; thrown/unknown transport errors during mutation are not.
  return new PasswordChangeError(changing && !code ? "UNKNOWN_OUTCOME" : "UNAVAILABLE");
}

export async function changeCurrentUserPassword(current: string, next: string, confirm: string): Promise<void> {
  if (typeof current !== "string" || !current || current.length > 1024) throw new PasswordChangeError("CURRENT_INVALID");
  if (typeof next !== "string" || next.length < 8 || next.length > 1024) throw new PasswordChangeError("NEW_INVALID");
  if (next !== confirm) throw new PasswordChangeError("MISMATCH");
  let user;
  try { const result = await boundedLookup(getSupabaseClient().auth.getUser()); if (result.error || !result.data.user) throw new PasswordChangeError("AUTH_REQUIRED"); user = result.data.user; }
  catch (error) { throw error instanceof PasswordChangeError ? error : new PasswordChangeError("UNAVAILABLE"); }
  if (!user.email) throw new PasswordChangeError("AUTH_REQUIRED");
  const socialIdentityOnly = Boolean(user.identities?.length && !user.identities.some(identity => identity.provider === "email"));
  const expectedId = user.id;
  let isolated;
  try { isolated = createIsolatedPasswordClient(); } catch { throw new PasswordChangeError("UNAVAILABLE"); }
  let changing = false;
  try {
    const verified = await isolated.auth.signInWithPassword({ email: user.email, password: current });
    if (verified.error) {
      const mapped = mapAuthCode(verified.error, false);
      throw socialIdentityOnly && mapped.code === "CURRENT_INVALID" ? new PasswordChangeError("OAUTH_ONLY") : mapped;
    }
    if (!verified.data.user || verified.data.user.id !== expectedId) throw new PasswordChangeError("IDENTITY_CHANGED");
    // Bind the mutation to this verified actor, avoiding cross-tab changes to the main browser client's identity.
    changing = true;
    const updated = await isolated.auth.updateUser({ password: next, current_password: current });
    if (updated.error) throw mapAuthCode(updated.error, true);
    if (!updated.data.user || updated.data.user.id !== expectedId) throw new PasswordChangeError("UNKNOWN_OUTCOME");
  } catch (error) {
    throw error instanceof PasswordChangeError ? error : new PasswordChangeError(changing ? "UNKNOWN_OUTCOME" : "UNAVAILABLE");
  } finally {
    // Local scope revokes only the short-lived verification session, never the browser/all-device sessions.
    try { await isolated.auth.signOut({ scope: "local" }); } catch { /* No credentials, tokens or raw upstream messages are logged. */ }
    try { await isolated.auth.stopAutoRefresh(); } catch { /* The client was constructed without refresh/persistence. */ }
  }
}
