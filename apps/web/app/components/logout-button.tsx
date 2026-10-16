"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignOutFailure, signOutCurrentUser } from "../../lib/auth-state";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      await signOutCurrentUser();
      router.replace("/SignIn");
      router.refresh();
    } catch (failure) {
      if (failure instanceof SignOutFailure && failure.localSessionCleared) {
        router.replace("/SignIn?logout=unconfirmed");
        router.refresh();
      } else {
        setError(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return <>
    {error && <p role="alert" className="text-sm text-danger">Could not log out. Please retry.</p>}
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="rounded-lg bg-neutral-100 px-4 py-2 text-base font-medium text-neutral-700 hover:bg-neutral-200"
    >
      {busy ? "Logging out…" : error ? "Retry log out" : "Log out"}
    </button>
  </>;
}
