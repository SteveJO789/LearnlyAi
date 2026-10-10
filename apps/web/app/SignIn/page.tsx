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
        <Link href="/" aria-label="LearnlyAI home" className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-sky-500 text-xl text-white shadow-sm">✿</span>
          <span className="bg-gradient-to-r from-teal-600 via-sky-600 to-indigo-600 bg-clip-text text-transparent">LearnlyAI</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8">
        <h1 className="mb-8 text-center text-xl font-normal text-neutral-500">
          Log in
        </h1>
        <br></br>

        {/* Call Client Form Component */}
        <SigninForm />
      </main>
    </div>
  );
}