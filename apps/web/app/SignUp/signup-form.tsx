"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    // TODO(Best): wire this up to a real "create account" endpoint once
    // docs/api-contract.md defines one. That's also where the "this email
    // is already registered" error (see the Figma "Sign up-Email error"
    // frame) needs to come from — it can only be known server-side.
    setError(null);
    router.push("/");
  }

  return (
    <form className="flex w-full max-w-[500px] flex-col gap-4" onSubmit={handleSubmit}>
      <div
        className="gradient-drift flex flex-col gap-5 rounded-3xl p-9"
        style={{
          backgroundImage:
            "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
        }}
      >
        <input
          type="text"
          name="name"
          placeholder="Name"
          autoComplete="name"
          required
          className="w-full rounded-full bg-neutral-100 px-6 py-4 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-neutral-900"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="w-full rounded-full bg-neutral-100 px-6 py-4 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-neutral-900"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="new-password"
          required
          className="w-full rounded-full bg-neutral-100 px-6 py-4 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-neutral-900"
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          autoComplete="new-password"
          required
          className="w-full rounded-full bg-neutral-100 px-6 py-4 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-neutral-900"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600">⚠️ {error}</p>
      )}

      <button
        type="submit"
        className="rounded-lg bg-black px-6 py-3.5 text-lg font-medium text-white shadow-sm hover:bg-neutral-800"
      >
        Sign up
      </button>

      <p className="mt-1 text-center text-base text-neutral-500">
        Already have an account?{" "}
        <Link href="/SignIn" className="font-medium text-blue-700 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
