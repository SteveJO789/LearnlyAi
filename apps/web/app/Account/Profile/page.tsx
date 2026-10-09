"use client";

import { useState, useEffect, ChangeEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import SiteHeader from "../../components/SiteHeader";
import { useLanguage } from "../../lib/i18n/LanguageContext";
import {
  getCurrentUserThemePreferences,
  syncCurrentUserProfile,
  updateCurrentUserProfile,
  updateCurrentUserThemePreferences,
  type ColorTheme,
} from "../../../lib/user-profile";

type ProfileTabType = "Personal Info" | "Theme";

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

function ProfileContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ProfileTabType | null;

  const [activeTab, setActiveTab] = useState<ProfileTabType>(
    tabParam === "Theme" ? "Theme" : "Personal Info"
  );

  useEffect(() => {
    if (tabParam === "Personal Info" || tabParam === "Theme") {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabName: ProfileTabType) => {
    setActiveTab(tabName);
    router.push(`/Account/Profile?tab=${encodeURIComponent(tabName)}`, { scroll: false });
  };

  const { theme, setTheme } = useTheme();
  const [colorTheme, setColorTheme] = useState<ColorTheme>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let active = true;

    const loadThemePreferences = async () => {
      try {
        const preferences = await getCurrentUserThemePreferences();
        if (!active) return;

        setTheme(preferences.appearanceMode);
        setColorTheme(preferences.colorTheme);
        localStorage.setItem("app-color-theme", preferences.colorTheme);
      } catch {
        if (!active) return;

        const savedColorTheme = localStorage.getItem("app-color-theme");
        if (
          savedColorTheme === "default" ||
          savedColorTheme === "theme-ruby" ||
          savedColorTheme === "theme-peach" ||
          savedColorTheme === "theme-sky" ||
          savedColorTheme === "theme-gold" ||
          savedColorTheme === "theme-slate" ||
          savedColorTheme === "theme-teal"
        ) {
          setColorTheme(savedColorTheme);
        }
      }
    };

    setMounted(true);
    void loadThemePreferences();

    return () => {
      active = false;
    };
  }, [setTheme]);

  const persistThemePreferences = async (
    nextAppearanceMode: "light" | "dark",
    nextColorTheme: ColorTheme,
  ) => {
    await updateCurrentUserThemePreferences({
      appearanceMode: nextAppearanceMode,
      colorTheme: nextColorTheme,
    });
  };

  const currentAppearanceMode =
    theme === "dark" ? "dark" : "light";

  const handleAppearanceModeChange = async (
    nextAppearanceMode: "light" | "dark",
  ) => {
    document.documentElement.classList.add("theme-transition");
    setTheme(nextAppearanceMode);

    try {
      await persistThemePreferences(nextAppearanceMode, colorTheme);
    } catch {
      // Keep the UI change even if account preference persistence fails.
    }
  };

  const handleColorThemeChange = async (nextColorTheme: ColorTheme) => {
    setColorTheme(nextColorTheme);
    localStorage.setItem("app-color-theme", nextColorTheme);

    try {
      await persistThemePreferences(currentAppearanceMode, nextColorTheme);
    } catch {
      // Keep the UI change even if account preference persistence fails.
    }

    window.dispatchEvent(new Event("color-theme-changed"));
  };

  const [initialUserInfo, setInitialUserInfo] = useState<UserProfile>({
    name: "",
    email: "",
    phone: "",
    avatarUrl: null,
  });

  const [userInfo, setUserInfo] = useState<UserProfile>(initialUserInfo);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    syncCurrentUserProfile()
      .then((profile) => {
        if (!active) return;
        const nextUserInfo: UserProfile = {
          name: profile.displayName,
          email: profile.email ?? "",
          phone: "",
          avatarUrl: profile.avatarUrl,
        };
        setInitialUserInfo(nextUserInfo);
        setUserInfo(nextUserInfo);
      })
      .catch(() => {
        if (active) router.replace("/SignIn");
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
      e.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarFailed(false);
        setAvatarPreview(reader.result);
      }
    };
    reader.onerror = () => alert("อ่านไฟล์รูปภาพไม่สำเร็จ กรุณาลองใหม่");
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!userInfo.name.trim()) newErrors.name = "กรุณากรอกชื่อ-นามสกุล";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userInfo.email.trim()) {
      newErrors.email = "กรุณากรอกอีเมล";
    } else if (!emailRegex.test(userInfo.email)) {
      newErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
    }
    if (userInfo.phone.trim() && !/^[+0-9\s-]{9,15}$/.test(userInfo.phone)) {
      newErrors.phone = "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    setToastMessage(null);

    try {
      const saved = await updateCurrentUserProfile({
        displayName: userInfo.name,
        ...(avatarPreview ? { avatarUrl: avatarPreview } : {}),
      });

      const nextUserInfo: UserProfile = {
        ...userInfo,
        name: saved.displayName,
        email: saved.email ?? userInfo.email,
        avatarUrl: saved.avatarUrl,
      };

      setAvatarPreview(null);
      setAvatarFailed(false);
      setUserInfo(nextUserInfo);
      setInitialUserInfo(nextUserInfo);
      setToastMessage("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage("ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setUserInfo(initialUserInfo);
    setAvatarPreview(null);
    setAvatarFailed(false);
    setErrors({});
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background text-text transition-colors duration-200">
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
          {/* Left Sidebar Menu */}
          {/* Left Sidebar Menu */}
          <aside className="w-64 rounded-2xl border border-surface-border p-5 flex flex-col gap-6 text-sm bg-surface shrink-0">
            <div>
              <button
                onClick={() => handleTabChange("Personal Info")}
                className="w-full font-bold mb-3 text-center py-1.5 rounded-lg transition-all cursor-pointer bg-primary text-primary-foreground"
              >
                {t("sidebar.personalInfo")}
              </button>
              <ul className="space-y-2 px-2 text-center">
                {(["Personal Info", "Theme"] as ProfileTabType[]).map((tab) => (
                  <li key={tab}>
                    <button
                      onClick={() => handleTabChange(tab)}
                      className={`w-full text-center py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                        activeTab === tab
                          ? "bg-secondary text-text font-semibold"
                          : "text-muted hover:text-text"
                      }`}
                    >
                      {tab === "Personal Info" ? t("sidebar.personalInfo") : t("sidebar.theme")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* History Section */}
            <div>
              <Link
                href="/Account/History"
                className="block w-full font-semibold text-muted mb-3 text-center bg-secondary py-1.5 rounded-lg hover:text-text transition-colors"
              >
                {t("nav.history")}
              </Link>
              <ul className="space-y-2 px-2 text-center">
                <li>
                  <Link href="/Account/History?tab=Chat" className="block py-1 text-muted hover:text-text transition-colors">
                    {t("sidebar.chat")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/History?tab=Lessons" className="block py-1 text-muted hover:text-text transition-colors">
                    {t("nav.lessons")}
                  </Link>
                </li>
                <li>
                  <Link href={`/Account/History?tab=${encodeURIComponent("Uploaded Files")}`} className="block py-1 text-muted hover:text-text transition-colors">
                    {t("sidebar.uploadedFiles")}
                  </Link>
                </li>
                <li>
                  <Link href={`/Account/History?tab=${encodeURIComponent("Test Results")}`} className="block py-1 text-muted hover:text-text transition-colors">
                    {t("sidebar.testResults")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Setting Section */}
            <div>
              <Link
                href="/Account/Setting"
                className="block font-semibold text-muted mb-3 text-center bg-secondary py-1.5 rounded-lg hover:text-text transition-colors"
              >
                {t("sidebar.setting")}
              </Link>
              <ul className="space-y-3 text-muted px-2 text-center">
                <li>
                  <Link href="/Account/Setting?tab=Change%20Password" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.changePassword")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Setting?tab=Learning%20Preferences" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.learningPreferences")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Setting?tab=Notifications" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.notifications")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Setting?tab=Language" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.language")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Setting?tab=Privacy" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.privacy")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Setting?tab=Delete%20Account" className="block py-1 text-muted hover:text-danger transition-colors">
                    {t("sidebar.deleteAccount")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Help & Support Section */}
            <div>
              <Link
                href="/Account/Help"
                className="block font-semibold text-muted mb-3 text-center bg-secondary py-1.5 rounded-lg hover:text-text transition-colors"
              >
                {t("sidebar.helpAndSupport")}
              </Link>
              <ul className="space-y-3 text-muted px-2 text-center">
                <li>
                  <Link href="/Account/Help?tab=Help%20Center" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.helpCenterFaq")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Help?tab=Report%20a%20Problem" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.reportProblem")}
                  </Link>
                </li>
                <li>
                  <Link href="/Account/Help?tab=Contact%20Us" className="block py-1 hover:text-text transition-colors">
                    {t("sidebar.contactUs")}
                  </Link>
                </li>
              </ul>
            </div>
          </aside>

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            <div className="h-[42px]" />

            <div className="rounded-2xl border border-surface-border p-8 min-h-[650px] bg-surface flex flex-col justify-start relative">

              {/* Toast Notification */}
              {toastMessage && (
                <div className="absolute top-4 right-8 bg-primary text-primary-foreground text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all animate-bounce">
                  ✓ {toastMessage}
                </div>
              )}

              {/* Sub-tab 1: Personal Info */}
              {activeTab === "Personal Info" && (
                <div className="max-w-xl flex flex-col gap-6">
                  <h3 className="text-xl font-bold">{t("sidebar.personalInfo")}</h3>

                  <div className="flex items-center gap-6 pb-4 border-b border-surface-border">
                    <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-text overflow-hidden border border-surface-border shrink-0">
                      {(avatarPreview || userInfo.avatarUrl) && !avatarFailed ? (
                        <img
                          src={avatarPreview ?? userInfo.avatarUrl ?? ""}
                          alt=""
                          onError={() => setAvatarFailed(true)}
                          className="block h-full w-full object-cover"
                        />
                      ) : (
                        userInfo.name.charAt(0) || "U"
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer inline-block px-4 py-2 text-sm font-medium border border-surface-border rounded-xl hover:bg-secondary transition-colors">
                        {t("settings.profile.changePhoto")}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-muted mt-1.5">{t("settings.profile.photoHint")}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted">{t("settings.profile.fullName")}</label>
                      <input
                        type="text"
                        value={userInfo.name}
                        onChange={(e) => {
                          setUserInfo({ ...userInfo, name: e.target.value });
                          if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                          errors.name ? "border-danger focus:border-danger" : "border-surface-border focus:border-primary"
                        }`}
                      />
                      {errors.name && <p className="text-xs text-danger mt-0.5">{errors.name}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted">{t("settings.profile.emailAddress")}</label>
                      <input
                        type="email"
                        value={userInfo.email}
                        readOnly
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent opacity-70 transition-all ${
                          errors.email ? "border-danger focus:border-danger" : "border-surface-border focus:border-primary"
                        }`}
                      />
                      {errors.email && <p className="text-xs text-danger mt-0.5">{errors.email}</p>}
                      <p className="text-[11px] text-muted">{t("settings.profile.emailManaged")}</p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted">{t("settings.profile.phoneNumber")}</label>
                      <input
                        type="text"
                        value={userInfo.phone}
                        placeholder={t("settings.profile.notConnected")}
                        disabled
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                          errors.phone ? "border-danger focus:border-danger" : "border-surface-border focus:border-primary"
                        }`}
                      />
                      {errors.phone && <p className="text-xs text-danger mt-0.5">{errors.phone}</p>}
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                            <span>{t("settings.profile.saving")}</span>
                          </>
                        ) : (
                          t("settings.profile.saveChanges")
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="rounded-xl border border-surface-border px-6 py-2.5 text-sm font-medium text-muted hover:bg-secondary transition-all cursor-pointer disabled:opacity-50"
                      >
                        {t("settings.profile.cancel")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Theme */}
              {activeTab === "Theme" && (
                <div className="max-w-xl flex flex-col gap-8">
                  <div>
                    <h3 className="text-xl font-bold">{t("settings.theme.appearanceTitle")}</h3>
                    <p className="text-sm text-muted mt-1">{t("settings.theme.appearanceDesc")}</p>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {[
                        { id: "light", label: t("settings.theme.lightMode") },
                        { id: "dark", label: t("settings.theme.darkMode") },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => void handleAppearanceModeChange(item.id as "light" | "dark")}
                          className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-3 ${
                            currentAppearanceMode === item.id
                              ? "border-primary bg-secondary font-semibold"
                              : "border-surface-border hover:border-primary/60"
                          }`}
                        >
                          <div
                            className={`w-full h-20 rounded-xl border ${
                              item.id === "dark"
                                ? "bg-neutral-900 border-neutral-800"
                                : item.id === "light"
                                ? "bg-white border-neutral-200"
                                : "bg-white border-neutral-200"
                            }`}
                          />
                          <span className="text-xs">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-surface-border pt-6">
                    <h3 className="text-xl font-bold">{t("settings.theme.brandColorTitle")}</h3>
                    <p className="text-sm text-muted mt-1">{t("settings.theme.brandColorDesc")}</p>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {[
                        { id: "default", label: t("settings.theme.default"), colorBg: "bg-gradient-to-br from-white via-neutral-300 to-neutral-900" },
                        { id: "theme-teal", label: t("settings.theme.tealModern"), colorBg: "bg-[#0AD1C1]" },
                        { id: "theme-peach", label: t("settings.theme.softPeach"), colorBg: "bg-[#FFAAAA]" },
                        { id: "theme-gold", label: t("settings.theme.goldenAmber"), colorBg: "bg-[#FFC06F]" },
                        { id: "theme-sky", label: t("settings.theme.skyBreeze"), colorBg: "bg-[#BCE8FF]" },
                        { id: "theme-ruby", label: t("settings.theme.rubyBurgundy"), colorBg: "bg-[#911005]" },
                        { id: "settings.theme.slateBlue", label: t("settings.theme.slateBlue"), colorBg: "bg-[#375572]" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleColorThemeChange(item.id as ColorTheme)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
                            colorTheme === item.id
                              ? "border-primary bg-secondary font-semibold"
                              : "border-surface-border hover:border-primary/60"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full shrink-0 border border-surface-border ${item.colorBg}`} />
                          <div>
                            <span className="text-sm block">{item.label}</span>
                            <span className="text-[11px] text-muted font-normal">{t("settings.theme.activePalette")}</span>
                          </div>
                        </button>
                      ))}
                    </div>
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

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ProfileContent />
    </Suspense>
  );
}