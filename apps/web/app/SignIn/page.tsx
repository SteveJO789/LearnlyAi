import type { Metadata } from "next";
import Link from "next/link";
import SigninForm from "./signin-form";

export const metadata: Metadata = {
  title: "Log in — Learnly AI",
};

export default function LoginPage() {
  return (
    <div className="auth-page dreamy-auth min-h-screen flex flex-col text-slate-700">
      <div aria-hidden="true" className="auth-orb auth-orb-one" />
      <div aria-hidden="true" className="auth-orb auth-orb-two" />
      <div aria-hidden="true" className="auth-orb auth-orb-three" />
      <span aria-hidden="true" className="auth-sparkle sparkle-one">✦</span>
      <span aria-hidden="true" className="auth-sparkle sparkle-two">✧</span>
      <span aria-hidden="true" className="auth-sparkle sparkle-three">✦</span>

      <header className="relative z-10 px-5 pt-6 sm:px-10 lg:px-16">
        <Link href="/" aria-label="LearnlyAI home" className="auth-brand inline-flex items-center gap-3">
          <span aria-hidden="true" className="auth-brand-mark">✿</span>
          <span className="auth-brand-word">LearnlyAI</span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <section className="auth-glass-card w-full max-w-lg">
          <div aria-hidden="true" className="auth-card-glow" />
          <div className="relative z-10">
            <div className="auth-mascot" aria-hidden="true"><span>✿</span><i>✦</i></div>
            <p className="auth-eyebrow">YOUR LITTLE LEARNING UNIVERSE</p>
            <h1 className="auth-title">
              <span className="auth-title-blue">Welcome</span>{" "}
              <span className="auth-title-pink">back!</span>
            </h1>
            <p className="auth-subtitle">กลับมาเรียนรู้กันอีกครั้งนะ <span aria-hidden="true">♡</span></p>
            <SigninForm />
          </div>
          <div aria-hidden="true" className="auth-bottom-clouds"><span>✦</span><span>✧</span><span>✦</span></div>
        </section>
      </main>
    </div>
  );
}
