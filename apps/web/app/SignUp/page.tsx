import type { Metadata } from "next";
import Link from "next/link";

import SignupForm from "./signup-form";

export const metadata: Metadata = {
  title: "Sign up — Learnly AI",
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <header className="px-5 pt-8 sm:px-12 lg:px-20">
        <Link href="/" className="text-lg font-medium tracking-wide text-neutral-900">
          LOGO
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8">
        <h1 className="mb-8 text-center text-xl font-normal text-neutral-500 whitespace-nowrap">
        Create your account
        </h1>
        <br></br>

        <SignupForm />
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
