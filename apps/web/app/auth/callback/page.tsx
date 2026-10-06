"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import LoadingOverlay from "../../components/LoadingOverlay";
import { getSupabaseClient } from "../../../lib/supabase";

const AFTER_LOGIN_PATH = "/";
const TIMEOUT_MS = 10000;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlError = search.get("error_description") ?? hash.get("error_description");
    if (urlError) {
      setError(urlError);
      return;
    }

    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch (configurationError) {
      setError(
        configurationError instanceof Error
          ? configurationError.message
          : "Authentication is unavailable."
      );
      return;
    }

    let done = false;
    const goNext = () => {
      if (done) return;
      done = true;
      router.replace(AFTER_LOGIN_PATH);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goNext();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });

    const timer = setTimeout(() => {
      if (!done) setError("Sign-in did not complete. Please try again.");
    }, TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
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
