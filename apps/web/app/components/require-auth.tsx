"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseClient } from "../../lib/supabase";

// ครอบหน้าที่ต้อง login (/profile, /chatbot, /history):
//   <RequireAuth>...เนื้อหาหน้า...</RequireAuth>
// ไม่มี session -> redirect ไป /SignIn
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let supabase;\n    try {\n      supabase = getSupabaseClient();\n    } catch {\n      router.replace("/SignIn");\n      return;\n    }\n\n    let active = true;

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
