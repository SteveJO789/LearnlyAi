import type { Metadata } from "next";
import Link from "next/link";
import SigninForm from "./signin-form";

export const metadata: Metadata = {
  title: "Log in — Learnly AI",
};

export default function LoginPage() {
  return (
    <div className="auth-page min-h-screen flex flex-col bg-white text-black">
      <header className="px-5 pt-8 sm:px-12 lg:px-20">
        <Link href="/" className="text-lg font-medium tracking-wide text-black">
          LOGO
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8">
        <h1 className="mb-8 text-center text-xl font-semibold text-neutral-500 [font-family:var(--font-fredoka)]">
          Log in
        </h1>
        <br></br>

        {/* Call Client Form Component */}
        <SigninForm />
      </main>
    </div>
  );
}
