"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import LoadingOverlay from "../components/LoadingOverlay";
import { getSupabaseClient } from "../../lib/supabase";
import { syncCurrentUserProfile } from "../../lib/user-profile";

export default function SigninForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (signInError) {
        const notConfirmed = signInError.code === "email_not_confirmed" || /not confirmed/i.test(signInError.message);
        setError(notConfirmed ? "Please verify your email before signing in." : "Incorrect email or password. Please try again.");
        return;
      }
      await syncCurrentUserProfile();
      router.push("/Home");
    } catch (configurationError) {
      setError(configurationError instanceof Error ? configurationError.message : "Authentication is unavailable.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setIsLoading(true);
    try {
      const { error: oauthError } = await getSupabaseClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) {
        setIsLoading(false);
        setError(oauthError.message);
      }
    } catch (configurationError) {
      setIsLoading(false);
      setError(configurationError instanceof Error ? configurationError.message : "Authentication is unavailable.");
    }
  }

  return (
    <>
      {isLoading && <LoadingOverlay message="Logging in..." />}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span className="auth-field-icon" aria-hidden="true">✉</span>
          <span className="sr-only">Email address</span>
          <input type="email" name="email" placeholder="Email address" autoComplete="email" required />
        </label>
        <label className="auth-field">
          <span className="auth-field-icon" aria-hidden="true">♙</span>
          <span className="sr-only">Password</span>
          <input type={showPassword ? "text" : "password"} name="password" placeholder="Password" autoComplete="current-password" required />
          <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "◉" : "◎"}</button>
        </label>
        <div className="auth-form-meta">
          <label className="auth-remember"><input type="checkbox" name="remember" /> <span>Remember me</span></label>
          <span className="auth-inline-hint">Your next chapter awaits ✦</span>
        </div>
        {error && <p role="alert" className="auth-error">⚠ {error}</p>}
        <button type="submit" disabled={isLoading} className="auth-primary-button"><span>Sign In</span><span aria-hidden="true">➜</span></button>
        <div className="auth-divider"><span>or</span></div>
        <button type="button" onClick={handleGoogleSignIn} className="auth-google-button"><GoogleIcon /><span>Continue with Google</span></button>
        <p className="auth-switch">Don&apos;t have an account? <Link href="/SignUp">Sign Up</Link></p>
      </form>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 27 36 24 36c-5.3 0-9.6-3.3-11.2-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C40.2 36.9 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
