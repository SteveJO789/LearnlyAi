"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import SiteHeader from "../components/SiteHeader";
import CuteLoadingPopup from "../components/CuteLoadingPopup";
import CreateMagicCharacters from "./CreateMagicCharacters";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { createLearningSession, createTextMaterial } from "../../lib/learning-sessions";
import { getCurrentUserProfile, type AppUserProfile } from "../../lib/user-profile";

export default function CreatePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [question, setQuestion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);

  const canStart = question.trim().length > 0 || file !== null;

  useEffect(() => {
    getCurrentUserProfile()
      .then(setProfile)
      .catch(() => router.replace("/SignIn"));
  }, [router]);

  async function handleStart() {
    if (!canStart || isStarting) return;

    if (file) {
      setError(
        "File upload persistence is not connected yet. Remove the file and start with text for now.",
      );
      return;
    }

    const input = question.trim();
    if (!input) return;

    setError(null);
    setIsStarting(true);

    try {
      const session = await createLearningSession({
        title: input.replace(/\s+/g, " ").slice(0, 120),
      });
      await createTextMaterial(session.id, input);
      router.push(`/Assessment/${session.id}?phase=PRE`);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start a learning session.",
      );
      setIsStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-text relative">
      {isStarting && <CuteLoadingPopup message="กำลังสร้างบทเรียน..." detail="กำลังบันทึกข้อมูลและเตรียมห้องเรียนของคุณ 🚀" />}
      <CreateMagicCharacters />
      {/* เลเยอร์ท้องฟ้าการ์ตูน: แสงฟุ้งและดาวลอย */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* กลุ่มแสงฟุ้งเกรเดียนต์เบื้องหลัง */}
        <div className="absolute left-[5%] top-[15%] h-96 w-96 rounded-full bg-pink-400/15 blur-[120px] animate-roam-1" />
        <div className="absolute right-[10%] top-[35%] h-[420px] w-[420px] rounded-full bg-violet-400/15 blur-[120px] animate-roam-2" />
        <div className="absolute left-[25%] bottom-[15%] h-80 w-80 rounded-full bg-sky-400/15 blur-[110px] animate-roam-3" />
        
        {/* {ดาวดวงเล็ก (ชุดเดิม) - เลเยอร์หลัง z-10} */}
        <div className="absolute left-[12%] top-[22%] text-pink-400 text-sm animate-dreamy z-10">✦</div>
        <div className="absolute left-[28%] top-[12%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3s' }}>✦</div>
        <div className="absolute left-[45%] top-[28%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute right-[22%] top-[18%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '2s' }}>✦</div>
        <div className="absolute right-[12%] top-[32%] text-violet-400 text-sm animate-dreamy z-10" style={{ animationDelay: '7s' }}>✦</div>
        
        <div className="absolute left-[8%] top-[55%] text-sky-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '4s' }}>✦</div>
        <div className="absolute left-[22%] top-[75%] text-pink-400 text-sm animate-dreamy z-10" style={{ animationDelay: '6s' }}>✦</div>
        <div className="absolute right-[30%] top-[65%] text-violet-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '1s' }}>✦</div>
        <div className="absolute right-[15%] top-[78%] text-sky-400 text-sm animate-dreamy z-10" style={{ animationDelay: '8s' }}>✦</div>
        <div className="absolute left-[38%] bottom-[18%] text-pink-400 text-xs animate-dreamy-slow z-10" style={{ animationDelay: '3.5s' }}>✦</div>
      </div>

      {/* {ดาวดวงใหญ่ขึ้น (ใหม่) - เลเยอร์หน้า z-20} */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        <div className="absolute left-[20%] top-[15%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '10s' }}>✦</div>
        <div className="absolute right-[25%] top-[45%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '5s' }}>✦</div>
        <div className="absolute left-[15%] bottom-[30%] text-sky-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '15s' }}>✦</div>
        <div className="absolute right-[15%] bottom-[20%] text-pink-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '20s' }}>✦</div>
        <div className="absolute left-[50%] top-[80%] text-violet-400 text-xl animate-dreamy-slowest" style={{ animationDelay: '25s' }}>✦</div>
      </div>

      <SiteHeader
        links={[
          { labelKey: "nav.account", href: "/Account/Profile" },
          { labelKey: "nav.home", href: "/Home" },
          { labelKey: "nav.create", href: "/Create#learning-input" },
        ]}
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24 relative z-10">
        <div
          className="hello-gradient pointer-events-none max-w-full break-words bg-clip-text text-2xl font-medium leading-tight tracking-tight text-transparent sm:text-3xl lg:text-4xl"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            backgroundSize: "180% 180%",
            backgroundPosition: "0% 50%",
          }}
        >
          {t("home.greeting")} <span className="inline-block max-w-full break-words">{profile?.displayName ?? "..."}</span>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => router.push("/Lessons")}
            className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface/80 px-4 py-2 text-sm font-medium text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            <span aria-hidden="true">←</span>
            {t("nav.lessons")}
          </button>
        </div>

        <div className="mx-auto mt-8 w-full max-w-3xl px-2 text-center sm:px-4">
          <div className="flex justify-center w-full">
            <h1 
              className="whitespace-nowrap font-bold tracking-tight text-center"
              style={{ fontSize: '46px', lineHeight: '1.2' }}
            >
              {t("create.title")}
            </h1>
          </div>
          <p className="mt-3 text-muted">{t("create.subtitle")}</p>
        </div>

        <div id="learning-input" className="mt-10 max-w-xl mx-auto flex scroll-mt-8 flex-col items-center gap-5">
          <div className="w-full">
            <p className="mb-1.5 text-xs font-semibold text-muted">{t("create.textAreaLabel")}</p>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={6}
              placeholder={t("create.placeholder")}
              className="w-full resize-none rounded-2xl border border-surface-border bg-surface p-5 text-sm outline-none focus:border-primary placeholder:text-muted"
            />
          </div>

          <span className="text-sm text-muted">{t("create.or")}</span>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-full border border-surface-border bg-surface py-4 text-sm text-muted hover:border-primary transition-colors cursor-pointer"
          >
            {file ? `📎 ${file.name}` : t("create.uploadPlaceholder")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setError(null);
                }}
                className="-mt-3 text-xs text-muted hover:text-danger self-end"
              >
                {t("create.removeFile")}
              </button>
              <p className="text-xs text-muted">
                File upload is visible in the UI but is not persisted yet.
              </p>
            </>
          )}

          {error && (
            <p className="w-full rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || isStarting}
            className={`w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer ${canStart && !isStarting ? "motion-safe:animate-bounce shadow-lg shadow-primary/25 ring-2 ring-primary/20" : ""}`}
          >
            {isStarting ? t("create.starting") : t("create.start")}
          </button>
        </div>
      </main>
    </div>
  );
}