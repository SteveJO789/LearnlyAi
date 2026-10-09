"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./style.css";

import SiteHeader from "../components/SiteHeader";
import { useLanguage } from "../lib/i18n/LanguageContext";
import {
  getCurrentUserProfile,
  type AppUserProfile,
} from "../../lib/user-profile";

function HomeFeatures({ t }: { t: (key: string) => string }) {
  const items = [["home.feature1Title","home.feature1Body","✦","bg-teal-100 text-teal-700"],["home.feature2Title","home.feature2Body","◎","bg-blue-100 text-blue-700"],["home.feature3Title","home.feature3Body","↗","bg-violet-100 text-violet-700"]] as const;
  return <><section className="border-y border-surface-border py-10 sm:py-12"><div className="mb-8 max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">{t("home.featuresEyebrow")}</p><h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("home.featuresTitle")}</h2><p className="mt-3 leading-relaxed text-muted sm:text-lg">{t("home.featuresIntro")}</p></div><div className="grid gap-4 md:grid-cols-3">{items.map(([title,body,icon,tone])=><article key={title} className="rounded-2xl border border-surface-border bg-surface p-6 transition hover:-translate-y-1 hover:shadow-lg"><div className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl text-2xl ${tone}`}>{icon}</div><h3 className="text-xl font-semibold">{t(title)}</h3><p className="mt-2 leading-relaxed text-muted">{t(body)}</p></article>)}</div></section><section className="mb-8 rounded-3xl bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 px-6 py-10 text-white sm:px-12 sm:py-14"><h2 className="text-3xl font-bold sm:text-4xl">{t("home.ctaTitle")}</h2><p className="mt-3 max-w-2xl leading-relaxed text-white/90">{t("home.ctaBody")}</p><Link href="/Create" className="mt-6 inline-flex rounded-xl bg-white px-6 py-4 font-semibold text-slate-900">{t("home.start")} →</Link></section></>;
}
function HomeDemo({ t }: { t: (key: string) => string }) {
 const [step,setStep] = useState(0);
 useEffect(() => { const timer=window.setInterval(()=>setStep((n)=>(n+1)%3),4200); return ()=>window.clearInterval(timer); }, []);
 return <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">{t("home.demoEyebrow")}</p><h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("home.demoTitle")}</h2><p className="mt-4 leading-relaxed text-muted sm:text-lg">{t("home.demoIntro")}</p><ol className="mt-6 space-y-3">{[1,2,3].map((n)=><li key={n} className="flex items-start gap-3 rounded-xl p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span><span className="pt-1 font-medium">{t(`home.demoStep${n}`)}</span></li>)}</ol></div><div className="chat-demo relative overflow-hidden rounded-[28px] border border-surface-border bg-surface p-4 shadow-xl sm:p-7"><div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-400 via-sky-500 to-violet-500"/><div className="flex items-center gap-3 border-b border-surface-border pb-4"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-100 text-xl">✦</div><div><p className="font-semibold">LearnlyAI</p><p className="text-xs text-muted">{t("home.demoOnline")}</p></div><span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400"/></div><div className="min-h-[265px] space-y-5 py-6"><div className="flex justify-end"><div key={step} className="demo-message max-w-[88%] rounded-2xl rounded-br-md bg-sky-100 px-4 py-3 text-sm leading-relaxed text-slate-800">{t(`home.demoQuestion${step+1}`)}</div></div><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-100 text-teal-700">✦</div><div key={`answer-${step}`} className="demo-message max-w-[90%] rounded-2xl rounded-tl-md border border-surface-border bg-background px-4 py-3"><p className="mb-2 text-xs font-semibold text-primary">{t("home.demoTutor")}</p><p className="text-sm leading-relaxed">{t(`home.demoAnswer${step+1}`)}</p><div className="mt-3 rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted">{t(`home.demoDetail${step+1}`)}</div><div className="mt-3 flex gap-1"><span className="typing-dot"/><span className="typing-dot delay-1"/><span className="typing-dot delay-2"/></div></div></div></div><div className="flex items-center gap-3 rounded-xl border border-surface-border bg-background px-4 py-3 text-sm text-muted"><span className="flex-1">{t("home.demoInput")}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">↑</span></div><div className="mt-5 flex justify-center gap-2">{[0,1,2].map(i=><span key={i} className={`h-1.5 rounded-full transition-all ${i===step?"w-8 bg-primary":"w-2 bg-surface-border"}`}/>)}</div></div></section>;
}
export default function HomePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [profile, setProfile] = useState<AppUserProfile | null>(null);

  useEffect(() => {
    let active = true;

    getCurrentUserProfile()
      .then((currentProfile) => {
        if (!active) return;

        if (!currentProfile) {
          router.replace("/SignIn");
          return;
        }

        setProfile(currentProfile);
      })
      .catch(() => {
        if (active) {
          router.replace("/SignIn");
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background text-text">
      <SiteHeader
        logoHref="/Home"
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
        ]}
        showAccountMenu
      />

      <main className="px-5 sm:px-12 lg:px-20">
        <section className="relative grid items-center gap-6 pb-12 pt-8 sm:pb-16 lg:min-h-[500px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
          <div className="absolute right-0 top-1 hidden sm:block"><div className="hello-gradient bg-clip-text text-right text-3xl font-semibold leading-relaxed tracking-tight text-transparent lg:text-4xl">{t("home.greeting")} <span>{profile?.displayName ?? "..."}</span></div></div>
          <div className="relative z-10 pt-8 lg:pt-0"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 dark:bg-teal-950/50 dark:text-teal-200">✦ {t("home.eyebrow")}</div><h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">{t("home.welcome")} <span className="bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 bg-clip-text text-transparent">LearnlyAI</span></h1><p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl lg:text-2xl">{t("home.tagline")}</p><Link href="/Create" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:opacity-90">{t("home.start")} →</Link></div>
          <div className="relative mx-auto aspect-square w-full max-w-[440px]"><div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-teal-100 via-sky-50 to-violet-100"/><div className="absolute left-[8%] top-[24%] grid h-14 w-16 place-items-center rounded-2xl bg-white text-2xl shadow-lg">✦</div><div className="absolute right-[7%] top-[25%] rounded-2xl bg-white px-4 py-3 shadow-lg"><div className="flex h-8 items-end gap-1.5"><span className="h-3 w-2 rounded-t bg-teal-300"/><span className="h-5 w-2 rounded-t bg-teal-400"/><span className="h-8 w-2 rounded-t bg-teal-500"/></div></div><div className="absolute left-1/2 top-[13%] h-[51%] w-[51%] -translate-x-1/2 rounded-[38%] border-[10px] border-sky-200 bg-gradient-to-br from-white to-slate-100 shadow-xl"><div className="absolute -left-5 top-[28%] h-14 w-5 rounded-l-full bg-teal-400"/><div className="absolute -right-5 top-[28%] h-14 w-5 rounded-r-full bg-teal-400"/><div className="absolute inset-[11%] rounded-[35%] bg-gradient-to-br from-slate-900 to-blue-950"><div className="absolute left-[24%] top-[38%] h-4 w-5 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]"/><div className="absolute right-[24%] top-[38%] h-4 w-5 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]"/><div className="absolute bottom-[23%] left-1/2 h-3 w-8 -translate-x-1/2 rounded-b-full border-b-[4px] border-cyan-300"/></div></div><div className="absolute bottom-[21%] left-[19%] h-[13%] w-[62%] -rotate-2 rounded-xl border-b-8 border-sky-300 bg-gradient-to-r from-blue-600 via-sky-500 to-teal-400 shadow-lg"/><div className="absolute bottom-[34%] left-[25%] h-[12%] w-[50%] rounded-lg border-b-4 border-slate-300 bg-white shadow-md"/><div className="absolute bottom-[31%] left-[31%] h-[19%] w-[38%] rounded-t-md bg-gradient-to-br from-blue-600 to-blue-900 p-2 shadow-xl"/><div className="absolute bottom-[15%] right-[5%] h-[15%] w-[27%] -rotate-6 rounded-lg border border-slate-300 bg-gradient-to-br from-slate-100 to-slate-400 p-1.5 shadow-lg"><div className="grid h-full place-items-center text-xl font-bold text-slate-500">AI</div></div><div className="absolute bottom-[15%] left-[6%] text-4xl">🌱</div><div className="absolute left-[21%] top-[8%] text-3xl text-amber-400">☀</div></div>
        </section>
        <HomeFeatures t={t} />
        <HomeDemo t={t} />
      </main>
    </div>
  );
}