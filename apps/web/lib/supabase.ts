import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  browserClient = createClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}

/** A short-lived password-operation client must never replace browser-managed Auth state. */
export function createIsolatedPasswordClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured.");
  return createClient(url, key, { global: { fetch: async (input, init) => {
    const controller = new AbortController(), inherited = init?.signal;
    const cancel = () => controller.abort();
    if (inherited?.aborted) controller.abort();
    inherited?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(cancel, 15000);
    try { return await fetch(input, { ...init, signal: controller.signal, redirect: "error" }); }
    finally { clearTimeout(timeout); inherited?.removeEventListener("abort", cancel); }
  } }, auth: {
    persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
    storageKey: "learnly-password-verification",
  } });
}
