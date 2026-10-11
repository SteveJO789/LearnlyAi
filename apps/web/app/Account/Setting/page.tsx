"use client";

import { useState, useEffect, useRef, Suspense, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar";
import SiteHeader from "../../components/SiteHeader";
import Toggle from "../components/Toggle";
import { useLanguage } from "../../lib/i18n/LanguageContext";

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
    if (tab !== "Delete Account") {
      setMascotPrankActive(false);
      setMascotCrying(false);
      setMascotButtonStolen(false);
      setMascotPrankPlayed(false);
    }
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

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!passwords.current) errors.current = t("settings.changePassword.errorCurrent");
    if (passwords.next.length < 8) errors.next = t("settings.changePassword.errorLength");
    if (passwords.next !== passwords.confirm) errors.confirm = t("settings.changePassword.errorMismatch");
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingPassword(true);
    setTimeout(() => {
      setIsSavingPassword(false);
      setPasswords({ current: "", next: "", confirm: "" });
      showToast(t("settings.toast.passwordChanged"));
    }, 1200);
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
  const [buttonEscapeStep, setButtonEscapeStep] = useState(0);
  const [mascotCrying, setMascotCrying] = useState(false);
  const [mascotPrankPlayed, setMascotPrankPlayed] = useState(false);
  const [mascotTapPending, setMascotTapPending] = useState(false);
  const [mascotPosition, setMascotPosition] = useState<{ left: number; top: number } | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const escapeTimers = useRef<number[]>([]);

  useEffect(() => {
    return () => escapeTimers.current.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (activeTab !== "Delete Account") {
      escapeTimers.current.forEach(window.clearTimeout);
      escapeTimers.current = [];
      setButtonEscapeStep(0);
      setMascotCrying(false);
      setMascotPrankPlayed(false);
    }
  }, [activeTab]);

  const triggerMascotPrank = () => {
    if (mascotPrankPlayed || buttonEscapeStep > 0) return;
    const rect = deleteButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMascotPrankPlayed(true);
    setButtonEscapeStep(1);
  };

  const advanceEscapingButton = () => {
    if (buttonEscapeStep < 1 || buttonEscapeStep >= 5) return;
    const nextStep = buttonEscapeStep + 1;
    setButtonEscapeStep(nextStep);
    if (nextStep === 5) setMascotCrying(true);
  };

  return (
    <div className="min-h-screen bg-transparent text-text relative transition-colors duration-200">
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
                  setMascotPosition(null);
                  setIsDeletingAccount(false);
                }}
                className="rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-muted hover:bg-secondary transition-all"
              >
                {t("settings.deleteConfirm.cancel")}
              </button>
              <button
                ref={confirmDeleteButtonRef}
                type="button"
                disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                onMouseEnter={() => {
                  const rect = confirmDeleteButtonRef.current?.getBoundingClientRect();
                  if (rect) {
                    const mascotWidth = 58;
                    const left = rect.right + mascotWidth + 18 < window.innerWidth
                      ? rect.right + 18
                      : Math.max(8, rect.left - mascotWidth - 18);
                    setMascotPosition({ left, top: Math.max(8, rect.top - 22) });
                  }
                }}
                onClick={() => {
                  // Keep the loading gag separate from the API until the actual endpoint contract is confirmed.
                  setIsDeletingAccount(true);
                }}
                className="rounded-xl bg-danger px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
              >
                {isDeletingAccount ? "กำลังลบ… 💧" : t("settings.deleteConfirm.confirmButton")}
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
              {activeTab === "Change Password" && (
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

                  <div className="relative">
                    <div className="relative inline-flex items-center">
                      <button
                        ref={deleteButtonRef}
                        type="button"
                        onMouseEnter={() => {
                          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                            if (!mascotPrankPlayed) triggerMascotPrank();
                            else advanceEscapingButton();
                          }
                        }}
                        onClick={() => {
                          const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
                          if (canHover && buttonEscapeStep < 5) return;
                          if (!canHover && !mascotPrankPlayed) {
                            triggerMascotPrank();
                            setMascotTapPending(true);
                            escapeTimers.current.push(window.setTimeout(() => {
                              setButtonEscapeStep(5);
                              setMascotCrying(true);
                              setMascotTapPending(false);
                            }, 1000));
                            return;
                          }
                          setDeleteConfirmOpen(true);
                        }}
                        disabled={mascotTapPending}
                        style={buttonEscapeStep > 0 ? {
                          position: "fixed",
                          left: buttonEscapeStep === 1 ? "42vw" : buttonEscapeStep === 2 ? "60vw" : buttonEscapeStep === 3 ? "78vw" : "72vw",
                          top: buttonEscapeStep === 1 ? "76vh" : buttonEscapeStep === 2 ? "70vh" : buttonEscapeStep === 3 ? "84vh" : "24vh",
                          zIndex: 70,
                          transition: "left 1s linear, top 1s linear, transform .15s ease-out",
                          transform: buttonEscapeStep === 5 ? "scale(1.03)" : "scale(1)",
                        } : undefined}
                        className="rounded-xl bg-danger px-6 py-2.5 text-sm font-medium text-white transition-all cursor-pointer disabled:cursor-wait hover:opacity-90"
                      >
                        {t("settings.deleteAccount.button")}
                      </button>
                    </div>

                    {(mascotCrying || mascotPosition || isDeletingAccount) && (
                      <div aria-hidden="true" className={`wizard-emotion fixed z-[80] pointer-events-none ${isDeletingAccount ? "wizard-sad-loading" : ""}`} style={mascotPosition ? { left: mascotPosition.left, top: mascotPosition.top } : { left: "calc(72vw + 170px)", top: "24vh" }}>
                        
                        <div className="tiny-wizard tiny-wizard-crying">
                          <div className="wizard-hat"><i /></div>
                          <div className="wizard-face"><i className="wizard-eye eye-left" /><i className="wizard-eye eye-right" /><i className="wizard-blush blush-left" /><i className="wizard-blush blush-right" /><span className="wizard-mouth" /></div>
                          <span className="wizard-tear-stream tear-left"><i>✦</i><i>✧</i><i>✦</i></span><span className="wizard-tear-stream tear-right"><i>✧</i><i>✦</i><i>✧</i></span>
                          <div className="wizard-beard" />
                          <div className="wizard-body"><i className="wizard-star">✦</i></div>
                          <div className="wizard-feet"><i /><i /></div>
                        </div>
                        {isDeletingAccount && <div className="wizard-sad-caption">ฮือออ… อย่าทิ้งเราเลยนะ 🥺</div>}
                      </div>
                    )}

                    <style jsx>{`
                      .wizard-emotion { width: 100px; animation: sob-breathe 1.6s ease-in-out infinite; }
                      .wizard-sad-caption { position:absolute; top:76px; left:-28px; width:170px; padding:6px 9px; border-radius:10px; background:rgb(30 26 49 / .92); color:#f5dfff; font-size:11px; text-align:center; box-shadow:0 0 16px rgb(197 181 255 / .2); }
                      .wizard-sad-loading { position:fixed !important; left:auto !important; right:24px !important; top:50% !important; z-index:100 !important; }
                      .tiny-wizard {
                        position: relative;
                        width: 112px;
                        height: 164px;
                        transform: scale(.45);
                        transform-origin: top left;
                        filter: drop-shadow(0 8px 8px rgb(77 51 130 / .14));
                      }
                      .wizard-hat { position:absolute; z-index:4; left:2px; top:-26px; width:100px; height:96px; background:linear-gradient(135deg,#9c85ff 5%,#6b55ce 70%,#4d3aab); clip-path:polygon(50% 0,70% 62%,100% 84%,4% 88%,30% 69%); border-radius:15px; }
                      .wizard-hat i { position:absolute; width:7px; height:7px; border-radius:50%; background:#ffe99b; left:62px; top:51px; box-shadow:0 0 8px #fff2b3; }
                      .wizard-face { position:absolute; z-index:3; left:28px; top:39px; width:55px; height:49px; border-radius:46% 46% 48% 48%; background:linear-gradient(145deg,#ffe3c7,#f4b995); }
                      .wizard-eye { position:absolute; top:21px; width:5px; height:7px; background:#49365d; border-radius:50%; transform-origin:center; animation: wizard-blink 4.2s infinite; }
                      .eye-left { left:15px; } .eye-right { right:15px; animation-delay:.08s; }
                      .wizard-mouth { position:absolute; left:23px; top:32px; width:10px; height:5px; border-bottom:2px solid #8e536b; border-radius:0 0 8px 8px; animation: wizard-sob-mouth 1.6s ease-in-out infinite; }
                      @keyframes wizard-blink { 0%,43%,47%,100% { transform:scaleY(1); } 45% { transform:scaleY(.12); } } 
                      @keyframes wizard-sob-mouth { 0%,100% { transform:translateY(0) scaleY(1); } 50% { transform:translateY(2px) scaleY(.7); } }
                      .wizard-blush { position:absolute; top:29px; width:10px; height:5px; border-radius:50%; background:#f28d9e; opacity:.7; }
                      .blush-left { left:6px; } .blush-right { right:6px; }
                      .wizard-tear-stream { position:absolute; z-index:6; top:64px; display:block; width:12px; height:39px; pointer-events:none; }
                      .tear-left { left:40px; }
                      .tear-right { left:71px; }
                      .wizard-tear-stream i { position:absolute; left:0; top:0; display:block; font-style:normal; font-size:9px; line-height:1; color:#ffe99b; text-shadow:0 0 5px #fff4ba, 0 0 10px #bba8ff; opacity:0; animation: star-tears 1.05s ease-in infinite; }
                      .wizard-tear-stream i:nth-child(2) { animation-delay:.35s; left:3px; font-size:7px; }
                      .wizard-tear-stream i:nth-child(3) { animation-delay:.7s; left:-1px; font-size:8px; }
                      .tear-right i { animation-delay:.18s; }
                      .tear-right i:nth-child(2) { animation-delay:.53s; }
                      .tear-right i:nth-child(3) { animation-delay:.88s; }
                      @keyframes star-tears {
                        0% { opacity:0; transform:translate(0,-2px) scale(.45) rotate(-12deg); }
                        12% { opacity:1; transform:translate(-2px,4px) scale(1) rotate(0); }
                        62% { opacity:.95; transform:translate(3px,22px) scale(.82) rotate(24deg); }
                        88% { opacity:.35; transform:translate(7px,32px) scale(.5) rotate(45deg); filter:blur(.4px); }
                        100% { opacity:0; transform:translate(9px,39px) scale(.15) rotate(70deg); filter:blur(1.5px); }
                      }
                      .wizard-beard { position:absolute; z-index:4; left:37px; top:68px; width:37px; height:34px; background:linear-gradient(145deg,#fff8ed,#d9d0e9); clip-path:polygon(0 0,100% 0,80% 65%,50% 100%,20% 65%); border-radius:8px; }
                      .wizard-body { position:absolute; z-index:2; left:22px; top:79px; width:68px; height:65px; border-radius:27px 27px 20px 20px; background:linear-gradient(120deg,#a28bff,#7560d7 72%,#5a48b7); }
                      .wizard-star { position:absolute; top:17px; left:27px; color:#ffe99b; font-style:normal; font-size:14px; }
                      .wizard-feet { position:absolute; z-index:3; left:29px; bottom:7px; display:flex; gap:19px; }
                      .wizard-feet i { width:22px; height:12px; border-radius:50%; background:linear-gradient(180deg,#e7b18e,#bc7e77); }
                      .fairy-crying { animation: cry-in .25s ease-out both; }
                      @keyframes cry-in { from { opacity:0; transform:translateY(8px) scale(.9); } to { opacity:1; transform:translateY(0) scale(1); } }
                      @keyframes sob-breathe { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(3px) scale(1.035,.97); } }
                      @keyframes sparkle-sob { from { opacity:.35; transform:translateY(3px) rotate(-8deg) scale(.85); } to { opacity:1; transform:translateY(-4px) rotate(8deg) scale(1.1); } }
                      @media(prefers-reduced-motion:reduce) { * { transition-duration:1ms !important; animation-duration:1ms !important; } }
                    `}</style>
                  </div>
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