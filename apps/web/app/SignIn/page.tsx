import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Log in — Learnly AI",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <header className="px-5 pt-8 sm:px-12 lg:px-20">
        <Link href="/" className="text-lg font-medium tracking-wide text-neutral-900">
          LOGO
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8">
        <h1 className="mb-8 text-center text-xl font-normal text-neutral-500">
          Log in
        </h1>
        <br></br>

        {/*
          TODO(Best): wire this up to POST /api/v1/auth/google or a future
          email/password endpoint once docs/api-contract.md defines one.
          Currently this is presentational only.
        */}
        <form className="flex w-full max-w-[500px] flex-col gap-4">
          <div
            className="gradient-drift flex flex-col gap-5 rounded-3xl p-9"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            }}
          >
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
              autoComplete="current-password"
              required
              className="w-full rounded-full bg-neutral-100 px-6 py-4 text-base text-neutral-900 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-neutral-900"
            />
          </div>
          
          <button
            type="submit"
            className="rounded-lg bg-black px-6 py-3.5 text-lg font-medium text-white shadow-sm hover:bg-neutral-800"
          >
            
            Log in
            
          </button>
            
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-lg bg-neutral-100 px-6 py-3.5 text-lg font-medium text-neutral-500 shadow-sm hover:bg-neutral-200"
          >
            <GoogleIcon />
            <span>Log in with Google</span>
          </button>

          <p className="mt-1 text-center text-base text-neutral-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-blue-700 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </main>

      <Link
        href="/"
        className="mb-8 ml-5 self-start text-lg text-neutral-500 hover:underline sm:ml-12 lg:ml-20"
      >
        Back
      </Link>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 27 36 24 36c-5.3 0-9.6-3.3-11.2-8l-6.6 5.1C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C40.2 36.9 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}
