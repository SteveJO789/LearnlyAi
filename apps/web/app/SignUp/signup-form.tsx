"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import LoadingOverlay from "../components/LoadingOverlay";
import { getSupabaseClient } from "../../lib/supabase";

const MIN_PASSWORD_LENGTH = 8;

export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!username) {
      setError("Username is required");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { data, error: signUpError } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("This email is already registered");
        return;
      }

      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (configurationError) {
      setError(
        configurationError instanceof Error
          ? configurationError.message
          : "Authentication is unavailable."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {isLoading && <LoadingOverlay message="Creating your account..." />}

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
            name="username"
            placeholder="Username"
            autoComplete="username"
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

        {error && <p className="text-sm font-medium text-red-600">⚠️ {error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-primary px-6 py-3.5 text-lg font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
        >
          Sign up
        </button>

        <p className="mt-1 text-center text-base text-muted">
          Already have an account?{" "}
          <Link href="/SignIn" className="font-medium text-blue-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </>
  );
}
