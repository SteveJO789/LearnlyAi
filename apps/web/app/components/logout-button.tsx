"use client";

import { useRouter } from "next/navigation";

import { getSupabaseClient } from "../../lib/supabase";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await getSupabaseClient().auth.signOut();
    router.replace("/SignIn");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg bg-neutral-100 px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-200"
    >
      Log out
    </button>
  );
}
