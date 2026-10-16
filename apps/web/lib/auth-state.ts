import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./supabase";

const LOGOUT_NOTICE_KEY = "learnlyai.logout.notice";
export const LOGOUT_NOTICE_EVENT = "learnlyai:logout-notice";
const LOGOUT_NOTICE_MAX_AGE_MS = 2 * 60 * 1000;
export const LOGOUT_LOCAL_ONLY_NOTICE = "You are signed out on this device, but server sign-out could not be confirmed.";
export const LOGOUT_UNCONFIRMED_NOTICE = "Server sign-out could not be confirmed. Please check your connection.";

export class SignOutFailure extends Error {
  constructor(readonly localSessionCleared: boolean, readonly notice: string) {
    super(notice);
    this.name = "SignOutFailure";
  }
}

function setLogoutNotice(message: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LOGOUT_NOTICE_KEY, JSON.stringify({ createdAt: Date.now(), message }));
  } catch {
    // The query fallback and same-tab event still provide a safe generic notice.
  }
  try {
    window.dispatchEvent(new CustomEvent(LOGOUT_NOTICE_EVENT, { detail: message }));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export function takeLogoutNotice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(LOGOUT_NOTICE_KEY);
    window.sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as { createdAt?: unknown; message?: unknown };
    const age = Date.now() - (typeof value.createdAt === "number" ? value.createdAt : Number.NaN);
    if (!Number.isFinite(age) || age < 0 || age > LOGOUT_NOTICE_MAX_AGE_MS) return null;
    if (value.message === LOGOUT_LOCAL_ONLY_NOTICE || value.message === LOGOUT_UNCONFIRMED_NOTICE) return value.message;
  } catch {
    return null;
  }
  return null;
}

export function clearLogoutNotice(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(LOGOUT_NOTICE_KEY); } catch { /* Storage may be blocked. */ }
}

export type InitialAuthState =
  | { status: "authenticated"; userId: string | null }
  | { status: "unauthenticated" | "error" };

export function isCurrentInitialAuthCheck(startVersion: number, currentVersion: number): boolean {
  return startVersion === currentVersion;
}

const confirmedAbsenceCodes = new Set(["bad_jwt", "user_not_found", "session_not_found"]);

/** Classify only explicit Auth rejection as an absent/invalid session. */
export function isConfirmedAuthAbsence(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && (
    error.status === 401 || error.status === 403 || confirmedAbsenceCodes.has(error.code ?? "")
  );
}

/** Resolve only when Supabase confirms logout succeeded. */
export async function signOutCurrentUser(): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clearLogoutNotice();
  } catch {
    let localSessionCleared = false;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error) localSessionCleared = data.session === null;
    } catch {
      // Unknown session state gets the less specific notice.
    }
    const notice = localSessionCleared ? LOGOUT_LOCAL_ONLY_NOTICE : LOGOUT_UNCONFIRMED_NOTICE;
    setLogoutNotice(notice);
    throw new SignOutFailure(localSessionCleared, notice);
  }
}

/** Classify the initial SDK check without treating transport errors as logout. */
export async function readInitialAuthState(auth: {
  getSession: () => Promise<{ data?: { session?: { user?: { id?: string } } | null }; error?: unknown }>;
}): Promise<InitialAuthState> {
  try {
    const result = await auth.getSession();
    if (result.error) return { status: "error" };
    const session = result.data?.session;
    if (!session) return { status: "unauthenticated" };
    return { status: "authenticated", userId: session.user?.id ?? null };
  } catch {
    return { status: "error" };
  }
}
