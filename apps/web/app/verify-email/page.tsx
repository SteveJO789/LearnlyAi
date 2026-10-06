import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Verify your email — Learnly AI",
};

// Next.js 15+ : searchParams เป็น Promise ต้อง await
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      <header className="px-5 pt-8 sm:px-12 lg:px-20">
        <Link href="/" className="text-lg font-medium tracking-wide text-neutral-900">
          LOGO
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-24 pt-8 text-center">
        <h1 className="mb-4 text-xl font-normal text-neutral-900">Verification email sent</h1>
        <p className="max-w-[420px] text-base text-neutral-500">
          We&apos;ve sent a verification link to
          {email ? (
            <>
              {" "}
              <span className="font-medium text-neutral-900">{email}</span>.
            </>
          ) : (
            " your email."
          )}{" "}
          Please verify your email before signing in.
        </p>

        <Link
          href="/SignIn"
          className="mt-8 rounded-lg bg-black px-6 py-3.5 text-lg font-medium text-white shadow-sm hover:bg-neutral-800"
        >
          Back to log in
        </Link>
      </main>
    </div>
  );
}
