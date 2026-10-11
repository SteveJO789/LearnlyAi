"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar";
import SiteHeader from "../../components/SiteHeader";
import Toggle from "../components/Toggle";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import { getSupabaseClient } from "../../../lib/supabase";

type SettingTabType =
  | "Change Password"
  | "Learning Preferences"
  | "Notifications"
  | "Language"
  | "Privacy"
  | "Delete Account";

const TABS: SettingTabType[] = [
  "Change Password",
  "Learning Preferences",
  "Notifications",
  "Language",
  "Privacy",
  "Delete Account",
];

function SettingContent() {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingTabType | null;

  const [activeTab, setActiveTab] = useState<SettingTabType>(
    tabParam && TABS.includes(tabParam) ? tabParam : "Change Password"
  );

  useEffect(() => {
    if (tabParam && TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab: SettingTabType) => {
    setActiveTab(tab);
    router.push(`/Account/Setting?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  // --- Change Password ---
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // null = ยังเช็คไม่เสร็จ, true = login ด้วย Google อย่างเดียว (ไม่มี password ผูกอยู่)
  const [isGoogleOnlyUser, setIsGoogleOnlyUser] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      const providers = data.user?.identities?.map((identity) => identity.provider) ?? [];
      setIsGoogleOnlyUser(providers.length > 0 && !providers.includes("email"));
    });
  }, []);

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!passwords.current) errors.current = t("settings.changePassword.errorCurrent");
    if (passwords.next.length < 8) errors.next = t("settings.changePassword.errorLength");
    if (passwords.next !== passwords.confirm) errors.confirm = t("settings.changePassword.errorMismatch");
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingPassword(true);

    const supabase = getSupabaseClient();

    // Supabase updateUser ไม่เช็ค current password ให้อัตโนมัติ ต้องยืนยันเองก่อน
    // ด้วยการลอง sign in ซ้ำด้วย current password ที่ user กรอกมา
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;

    if (email) {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: passwords.current,
      });

      if (reauthError) {
        setIsSavingPassword(false);
        setPasswordErrors({ current: t("settings.changePassword.errorCurrentWrong") });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: passwords.next });

    setIsSavingPassword(false);

    if (error) {
      setPasswordErrors({ next: error.message });
      return;
    }

    setPasswords({ current: "", next: "", confirm: "" });
    showToast(t("settings.toast.passwordChanged"));
  };

  // --- Learning Preferences ---
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [hintStyle, setHintStyle] = useState<"Guided Questions" | "Direct Answers">(
    "Guided Questions"
  );
  const [dailyGoal, setDailyGoal] = useState(20);

  // --- Notifications ---
  const [notifications, setNotifications] = useState({
    email: true,
    lessonReminders: true,
    weeklySummary: false,
    achievements: true,
  });

  // --- Privacy (Updated for EdTech / AI Platform) ---
  const [privacy, setPrivacy] = useState({
    aiTraining: true,
    autoDeleteChat: false,
    saveHistory: true,
  });

  // --- Delete Account ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  return (
    <div className="min-h-screen bg-background text-text relative transition-colors duration-200">
      {/* Delete Account confirmation modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-danger">{t("settings.deleteConfirm.title")}</h3>
            <p className="text-sm text-muted">
              {t("settings.deleteConfirm.body")}{" "}
              <span className="font-semibold text-text">DELETE</span> {t("settings.deleteConfirm.bodyEnd")}
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="rounded-xl border border-surface-border bg-transparent p-3 text-sm outline-none focus:border-danger"
            />
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-muted hover:bg-secondary transition-all"
              >
                {t("settings.deleteConfirm.cancel")}
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE"}
                className="rounded-xl bg-danger px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
              >
                {t("settings.deleteConfirm.confirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteHeader
        links={[
          { labelKey: "nav.create", href: "/Create" },
          { labelKey: "nav.lessons", href: "/Lessons" },
          { labelKey: "nav.home", href: "/Home" },
        ]}
      />

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-2 text-[48px] font-bold tracking-tight whitespace-nowrap">
          {t("settings.pageTitle")}
        </h1>
        <div className="h-4" />

        <div className="flex gap-8 items-start">
          <AccountSidebar activeSection="Setting" activeTab={activeTab} />

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            <div className="h-[42px]" />

            <div className="rounded-2xl border border-surface-border p-8 min-h-[650px] bg-surface flex flex-col justify-start relative">
              {toastMessage && (
                <div className="absolute top-4 right-8 bg-primary text-primary-foreground text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all animate-bounce">
                  ✓ {toastMessage}
                </div>
              )}

              {/* Change Password */}
              {activeTab === "Change Password" && isGoogleOnlyUser === null && (
                <p className="text-sm text-muted">{t("settings.changePassword.checking")}</p>
              )}

              {activeTab === "Change Password" && isGoogleOnlyUser === true && (
                <div className="max-w-md flex flex-col gap-3">
                  <h3 className="text-xl font-bold">{t("settings.changePassword.title")}</h3>
                  <p className="text-sm text-muted">{t("settings.changePassword.googleOnlyNotice")}</p>
                </div>
              )}

              {activeTab === "Change Password" && isGoogleOnlyUser === false && (
                <form onSubmit={handlePasswordSubmit} className="max-w-md flex flex-col gap-5">
                  <h3 className="text-xl font-bold">{t("settings.changePassword.title")}</h3>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted">{t("settings.changePassword.current")}</label>
                    <input
                      type="password"
                      value={passwords.current}
                      onChange={(e) => {
                        setPasswords({ ...passwords, current: e.target.value });
                        if (passwordErrors.current) setPasswordErrors({ ...passwordErrors, current: "" });
                      }}
                      className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                        passwordErrors.current ? "border-danger" : "border-surface-border focus:border-primary"
                      }`}
                    />
                    {passwordErrors.current && (
                      <p className="text-xs text-danger mt-0.5">{passwordErrors.current}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted">{t("settings.changePassword.new")}</label>
                    <input
                      type="password"
                      value={passwords.next}
                      onChange={(e) => {
                        setPasswords({ ...passwords, next: e.target.value });
                        if (passwordErrors.next) setPasswordErrors({ ...passwordErrors, next: "" });
                      }}
                      className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                        passwordErrors.next ? "border-danger" : "border-surface-border focus:border-primary"
                      }`}
                    />
                    {passwordErrors.next && (
                      <p className="text-xs text-danger mt-0.5">{passwordErrors.next}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted">{t("settings.changePassword.confirm")}</label>
                    <input
                      type="password"
                      value={passwords.confirm}
                      onChange={(e) => {
                        setPasswords({ ...passwords, confirm: e.target.value });
                        if (passwordErrors.confirm) setPasswordErrors({ ...passwordErrors, confirm: "" });
                      }}
                      className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                        passwordErrors.confirm ? "border-danger" : "border-surface-border focus:border-primary"
                      }`}
                    />
                    {passwordErrors.confirm && (
                      <p className="text-xs text-danger mt-0.5">{passwordErrors.confirm}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isSavingPassword ? t("settings.changePassword.saving") : t("settings.changePassword.save")}
                  </button>
                </form>
              )}

              {/* Learning Preferences */}
              {activeTab === "Learning Preferences" && (
                <div className="max-w-md flex flex-col gap-8">
                  <h3 className="text-xl font-bold">{t("settings.learningPreferences.title")}</h3>

                  <div>
                    <p className="text-sm font-medium mb-1">{t("settings.learningPreferences.difficultyLabel")}</p>
                    <p className="text-xs text-muted mb-3">{t("settings.learningPreferences.difficultyDesc")}</p>
                    <div className="flex gap-2">
                      {(["Easy", "Medium", "Hard"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setDifficulty(level)}
                          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all cursor-pointer ${
                            difficulty === level
                              ? "border-primary bg-secondary font-semibold"
                              : "border-surface-border hover:border-primary/60"
                          }`}
                        >
                          {t(`settings.learningPreferences.${level.toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">{t("settings.learningPreferences.hintStyleLabel")}</p>
                    <p className="text-xs text-muted mb-3">{t("settings.learningPreferences.hintStyleDesc")}</p>
                    <div className="flex flex-col gap-2">
                      {(["Guided Questions", "Direct Answers"] as const).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setHintStyle(style)}
                          className={`rounded-xl border py-2.5 px-4 text-sm text-left font-medium transition-all cursor-pointer ${
                            hintStyle === style
                              ? "border-primary bg-secondary font-semibold"
                              : "border-surface-border hover:border-primary/60"
                          }`}
                        >
                          {style === "Guided Questions" ? t("settings.learningPreferences.guidedQuestions") : t("settings.learningPreferences.directAnswers")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{t("settings.learningPreferences.dailyGoalLabel")}</p>
                      <span className="text-sm font-semibold text-primary">{dailyGoal} {t("settings.learningPreferences.minUnit")}</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={dailyGoal}
                      onChange={(e) => setDailyGoal(Number(e.target.value))}
                      className="w-full accent-[var(--primary)]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => showToast(t("settings.toast.preferencesSaved"))}
                    className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("settings.learningPreferences.save")}
                  </button>
                </div>
              )}

              {/* Notifications */}
              {activeTab === "Notifications" && (
                <div className="max-w-md flex flex-col gap-2">
                  <h3 className="text-xl font-bold mb-2">{t("settings.notifications.title")}</h3>
                  <Toggle
                    label={t("settings.notifications.email.label")}
                    description={t("settings.notifications.email.description")}
                    checked={notifications.email}
                    onChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                  <Toggle
                    label={t("settings.notifications.lessonReminders.label")}
                    description={t("settings.notifications.lessonReminders.description")}
                    checked={notifications.lessonReminders}
                    onChange={(v) => setNotifications({ ...notifications, lessonReminders: v })}
                  />
                  <Toggle
                    label={t("settings.notifications.weeklySummary.label")}
                    description={t("settings.notifications.weeklySummary.description")}
                    checked={notifications.weeklySummary}
                    onChange={(v) => setNotifications({ ...notifications, weeklySummary: v })}
                  />
                  <Toggle
                    label={t("settings.notifications.achievements.label")}
                    description={t("settings.notifications.achievements.description")}
                    checked={notifications.achievements}
                    onChange={(v) => setNotifications({ ...notifications, achievements: v })}
                  />
                </div>
              )}

              {/* Language */}
              {activeTab === "Language" && (
                <div className="max-w-md flex flex-col gap-4">
                  <h3 className="text-xl font-bold">{t("settings.language.title")}</h3>
                  <p className="text-xs text-muted -mt-2">{t("settings.language.description")}</p>
                  <div className="flex flex-col gap-2">
                    {(
                      [
                        { code: "th" as const, label: t("settings.language.thai") },
                        { code: "en" as const, label: t("settings.language.english") },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setLanguage(opt.code)}
                        className={`rounded-xl border py-2.5 px-4 text-sm text-left font-medium transition-all cursor-pointer ${
                          language === opt.code
                            ? "border-primary bg-secondary font-semibold"
                            : "border-surface-border hover:border-primary/60"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy (Updated) */}
              {activeTab === "Privacy" && (
                <div className="max-w-md flex flex-col gap-3">
                  <h3 className="text-xl font-bold mb-1">{t("settings.privacy.title")}</h3>
                  <p className="text-xs text-muted -mt-2 mb-2">{t("settings.privacy.description")}</p>
                  
                  <Toggle
                    label={t("settings.privacy.aiTraining.label")}
                    description={t("settings.privacy.aiTraining.description")}
                    checked={privacy.aiTraining}
                    onChange={(v) => setPrivacy({ ...privacy, aiTraining: v })}
                  />
                  <Toggle
                    label={t("settings.privacy.autoDelete.label")}
                    description={t("settings.privacy.autoDelete.description")}
                    checked={privacy.autoDeleteChat}
                    onChange={(v) => setPrivacy({ ...privacy, autoDeleteChat: v })}
                  />
                  <Toggle
                    label={t("settings.privacy.saveActivity.label")}
                    description={t("settings.privacy.saveActivity.description")}
                    checked={privacy.saveHistory}
                    onChange={(v) => setPrivacy({ ...privacy, saveHistory: v })}
                  />
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => showToast(t("settings.toast.privacySaved"))}
                      className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-all cursor-pointer"
                    >
                      {t("settings.privacy.save")}
                    </button>
                  </div>

                  <div className="mt-4 border-t border-surface-border pt-4">
                    <Link
                      href="/Account/Help?tab=Help%20Center"
                      className="text-sm text-primary hover:underline block"
                    >
                      {t("settings.privacy.policyLink")}
                    </Link>
                  </div>
                </div>
              )}

              {/* Delete Account */}
              {activeTab === "Delete Account" && (
                <div className="max-w-md flex flex-col gap-4">
                  <h3 className="text-xl font-bold text-danger">{t("settings.deleteAccount.title")}</h3>
                  <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
                    <p className="text-sm text-text">{t("settings.deleteAccount.warning")}</p>
                    <ul className="list-disc list-inside text-sm text-muted mt-2 space-y-1">
                      <li>{t("settings.deleteAccount.item1")}</li>
                      <li>{t("settings.deleteAccount.item2")}</li>
                      <li>{t("settings.deleteAccount.item3")}</li>
                    </ul>
                    <p className="text-sm text-danger font-medium mt-3">{t("settings.deleteAccount.irreversible")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="self-start rounded-xl bg-danger px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-all cursor-pointer"
                  >
                    {t("settings.deleteAccount.button")}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function SettingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SettingContent />
    </Suspense>
  );
}