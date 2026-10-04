"use client";

import { useState, useEffect, Suspense, FormEvent } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import AccountSidebar from "../components/AccountSidebar";
import SiteHeader from "../../components/SiteHeader";
import Toggle from "../components/Toggle";

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

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!passwords.current) errors.current = "กรุณากรอกรหัสผ่านปัจจุบัน";
    if (passwords.next.length < 8) errors.next = "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร";
    if (passwords.next !== passwords.confirm) errors.confirm = "รหัสผ่านใหม่ไม่ตรงกัน";
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSavingPassword(true);
    setTimeout(() => {
      setIsSavingPassword(false);
      setPasswords({ current: "", next: "", confirm: "" });
      showToast("เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!");
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

  // --- Language ---
  const [language, setLanguage] = useState<"th" | "en">("th");

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
            <h3 className="text-lg font-bold text-danger">ยืนยันการลบบัญชี</h3>
            <p className="text-sm text-muted">
              การลบบัญชีไม่สามารถย้อนกลับได้ ข้อมูลการเรียน ประวัติ และไฟล์ทั้งหมดของคุณจะหายไปถาวร
              พิมพ์ <span className="font-semibold text-text">DELETE</span> เพื่อยืนยัน
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
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE"}
                className="rounded-xl bg-danger px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 transition-all"
              >
                ลบบัญชีถาวร
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteHeader
        links={[
          { label: "Create", href: "/Create" },
          { label: "Lessons", href: "/Lessons" },
          { label: "HOME", href: "/Home" },
        ]}
      />

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-2 text-[48px] font-bold tracking-tight whitespace-nowrap">
          Your Account Settings
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
                  <h3 className="text-xl font-bold">Change Password</h3>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-muted">Current Password</label>
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
                    <label className="text-xs font-semibold text-muted">New Password</label>
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
                    <label className="text-xs font-semibold text-muted">Confirm New Password</label>
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
                    {isSavingPassword ? "Saving..." : "Save New Password"}
                  </button>
                </form>
              )}

              {/* Learning Preferences */}
              {activeTab === "Learning Preferences" && (
                <div className="max-w-md flex flex-col gap-8">
                  <h3 className="text-xl font-bold">Learning Preferences</h3>

                  <div>
                    <p className="text-sm font-medium mb-1">Preferred Difficulty</p>
                    <p className="text-xs text-muted mb-3">
                      ปรับความยากของตัวอย่างและแบบฝึกหัดที่ AI สร้างให้
                    </p>
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
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1">Hint Style</p>
                    <p className="text-xs text-muted mb-3">
                      เลือกวิธีที่ AI ช่วยตอนคุณติดขัด
                    </p>
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
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">Daily Study Goal</p>
                      <span className="text-sm font-semibold text-primary">{dailyGoal} min</span>
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
                    onClick={() => showToast("บันทึกการตั้งค่าการเรียนรู้แล้ว!")}
                    className="self-start rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-all cursor-pointer"
                  >
                    Save Preferences
                  </button>
                </div>
              )}

              {/* Notifications */}
              {activeTab === "Notifications" && (
                <div className="max-w-md flex flex-col gap-2">
                  <h3 className="text-xl font-bold mb-2">Notifications</h3>
                  <Toggle
                    label="Email Notifications"
                    description="รับอีเมลแจ้งเตือนทั่วไปจาก LearnlyAI"
                    checked={notifications.email}
                    onChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                  <Toggle
                    label="Lesson Reminders"
                    description="เตือนเมื่อถึงเวลาเรียนตามเป้าหมายรายวัน"
                    checked={notifications.lessonReminders}
                    onChange={(v) => setNotifications({ ...notifications, lessonReminders: v })}
                  />
                  <Toggle
                    label="Weekly Summary"
                    description="สรุปความคืบหน้าการเรียนรายสัปดาห์ทางอีเมล"
                    checked={notifications.weeklySummary}
                    onChange={(v) => setNotifications({ ...notifications, weeklySummary: v })}
                  />
                  <Toggle
                    label="Achievement Alerts"
                    description="แจ้งเตือนเมื่อปลดล็อกความสำเร็จใหม่"
                    checked={notifications.achievements}
                    onChange={(v) => setNotifications({ ...notifications, achievements: v })}
                  />
                </div>
              )}

              {/* Language */}
              {activeTab === "Language" && (
                <div className="max-w-md flex flex-col gap-4">
                  <h3 className="text-xl font-bold">Language</h3>
                  <p className="text-xs text-muted -mt-2">เลือกภาษาที่ใช้แสดงผลในเว็บไซต์</p>
                  <div className="flex flex-col gap-2">
                    {(
                      [
                        { code: "th" as const, label: "ไทย (Thai)" },
                        { code: "en" as const, label: "English" },
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
                  <h3 className="text-xl font-bold mb-1">Privacy & Data Settings</h3>
                  <p className="text-xs text-muted -mt-2 mb-2">ควบคุมการจัดการข้อมูลการเรียนรู้และประวัติแชทกับ AI ของคุณ</p>
                  
                  <Toggle
                    label="AI Training Permission"
                    description="อนุญาตให้นำประวัติบทเรียนและแบบฝึกหัดของคุณไปช่วยพัฒนาโมเดล AI ให้ตอบคำถามฉลาดขึ้น"
                    checked={privacy.aiTraining}
                    onChange={(v) => setPrivacy({ ...privacy, aiTraining: v })}
                  />
                  <Toggle
                    label="Auto-delete Chat History"
                    description="ลบประวัติการสนทนากับ AI โดยอัตโนมัติทุกๆ 24 ชั่วโมงเพื่อความเป็นส่วนตัว"
                    checked={privacy.autoDeleteChat}
                    onChange={(v) => setPrivacy({ ...privacy, autoDeleteChat: v })}
                  />
                  <Toggle
                    label="Save Learning Activity"
                    description="บันทึกประวัติบทเรียน ผลคะแนน และความคืบหน้าการเรียนของคุณในระบบ"
                    checked={privacy.saveHistory}
                    onChange={(v) => setPrivacy({ ...privacy, saveHistory: v })}
                  />
                  
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => showToast("บันทึกการตั้งค่าความเป็นส่วนตัวแล้ว!")}
                      className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-all cursor-pointer"
                    >
                      Save Privacy Settings
                    </button>
                  </div>

                  <div className="mt-4 border-t border-surface-border pt-4">
                    <Link
                      href="/Account/Help?tab=Help%20Center"
                      className="text-sm text-primary hover:underline block"
                    >
                      Read our Privacy Policy & Terms of Service →
                    </Link>
                  </div>
                </div>
              )}

              {/* Delete Account */}
              {activeTab === "Delete Account" && (
                <div className="max-w-md flex flex-col gap-4">
                  <h3 className="text-xl font-bold text-danger">Delete Account</h3>
                  <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
                    <p className="text-sm text-text">
                      การลบบัญชีจะลบข้อมูลทั้งหมดของคุณอย่างถาวร ได้แก่:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted mt-2 space-y-1">
                      <li>ประวัติการสนทนากับ AI และบทเรียนทั้งหมด</li>
                      <li>ไฟล์ที่อัปโหลดไว้</li>
                      <li>ผลการทดสอบและความคืบหน้าการเรียน</li>
                    </ul>
                    <p className="text-sm text-danger font-medium mt-3">
                      การกระทำนี้ไม่สามารถย้อนกลับได้
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="self-start rounded-xl bg-danger px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-all cursor-pointer"
                  >
                    Delete My Account
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