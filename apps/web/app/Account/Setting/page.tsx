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
  const [mascotPrankActive, setMascotPrankActive] = useState(false);
  const [mascotCrying, setMascotCrying] = useState(false);
  const [mascotButtonStolen, setMascotButtonStolen] = useState(false);
  const [mascotPrankPlayed, setMascotPrankPlayed] = useState(false);
  const [mascotTapPending, setMascotTapPending] = useState(false);
  const [mascotStart, setMascotStart] = useState({ x: 0, y: 0, buttonWidth: 0 });
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTab !== "Delete Account") {
      setMascotPrankActive(false);
      setMascotCrying(false);
      setMascotButtonStolen(false);
      setMascotPrankPlayed(false);
    }
  }, [activeTab]);

  const triggerMascotPrank = () => {
    if (mascotPrankActive || mascotPrankPlayed) return;
    const rect = deleteButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setMascotStart({ x: rect.left, y: rect.top, buttonWidth: rect.width });
    }
    setMascotCrying(false);
    setMascotButtonStolen(false);
    setMascotPrankPlayed(true);
    setMascotPrankActive(true);
    // Match the button swap to the moment the wizard reaches its original position.
    const isTouch = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const duration = isTouch ? 1800 : 2600;
    window.setTimeout(() => setMascotButtonStolen(true), duration * 0.08);
    window.setTimeout(() => {
      setMascotPrankActive(false);
      setMascotButtonStolen(false);
      setMascotCrying(true);
    }, duration);
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
                        type="button"
                        onMouseEnter={() => {
                          if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) triggerMascotPrank();
                        }}
                        onClick={() => {
                          const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
                          if (canHover) {
                            if (!mascotPrankActive) setDeleteConfirmOpen(true);
                            return;
                          }
                          if (mascotTapPending) return;
                          setMascotTapPending(true);
                          triggerMascotPrank();
                          window.setTimeout(() => {
                            setDeleteConfirmOpen(true);
                            setMascotTapPending(false);
                          }, 550);
                        }}
                        disabled={mascotTapPending || mascotButtonStolen}
                        aria-hidden={mascotButtonStolen}
                        tabIndex={mascotButtonStolen ? -1 : 0}
                        className={`rounded-xl bg-danger px-6 py-2.5 text-sm font-medium text-white transition-all cursor-pointer disabled:cursor-wait ${mascotButtonStolen ? "invisible pointer-events-none" : "visible hover:opacity-90"}` }
                      >
                        {t("settings.deleteAccount.button")}
                      </button>
                    </div>

                    {(mascotPrankActive || mascotCrying) && (
                      <div aria-hidden="true" className="fixed inset-0 z-[60] overflow-hidden pointer-events-none" style={{ "--start-x": `${mascotStart.x}px`, "--start-y": `${mascotStart.y}px`, "--return-x": `${mascotStart.x - 120}px`, "--cry-x": `${mascotStart.x + mascotStart.buttonWidth + 10}px`, "--cry-y": `${mascotStart.y + 4}px`, "--prank-duration": `${window.matchMedia("(hover: hover) and (pointer: fine)").matches ? 2600 : 1800}ms` } as React.CSSProperties}>
                        {mascotPrankActive && <div className="fairy-runner">
                          <div className="tiny-wizard">
                            <div className="wizard-wand"><i /></div>
                            <div className="wizard-hat"><i /></div>
                            <div className="wizard-face"><i className="wizard-eye eye-left" /><i className="wizard-eye eye-right" /><i className="wizard-blush blush-left" /><i className="wizard-blush blush-right" /></div>
                            <div className="wizard-beard" />
                            <div className="wizard-body"><i className="wizard-star">✦</i></div>
                            <div className="wizard-feet"><i /><i /></div>
                            <div className="wizard-shadow" />
                          </div>
                          <span className="carried-delete-button">{t("settings.deleteAccount.button")}</span>
                        </div>}
                        {mascotCrying && <div className="fairy-crying">
                          <div className="tiny-wizard tiny-wizard-crying">
                            <div className="wizard-hat"><i /></div>
                            <div className="wizard-face"><i className="wizard-eye eye-left" /><i className="wizard-eye eye-right" /><i className="wizard-blush blush-left" /><i className="wizard-blush blush-right" /><span className="wizard-tears">••</span></div>
                            <div className="wizard-beard" />
                            <div className="wizard-body"><i className="wizard-star">✦</i></div>
                            <div className="wizard-feet"><i /><i /></div>
                          </div>
                        </div>}
                      </div>
                    )}

                    <style jsx>{`
                      .fairy-runner {
                        position: absolute;
                        left: 0;
                        top: 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        width: max-content;
                        animation: fairy-lap var(--prank-duration, 2600ms) linear both;
                        will-change: transform, opacity;
                      }
                      .fairy-runner::after {
                        content: "✦ ･ﾟ✧ ･ﾟ✦";
                        position: absolute;
                        left: -34px;
                        top: 30px;
                        color: #ffe99b;
                        font-size: 22px;
                        letter-spacing: 5px;
                        text-shadow: 0 0 8px #fff2b3, 0 0 16px #c5b5ff;
                        pointer-events: none;
                        animation: sparkle-trail .42s ease-out infinite;
                      }
                      .fairy-runner::before {
                        content: "✧ ･ﾟ";
                        position: absolute;
                        left: -52px;
                        top: 62px;
                        color: #d8ceff;
                        font-size: 18px;
                        text-shadow: 0 0 10px #fff;
                        animation: sparkle-trail .65s ease-out infinite .15s;
                      }
                      @keyframes sparkle-trail {
                        0% { opacity: 0; transform: translateX(12px) scale(.5); }
                        35% { opacity: 1; }
                        100% { opacity: 0; transform: translateX(-18px) scale(1.25); }
                      }
                      .carried-delete-button {
                        display: inline-flex;
                        align-items: center;
                        white-space: nowrap;
                        border-radius: .75rem;
                        background: var(--danger, #dc2626);
                        color: white;
                        padding: .625rem 1.5rem;
                        font-size: .875rem;
                        line-height: 1.25rem;
                        font-weight: 500;
                        box-sizing: border-box;
                        opacity: 0;
                        animation: carried-button var(--prank-duration, 2600ms) linear both;
                      }
                      @keyframes carried-button {
                        0%, 7.9% { opacity: 0; }
                        8%, 91.9% { opacity: 1; }
                        92%, 100% { opacity: 0; }
                      }
                      .tiny-wizard {
                        position: relative;
                        flex: 0 0 112px;
                        width: 112px;
                        height: 164px;
                        transform: scale(.58);
                        transform-origin: bottom center;
                        filter: drop-shadow(0 8px 8px rgb(77 51 130 / .14));
                        margin-bottom: -55px;
                      }
                      .wizard-hat { position:absolute; z-index:4; left:2px; top:-26px; width:100px; height:96px; background:linear-gradient(135deg,#9c85ff 5%,#6b55ce 70%,#4d3aab); clip-path:polygon(50% 0,70% 62%,100% 84%,4% 88%,30% 69%); border-radius:15px; filter:drop-shadow(2px 4px 2px rgb(54 39 117 / .22)); }
                      .wizard-hat i { position:absolute; width:7px; height:7px; border-radius:50%; background:#ffe99b; left:62px; top:51px; box-shadow:0 0 8px #fff2b3; }
                      .wizard-face { position:absolute; z-index:3; left:28px; top:39px; width:55px; height:49px; border-radius:46% 46% 48% 48%; background:linear-gradient(145deg,#ffe3c7,#f4b995); box-shadow:inset -4px -4px 0 rgb(197 116 100 / .12); }
                      .wizard-eye { position:absolute; top:21px; width:5px; height:7px; background:#49365d; border-radius:50%; }
                      .eye-left { left:15px; } .eye-right { right:15px; }
                      .wizard-blush { position:absolute; top:29px; width:10px; height:5px; border-radius:50%; background:#f28d9e; opacity:.7; }
                      .blush-left { left:6px; } .blush-right { right:6px; }
                      .wizard-tears { position:absolute; color:#58b9ff; top:25px; left:12px; letter-spacing:13px; font-size:12px; }
                      .wizard-beard { position:absolute; z-index:4; left:37px; top:68px; width:37px; height:34px; background:linear-gradient(145deg,#fff8ed,#d9d0e9); clip-path:polygon(0 0,100% 0,80% 65%,50% 100%,20% 65%); border-radius:8px; }
                      .wizard-body { position:absolute; z-index:2; left:22px; top:79px; width:68px; height:65px; border-radius:27px 27px 20px 20px; background:linear-gradient(120deg,#a28bff,#7560d7 72%,#5a48b7); box-shadow:inset 7px 2px 0 rgb(255 255 255 / .18),inset -6px -4px 0 rgb(54 38 124 / .12); }
                      .wizard-star { position:absolute; top:17px; left:27px; color:#ffe99b; font-style:normal; font-size:14px; }
                      .wizard-wand { position:absolute; z-index:5; right:0; top:55px; width:5px; height:45px; border-radius:5px; background:linear-gradient(90deg,#bd8c54,#ffe2a0); transform:rotate(25deg); }
                      .wizard-wand i { position:absolute; top:-8px; left:-5px; width:15px; height:15px; background:#fff0a8; clip-path:polygon(50% 0,62% 35%,100% 50%,62% 65%,50% 100%,38% 65%,0 50%,38% 35%); }
                      .wizard-feet { position:absolute; z-index:3; left:29px; bottom:7px; display:flex; gap:19px; }
                      .wizard-feet i { width:22px; height:12px; border-radius:50%; background:linear-gradient(180deg,#e7b18e,#bc7e77); }
                      .wizard-shadow { position:absolute; bottom:0; left:15%; width:70%; height:10px; border-radius:50%; background:rgb(78 61 130 / .13); filter:blur(4px); }
                      .fairy-crying { position:absolute; display:flex; align-items:center; left:var(--cry-x); top:var(--cry-y); opacity:0; animation:fairy-cry .35s ease-out both; }
                      .tiny-wizard-crying { transform:scale(.45); transform-origin:top left; margin:0; }
                      @keyframes fairy-lap {
                        0% { transform:translate(calc(var(--start-x) - 150px), var(--start-y)) rotate(0); opacity:0; }
                        2% { transform:translate(calc(var(--start-x) - 110px), var(--start-y)) rotate(-7deg); opacity:1; }
                        8% { transform:translate(var(--return-x), var(--start-y)) rotate(0); opacity:1; }
                        20% { transform:translate(78vw, 8vh) rotate(12deg); }
                        32% { transform:translate(87vw, 72vh) rotate(-10deg); }
                        44% { transform:translate(52vw, 84vh) rotate(9deg); }
                        56% { transform:translate(3vw, 72vh) rotate(-12deg); }
                        66% { transform:translate(7vw, 12vh) rotate(10deg); }
                        76% { transform:translate(76vw, 25vh) rotate(-8deg); }
                        84% { transform:translate(56vw, 49vh) rotate(8deg); }
                        92% { transform:translate(var(--return-x), var(--start-y)) rotate(-3deg); opacity:1; }
                        96% { transform:translate(var(--return-x), calc(var(--start-y) - 12px)) rotate(0); opacity:1; }
                        98% { transform:translate(var(--return-x), var(--start-y)) rotate(0); opacity:1; }
                        100% { transform:translate(var(--return-x), var(--start-y)) rotate(0); opacity:0; }
                      }
                      @keyframes fairy-cry {
                        0% { opacity:0; transform:translateY(10px); }
                        100% { opacity:1; transform:translateY(0); }
                      }
                      @media(max-width:767px) {
                        .fairy-runner { animation:fairy-walk var(--prank-duration, 1800ms) linear both; }
                        .fairy-runner .tiny-wizard { transform:scale(.42); }
                        .carried-delete-button { display:none; animation:none; }\n                        .fairy-runner::before, .fairy-runner::after { font-size:16px; }
                        @keyframes fairy-walk {
                          0% { transform:translate(calc(var(--start-x) - 150px), var(--start-y)); opacity:0; }
                          8% { transform:translate(var(--return-x), var(--start-y)); opacity:1; }
                          48% { transform:translate(43vw, 49vh); }
                          90% { transform:translate(var(--return-x), var(--start-y)); opacity:1; }
                          96%,100% { transform:translate(var(--return-x), var(--start-y)); opacity:0; }
                        }
                        .fairy-crying { left:var(--cry-x); top:var(--cry-y); }
                      }
                      @media(prefers-reduced-motion:reduce) {
                        .fairy-runner { animation-duration:1ms; }
                        .fairy-crying { animation-duration:1ms; opacity:1; }
                      }
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