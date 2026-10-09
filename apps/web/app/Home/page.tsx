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
  const items = [
    ["home.feature1Title", "home.feature1Body", "✦", "bg-pink-100 text-pink-700"],
    ["home.feature2Title", "home.feature2Body", "◎", "bg-violet-100 text-violet-700"],
    ["home.feature3Title", "home.feature3Body", "↗", "bg-sky-100 text-sky-700"]
  ] as const;

  return (
    <>
      <section className="border-y border-surface-border py-10 sm:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">{t("home.featuresEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t("home.featuresTitle")}</h2>
          <p className="mt-3 leading-relaxed text-muted sm:text-lg">{t("home.featuresIntro")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map(([title, body, icon, tone]) => (
            <article key={title} className="rounded-2xl border border-surface-border bg-surface p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <div className={`mb-5 grid h-12 w-12 place-items-center rounded-2xl text-2xl ${tone}`}>{icon}</div>
              <h3 className="text-xl font-semibold">{t(title)}</h3>
              <p className="mt-2 leading-relaxed text-muted">{t(body)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="mb-8 rounded-3xl hello-gradient bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500 px-6 py-10 text-white sm:px-12 sm:py-14 shadow-xl">
        <h2 className="text-3xl font-bold sm:text-4xl">{t("home.ctaTitle")}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-white/90">{t("home.ctaBody")}</p>
        <Link href="/Create" className="mt-6 inline-flex rounded-xl bg-white px-6 py-4 font-semibold text-slate-900 transition hover:opacity-90">{t("home.start")} →</Link>
      </section>
    </>
  );
}

function HomeDemo({ t }: { t: (key: string) => string }) {
 const [step, setStep] = useState(0);
 useEffect(() => { 
   const timer = window.setInterval(() => setStep((n) => (n + 1) % 3), 4200); 
   return () => window.clearInterval(timer); 
 }, []);

 return (
   <section className="grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
     <div>
       <p className="text-sm font-bold uppercase tracking-[0.16em] text-primary">{t("home.demoEyebrow")}</p>
       <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t("home.demoTitle")}</h2>
       <p className="mt-4 leading-relaxed text-muted sm:text-lg">{t("home.demoIntro")}</p>
       <ol className="mt-6 space-y-3">
         {[1, 2, 3].map((n) => (
           <li key={n} className="flex items-start gap-3 rounded-xl p-3">
             <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
             <span className="pt-1 font-medium">{t(`home.demoStep${n}`)}</span>
           </li>
         ))}
       </ol>
     </div>
     <div className="chat-demo relative overflow-hidden rounded-[28px] border border-surface-border bg-surface p-4 shadow-xl sm:p-7">
       <div className="absolute inset-x-0 top-0 h-1.5 hello-gradient bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500"/>
       <div className="flex items-center gap-3 border-b border-surface-border pb-4">
         <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-100 text-xl text-pink-700">✦</div>
         <div>
           <p className="font-semibold">LearnlyAI</p>
           <p className="text-xs text-muted">{t("home.demoOnline")}</p>
         </div>
         <span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-400"/>
       </div>
       <div className="min-h-[265px] space-y-5 py-6">
         <div className="flex justify-end">
           <div key={step} className="demo-message max-w-[88%] rounded-2xl rounded-br-md bg-pink-100 px-4 py-3 text-sm leading-relaxed text-slate-800">{t(`home.demoQuestion${step + 1}`)}</div>
         </div>
         <div className="flex items-start gap-3">
           <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pink-100 text-pink-700">✦</div>
           <div key={`answer-${step}`} className="demo-message max-w-[90%] rounded-2xl rounded-tl-md border border-surface-border bg-background px-4 py-3">
             <p className="mb-2 text-xs font-semibold text-primary">{t("home.demoTutor")}</p>
             <p className="text-sm leading-relaxed">{t(`home.demoAnswer${step + 1}`)}</p>
             <div className="mt-3 rounded-lg bg-surface p-3 text-xs leading-relaxed text-muted">{t(`home.demoDetail${step + 1}`)}</div>
             <div className="mt-3 flex gap-1">
               <span className="typing-dot"/><span className="typing-dot delay-1"/><span className="typing-dot delay-2"/>
             </div>
           </div>
         </div>
       </div>
       <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-background px-4 py-3 text-sm text-muted">
         <span className="flex-1">{t("home.demoInput")}</span>
         <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">↑</span>
       </div>
       <div className="mt-5 flex justify-center gap-2">
         {[0, 1, 2].map((i) => (
           <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-2 bg-surface-border"}`}/>
         ))}
       </div>
     </div>
   </section>
 );
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
    <div className="min-h-screen bg-background text-text relative">
      {/* เลเยอร์ท้องฟ้าการ์ตูน: แสงฟุ้งและดาวลอย (สโลว์โมชันแบบหน้า Create - อยู่หลังสุด z-0) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden min-h-full">
        {/* กลุ่มแสงฟุ้งเกรเดียนต์เบื้องหลัง */}
        <div className="absolute left-[5%] top-[5%] h-96 w-96 rounded-full bg-pink-400/15 blur-[120px] animate-roam-1" />
        <div className="absolute right-[10%] top-[20%] h-[420px] w-[420px] rounded-full bg-violet-400/15 blur-[120px] animate-roam-2" />
        <div className="absolute left-[25%] top-[35%] h-80 w-80 rounded-full bg-sky-400/15 blur-[110px] animate-roam-3" />
        <div className="absolute right-[5%] top-[50%] h-96 w-96 rounded-full bg-pink-400/15 blur-[120px] animate-roam-1" style={{ animationDelay: '5s' }} />
        <div className="absolute left-[15%] top-[65%] h-[420px] w-[420px] rounded-full bg-violet-400/15 blur-[120px] animate-roam-2" style={{ animationDelay: '3s' }} />
        <div className="absolute right-[30%] top-[80%] h-80 w-80 rounded-full bg-sky-400/15 blur-[110px] animate-roam-3" style={{ animationDelay: '7s' }} />
        
        {/* ดาวดวงเล็ก - กระจายทั่วจอ z-10 */}
        <div className="absolute left-[12%] top-[22%] text-pink-400 text-sm animate-dreamy z-10">✦</div>
        <div className="absolute left-[28%] top-[12%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3s' }}>✦</div>
        <div className="absolute left-[45%] top-[28%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute right-[22%] top-[18%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '2s' }}>✦</div>
        <div className="absolute right-[12%] top-[32%] text-violet-400 text-sm animate-dreamy z-10" style={{ animationDelay: '7s' }}>✦</div>
        
        <div className="absolute left-[8%] top-[55%] text-sky-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '4s' }}>✦</div>
        <div className="absolute left-[22%] top-[75%] text-pink-400 text-sm animate-dreamy z-10" style={{ animationDelay: '6s' }}>✦</div>
        <div className="absolute right-[30%] top-[65%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '1s' }}>✦</div>
        <div className="absolute right-[15%] top-[78%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '8s' }}>✦</div>
        <div className="absolute left-[38%] top-[48%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3.5s' }}>✦</div>

        <div className="absolute left-[10%] top-[88%] text-pink-400 text-sm animate-dreamy z-10" style={{ animationDelay: '9s' }}>✦</div>
        <div className="absolute right-[20%] top-[92%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '6s' }}>✦</div>
      </div>

      {/* ดาวดวงใหญ่ - เลเยอร์หน้า z-20 */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden min-h-full">
        <div className="absolute left-[20%] top-[15%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '10s' }}>✦</div>
        <div className="absolute right-[25%] top-[45%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute left-[15%] top-[30%] text-sky-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '15s' }}>✦</div>
        <div className="absolute right-[15%] top-[20%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '20s' }}>✦</div>
        <div className="absolute left-[50%] top-[80%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '25s' }}>✦</div>
        <div className="absolute left-[60%] top-[95%] text-sky-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '12s' }}>✦</div>
        <div className="absolute right-[40%] top-[60%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '18s' }}>✦</div>
      </div>

      <SiteHeader
        logoHref="/Home"
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
        ]}
        showAccountMenu
      />

      <main className="px-5 sm:px-12 lg:px-20 relative z-10">
        <section className="relative grid items-center gap-6 pb-12 pt-8 sm:pb-16 lg:min-h-[500px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-4">
          <div className="relative z-10 min-w-0 pt-2 lg:pt-0">
            <div className="hello-gradient mb-5 max-w-full break-words bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500 bg-clip-text text-left text-2xl font-semibold leading-tight tracking-tight text-transparent sm:text-3xl lg:text-4xl">
              {t("home.greeting")} <span className="inline-block max-w-full break-words">{profile?.displayName ?? "..."}</span>
            </div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-700 dark:bg-pink-950/50 dark:text-pink-200">
              ✦ {t("home.eyebrow")}
            </div>
            <h1 className="max-w-[12ch] text-5xl font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {t("home.welcome")}{" "}
              <span className="hello-gradient bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500 bg-clip-text text-transparent">
                LearnlyAI
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl lg:text-2xl">{t("home.tagline")}</p>
            <Link href="/Create" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground shadow-lg transition hover:-translate-y-0.5 hover:opacity-95">
              {t("home.start")} →
            </Link>
          </div>
          
          <div className="relative mx-auto aspect-square w-full max-w-[440px]">
            <div className="absolute inset-[8%] rounded-full bg-gradient-to-br from-pink-100 via-violet-50 to-sky-100 shadow-inner"/>
            <div className="absolute left-[8%] top-[24%] grid h-14 w-16 place-items-center rounded-2xl bg-white text-2xl shadow-lg">✦</div>
            <div className="absolute right-[7%] top-[25%] rounded-2xl bg-white px-4 py-3 shadow-lg">
              <div className="flex h-8 items-end gap-1.5">
                <span className="h-3 w-2 rounded-t bg-pink-300"/><span className="h-5 w-2 rounded-t bg-violet-400"/><span className="h-8 w-2 rounded-t bg-sky-500"/>
              </div>
            </div>
            <div className="absolute left-1/2 top-[13%] h-[51%] w-[51%] -translate-x-1/2 rounded-[38%] border-[10px] border-violet-200 bg-gradient-to-br from-white to-slate-100 shadow-xl">
              <div className="absolute -left-5 top-[28%] h-14 w-5 rounded-l-full bg-violet-400"/>
              <div className="absolute -right-5 top-[28%] h-14 w-5 rounded-r-full bg-violet-400"/>
              <div className="absolute inset-[11%] rounded-[35%] bg-gradient-to-br from-slate-900 to-indigo-950">
                <div className="absolute left-[24%] top-[38%] h-4 w-5 rounded-full bg-pink-300 shadow-[0_0_14px_#f472b6]"/>
                <div className="absolute right-[24%] top-[38%] h-4 w-5 rounded-full bg-pink-300 shadow-[0_0_14px_#f472b6]"/>
                <div className="absolute bottom-[23%] left-1/2 h-3 w-8 -translate-x-1/2 rounded-b-full border-b-[4px] border-pink-300"/>
              </div>
            </div>
            <div className="absolute bottom-[21%] left-[19%] h-[13%] w-[62%] -rotate-2 rounded-xl border-b-8 border-violet-300 hello-gradient bg-gradient-to-r from-pink-500 via-violet-500 to-sky-500 shadow-lg"/>
            <div className="absolute bottom-[34%] left-[25%] h-[12%] w-[50%] rounded-lg border-b-4 border-slate-300 bg-white shadow-md"/>
            <div className="absolute bottom-[31%] left-[31%] h-[19%] w-[38%] rounded-t-md bg-gradient-to-br from-violet-600 to-indigo-950 p-2 shadow-xl"/>
            <div className="absolute bottom-[15%] right-[5%] h-[15%] w-[27%] -rotate-6 rounded-lg border border-slate-300 bg-gradient-to-br from-slate-100 to-slate-400 p-1.5 shadow-lg"><div className="grid h-full place-items-center text-xl font-bold text-slate-500">AI</div></div>
            <div className="absolute bottom-[15%] left-[6%] text-4xl">🌱</div>
            <div className="absolute left-[21%] top-[8%] text-3xl text-amber-400">☀</div>
          </div>
        </section>
        <HomeFeatures t={t} />
        <HomeDemo t={t} />
      </main>
    </div>
  );
}