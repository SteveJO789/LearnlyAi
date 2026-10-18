"use client";

import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";

import { getSupabaseClient } from "../../lib/supabase";
import { isCurrentInitialAuthCheck, readInitialAuthState } from "../../lib/auth-state";

type AuthStatus = "loading" | "ready" | "error";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let signedOut = false;
    let observedSession = false;
    let authEventVersion = 0;
    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
    } catch {
      setStatus("error");
      return;
    }

    // Subscribe before reading the initial session so a concurrent logout or
    // cross-tab session change cannot be missed during startup.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "INITIAL_SESSION" && !session) return;
      authEventVersion += 1;
      if (!session) {
        if (event === "SIGNED_OUT") {
          signedOut = true;
          setStatus("loading");
          router.replace("/SignIn");
        } else if (event !== "INITIAL_SESSION") {
          setStatus("error");
        }
        return;
      }
      observedSession = true;
      signedOut = false;
      setUserId(session.user.id);
      setStatus("ready");
    });

    const initialEventVersion = authEventVersion;
    void readInitialAuthState(supabase.auth).then((result) => {
      if (!active || signedOut || observedSession || !isCurrentInitialAuthCheck(initialEventVersion, authEventVersion)) return;
      if (result.status === "error") {
        setStatus("error");
      } else if (result.status === "authenticated") {
        setUserId(result.userId);
        setStatus("ready");
      } else {
        router.replace("/SignIn");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [attempt, router]);

  if (status === "error") {
    return <main role="alert" className="mx-auto max-w-lg p-8 text-center">
      <p>We could not check your sign-in status. Check your connection and retry.</p>
      <button type="button" onClick={retry} className="mt-4 rounded-lg bg-primary px-4 py-2 text-primary-foreground">Retry</button>
    </main>;
  }
  return status === "ready" ? <Fragment key={userId ?? "authenticated"}>{children}</Fragment> : null;
}
