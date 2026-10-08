"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import LoadingOverlay from "../../components/LoadingOverlay";
import { getSupabaseClient } from "../../../lib/supabase";
import { syncCurrentUserProfile } from "../../../lib/user-profile";

const AFTER_LOGIN_PATH = "/Home";
const SESSION_TIMEOUT_MS = 15000;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlError = search.get("error_description") ?? hash.get("error_description");
    if (urlError || search.get("error") || hash.get("error")) {
      setError(urlError ?? "Authentication was not completed. Please try again.");
      return;
    }

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (configurationError) {
      setError(configurationError instanceof Error
        ? configurationError.message
        : "Authentication is unavailable.");
      return;
    }

    let active = true;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const completeSignIn = () => {
      if (!active || started) return;
      started = true;
      if (timer) clearTimeout(timer);

      // Do not call Supabase auth APIs synchronously within onAuthStateChange:
      // their internal auth lock may still be held by the notification callback.
      pending = setTimeout(async () => {
        try {
          await syncCurrentUserProfile();
          if (active) router.replace(AFTER_LOGIN_PATH);
        } catch (profileError) {
          if (!active) return;
          setError(profileError instanceof Error
            ? profileError.message
            : "Could not load your profile.");
        }
      }, 0);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) completeSignIn();
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || started) return;
      if (sessionError) {
        if (timer) clearTimeout(timer);
        setError(sessionError.message);
      } else if (data.session) {
        completeSignIn();
      }
    }).catch((sessionError: unknown) => {
      if (!active || started) return;
      if (timer) clearTimeout(timer);
      setError(sessionError instanceof Error
        ? sessionError.message
        : "Unable to restore your sign-in session.");
    });

    timer = setTimeout(() => {
      if (active && !started) {
        setError("Sign-in did not complete. Check your redirect URL or try again.");
      }
    }, SESSION_TIMEOUT_MS);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      if (pending) clearTimeout(pending);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-5 text-center text-neutral-900">
      {error ? (
        <>
          <p className="mb-6 text-base font-medium text-red-600">⚠️ {error}</p>
          <Link
            href="/SignIn"
            className="rounded-lg bg-black px-6 py-3.5 text-lg font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            Back to log in
          </Link>
        </>
      ) : (
        <LoadingOverlay message="Signing you in..." />
      )}
    </div>
  );
}
