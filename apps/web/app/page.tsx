
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./lib/i18n/LanguageContext";
import "./Home/style.css";

function LandingAmbientEffects() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Soft ambient glows; keeps the landing page's existing palette */}
      <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-pink-300/20 blur-[110px] animate-[gentleFloat_9s_ease-in-out_infinite]" />
      <div className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-sky-300/20 blur-[120px] animate-[gentleFloat_11s_ease-in-out_infinite]" />
      <div className="absolute left-[32%] top-[38%] h-72 w-72 rounded-full bg-violet-300/15 blur-[110px] animate-[gentleFloat_13s_ease-in-out_infinite]" />

      {/* Floating twinkles */}
      <span className="absolute left-[8%] top-[24%] text-sm text-pink-400 animate-[softSparkle_2.4s_ease-in-out_infinite]">✦</span>
      <span className="absolute left-[26%] top-[14%] text-xs text-violet-400 animate-[softSparkle_3s_ease-in-out_infinite]">✧</span>
      <span className="absolute left-[43%] top-[30%] text-sm text-sky-400 animate-[softSparkle_2.8s_ease-in-out_infinite]">✦</span>
      <span className="absolute right-[20%] top-[18%] text-xs text-pink-400 animate-[softSparkle_3.2s_ease-in-out_infinite]">✧</span>
      <span className="absolute right-[10%] top-[38%] text-sm text-violet-400 animate-[softSparkle_2.6s_ease-in-out_infinite]">✦</span>
      <span className="absolute left-[13%] top-[62%] text-xs text-sky-400 animate-[softSparkle_3.4s_ease-in-out_infinite]">✧</span>
      <span className="absolute left-[35%] top-[76%] text-sm text-pink-400 animate-[softSparkle_2.9s_ease-in-out_infinite]">✦</span>
      <span className="absolute right-[28%] top-[68%] text-xs text-violet-400 animate-[softSparkle_3.1s_ease-in-out_infinite]">✧</span>
      <span className="absolute right-[14%] top-[80%] text-sm text-sky-400 animate-[softSparkle_2.7s_ease-in-out_infinite]">✦</span>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((n) => (n + 1) % 3),
      4200
    );
    return () => window.clearInterval(timer);
  }, []);

  const features = [
    ["home.feature1Title", "home.feature1Body", "✦"],
    ["home.feature2Title", "home.feature2Body", "◎"],
    ["home.feature3Title", "home.feature3Body", "↗"],
  ] as const;

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-white text-slate-900">\n      <LandingAmbientEffects />\n      <div className="relative z-10">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-10 lg:px-16">
        <Link
          href="/"
          aria-label="LearnlyAI home"
          className="auth-brand inline-flex items-center gap-3"
        >
          <span aria-hidden="true" className="auth-brand-mark">
            ✿
          </span>
          <span className="auth-brand-word">LearnlyAI</span>
        </Link>

        <Link
          href="/SignIn"
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          {t("home.signIn")}
        </Link>
      </header>

      <main className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-16">
        {/* Hero */}
        <section className="grid items-center gap-5 pb-10 pt-8 sm:pb-14 lg:min-h-[500px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10">
            <div className="mb-5 inline-flex animate-[fadeInUp_.7s_ease-out_both] rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
              <span className="mr-2 inline-block animate-[softSparkle_2.4s_ease-in-out_infinite]">
                ✦
              </span>
              {t("home.eyebrow")}
            </div>

            <h1 className="max-w-[12ch] animate-[fadeInUp_.8s_ease-out_both] text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {t("home.welcome")}{" "}
              <span className="bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 bg-clip-text text-transparent">
                LearnlyAI
              </span>
            </h1>

            <p className="mt-6 max-w-xl animate-[fadeInUp_.9s_ease-out_both] text-lg leading-relaxed text-slate-500 sm:text-xl">
              {t("home.tagline")}
            </p>

            <Link
              href="/SignIn"
              className="mt-8 inline-flex animate-[fadeInUp_1s_ease-out_both] rounded-xl bg-slate-900 px-7 py-4 font-semibold text-white shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              {t("home.start")} →
            </Link>
          </div>

          {/* Robot illustration — preserve original colors */}
          <div className="hero-robot relative mx-auto aspect-square w-full max-w-[440px]">
            <div className="robot-orbit absolute inset-[8%] rounded-full bg-gradient-to-br from-teal-100 via-sky-50 to-violet-100" />

            <div className="sparkle sparkle-one absolute left-[8%] top-[24%] z-10 grid h-14 w-16 place-items-center rounded-2xl bg-white text-2xl shadow-lg">
              ✦
            </div>

            <div className="sparkle sparkle-two absolute right-[7%] top-[25%] z-10 rounded-2xl bg-white px-4 py-3 shadow-lg">
              <div className="flex h-8 items-end gap-1.5">
                <span className="h-3 w-2 rounded-t bg-teal-300" />
                <span className="h-5 w-2 rounded-t bg-teal-400" />
                <span className="h-8 w-2 rounded-t bg-teal-500" />
              </div>
            </div>

            <div className="robot-body absolute left-1/2 top-[13%] h-[51%] w-[51%] -translate-x-1/2 rounded-[38%] border-[10px] border-sky-200 bg-gradient-to-br from-white to-slate-100 shadow-xl">
              <div className="absolute -left-5 top-[28%] h-14 w-5 rounded-l-full bg-teal-400" />
              <div className="absolute -right-5 top-[28%] h-14 w-5 rounded-r-full bg-teal-400" />

              <div className="robot-face absolute inset-[11%] rounded-[35%] bg-gradient-to-br from-slate-900 to-blue-950">
                <div className="robot-eye absolute left-[24%] top-[38%] h-4 w-5 rounded-full bg-cyan-300" />
                <div className="robot-eye absolute right-[24%] top-[38%] h-4 w-5 rounded-full bg-cyan-300" />
                <div className="robot-smile absolute bottom-[23%] left-1/2 h-3 w-8 -translate-x-1/2 rounded-b-full border-b-[4px] border-cyan-300" />
              </div>
            </div>

            <div className="robot-laptop absolute bottom-[21%] left-[19%] h-[13%] w-[62%] -rotate-2 rounded-xl border-b-8 border-sky-300 bg-gradient-to-r from-blue-600 via-sky-500 to-teal-400 shadow-lg" />

            <div className="absolute bottom-[34%] left-[25%] h-[12%] w-[50%] rounded-lg border-b-4 border-slate-300 bg-white shadow-md" />

            <div className="absolute bottom-[31%] left-[31%] h-[19%] w-[38%] rounded-t-md bg-gradient-to-br from-blue-600 to-blue-900 p-2 shadow-xl" />

            <div className="robot-ai-card absolute bottom-[15%] right-[5%] h-[15%] w-[27%] -rotate-6 rounded-lg border border-slate-300 bg-gradient-to-br from-slate-100 to-slate-400 p-1.5 shadow-lg">
              <div className="grid h-full place-items-center text-xl font-bold text-slate-500">
                AI
              </div>
            </div>

            <div className="absolute bottom-[15%] left-[6%] animate-[gentleFloat_3.5s_ease-in-out_infinite] text-4xl">
              🌱
            </div>

            <div className="sun-glow absolute left-[21%] top-[8%] text-3xl text-amber-400">
              ☀
            </div>

            <span className="ambient-spark ambient-spark-one" />
            <span className="ambient-spark ambient-spark-two" />
            <span className="ambient-spark ambient-spark-three" />
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-slate-200 py-10 sm:py-12">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-600">
              {t("home.featuresEyebrow")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.featuresTitle")}
            </h2>
            <p className="mt-3 leading-relaxed text-slate-500 sm:text-lg">
              {t("home.featuresIntro")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(([title, body, icon], i) => (
              <article
                key={title}
                className="feature-card rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl text-2xl ${
                    i === 0
                      ? "bg-teal-100 text-teal-700"
                      : i === 1
                        ? "bg-blue-100 text-blue-700"
                        : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {icon}
                </div>
                <h3 className="text-xl font-semibold">{t(title)}</h3>
                <p className="mt-2 leading-relaxed text-slate-500">{t(body)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Demo */}
        <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal-600">
              {t("home.demoEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              {t("home.demoTitle")}
            </h2>
            <p className="mt-4 leading-relaxed text-slate-500 sm:text-lg">
              {t("home.demoIntro")}
            </p>

            <ol className="mt-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <li
                  key={n}
                  className={`flex items-start gap-3 rounded-xl p-3 transition duration-300 ${
                    step + 1 === n ? "bg-teal-50 shadow-sm" : ""
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white transition ${
                      step + 1 === n ? "bg-teal-600 scale-110" : "bg-teal-500"
                    }`}
                  >
                    {n}
                  </span>
                  <span className="pt-1 font-medium">{t(`home.demoStep${n}`)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="chat-demo relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-xl sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-400 via-sky-500 to-violet-500" />

            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-100 text-xl text-teal-700">
                ✦
              </div>
              <div>
                <p className="font-semibold">LearnlyAI</p>
                <p className="text-xs text-slate-500">{t("home.demoOnline")}</p>
              </div>
              <span className="ml-auto h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            </div>

            <div className="min-h-[265px] space-y-5 py-6">
              <div className="flex justify-end">
                <div
                  key={step}
                  className="demo-message max-w-[88%] rounded-2xl rounded-br-md bg-sky-100 px-4 py-3 text-sm leading-relaxed text-slate-800"
                >
                  {t(`home.demoQuestion${step + 1}`)}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700">
                  ✦
                </div>
                <div
                  key={`a-${step}`}
                  className="demo-message max-w-[90%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3"
                >
                  <p className="mb-2 text-xs font-semibold text-teal-700">
                    {t("home.demoTutor")}
                  </p>
                  <p className="text-sm leading-relaxed">
                    {t(`home.demoAnswer${step + 1}`)}
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
                    {t(`home.demoDetail${step + 1}`)}
                  </div>
                  <div className="mt-3 flex gap-1">
                    <span className="typing-dot" />
                    <span className="typing-dot delay-1" />
                    <span className="typing-dot delay-2" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
              <span className="flex-1">{t("home.demoInput")}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white">
                ↑
              </span>
            </div>

            <div className="mt-5 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === step ? "w-8 bg-teal-500" : "w-2 bg-slate-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA — original teal / sky / indigo palette */}
        <section className="mb-16 rounded-3xl bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 px-6 py-10 text-white sm:px-12 sm:py-14">
          <h2 className="text-3xl font-bold sm:text-4xl">{t("home.ctaTitle")}</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-white/90">
            {t("home.ctaBody")}
          </p>
          <Link
            href="/SignIn"
            className="mt-6 inline-flex rounded-xl bg-white px-6 py-4 font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            {t("home.start")} →
          </Link>
        </section>
      </main>
      </div>
    </div>
  );
}