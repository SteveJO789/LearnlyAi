"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import SiteHeader from "../components/SiteHeader";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { createLearningSession } from "../../lib/learning-sessions";
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

      const params = new URLSearchParams({ input });
      router.push(`/Chat/${session.id}?${params.toString()}`);
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
    <div className="min-h-screen bg-background text-text">
      <SiteHeader
        links={[
          { labelKey: "nav.account", href: "/Account/Profile" },
          { labelKey: "nav.home", href: "/Home" },
          { labelKey: "nav.create", href: "/Create" },
        ]}
      />

      <main className="px-5 sm:px-12 lg:px-20 pb-24">
        <div
          className="hello-gradient pointer-events-none bg-clip-text text-4xl font-medium tracking-tight text-transparent"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
            backgroundSize: "180% 180%",
            backgroundPosition: "0% 50%",
          }}
        >
          {t("home.greeting")} <span>{profile?.displayName ?? "..."}</span>
        </div>

        <div className="mt-8 w-full max-w-xl sm:max-w-2xl mx-auto text-center px-4">
  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl whitespace-nowrap">{t("create.title")}</h1>
  <p className="mt-3 text-muted">{t("create.subtitle")}</p>
</div>

        <div className="mt-10 max-w-xl mx-auto flex flex-col items-center gap-5">
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
            className="w-full rounded-full bg-primary py-3.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all cursor-pointer"
          >
            {isStarting ? t("create.starting") : t("create.start")}
          </button>
        </div>
      </main>
    </div>
  );
}
