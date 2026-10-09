"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "../../lib/supabase";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseClient();
    } catch {
      router.replace("/SignIn");
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setReady(true);
      } else {
        router.replace("/SignIn");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/SignIn");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return ready ? <>{children}</> : null;
}
