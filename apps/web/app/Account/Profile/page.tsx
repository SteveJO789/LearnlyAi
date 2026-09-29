"use client";

import { useState, useEffect, ChangeEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";

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
  const [colorTheme, setColorTheme] = useState<string>("default");
  const [mounted, setMounted] = useState(false);

  const applyColorThemeClass = (themeName: string) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("theme-ruby", "theme-peach", "theme-gold", "theme-sky", "theme-slate");
    if (themeName !== "default") {
      root.classList.add(themeName);
    }
  };

  useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("app-color-theme") || "default";
    setColorTheme(savedColorTheme);
    applyColorThemeClass(savedColorTheme);
  }, []);

  const handleColorThemeChange = (themeName: string) => {
    setColorTheme(themeName);
    localStorage.setItem("app-color-theme", themeName);
    applyColorThemeClass(themeName);
    window.dispatchEvent(new Event("color-theme-changed"));
  };

  const [initialUserInfo, setInitialUserInfo] = useState<UserProfile>({
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+66 81 234 5678",
    avatarUrl: null,
  });

  const [userInfo, setUserInfo] = useState<UserProfile>(initialUserInfo);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 5MB");
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
    }
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

  const handleSave = () => {
    if (!validateForm()) return;
    setIsSaving(true);
    setToastMessage(null);

    setTimeout(() => {
      setIsSaving(false);
      setInitialUserInfo(userInfo);
      setToastMessage("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว!");
      setTimeout(() => setToastMessage(null), 3000);
    }, 1500);
  };

  const handleCancel = () => {
    setUserInfo(initialUserInfo);
    setAvatarPreview(null);
    setErrors({});
  };

  if (!mounted) {
    return <div className="min-h-screen bg-white dark:bg-neutral-900" />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          LOGO
        </Link>
        <div className="flex gap-4">
          <Link href="/Create" className="rounded-xl bg-black dark:bg-white dark:text-black px-6 py-2.5 text-sm font-medium text-white">
            Create
          </Link>
          <Link href="/Lessons" className="rounded-xl bg-black dark:bg-white dark:text-black px-6 py-2.5 text-sm font-medium text-white">
            Lessons
          </Link>
          <Link href="/Home" className="rounded-xl bg-black dark:bg-white dark:text-black px-6 py-2.5 text-sm font-medium text-white">
            HOME
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-10 py-4 max-w-[1400px] mx-auto">
        <h1 className="mb-2 text-[48px] font-bold tracking-tight text-black dark:text-white whitespace-nowrap">
          Your Account Settings
        </h1>
        <div className="h-4" />

        <div className="flex gap-8 items-start">
          {/* Left Sidebar Menu */}
          <aside className="w-64 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-6 text-sm bg-white dark:bg-neutral-900 shrink-0">
            <div>
              <button
                onClick={() => handleTabChange("Personal Info")}
                className="w-full font-bold mb-3 text-center py-1.5 rounded-lg transition-all cursor-pointer bg-black text-white dark:bg-white dark:text-black"
              >
                Profile
              </button>
              <ul className="space-y-2 px-2 text-center">
                {(["Personal Info", "Theme"] as ProfileTabType[]).map((tab) => (
                  <li key={tab}>
                    <button
                      onClick={() => handleTabChange(tab)}
                      className={`w-full text-center py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                        activeTab === tab
                          ? "bg-neutral-100 text-black font-semibold dark:bg-neutral-800 dark:text-white"
                          : "text-neutral-500 hover:text-black dark:hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* History Section */}
            <div>
              <Link
                href="/Account/History"
                className="block w-full font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 py-1.5 rounded-lg hover:text-black dark:hover:text-white transition-colors"
              >
                History
              </Link>
              <ul className="space-y-2 px-2 text-center">
                <li>
                  <Link href="/Account/History?tab=Chat" className="block py-1 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                    Chat
                  </Link>
                </li>
                <li>
                  <Link href="/Account/History?tab=Lessons" className="block py-1 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                    Lessons
                  </Link>
                </li>
                <li>
                  <Link href={`/Account/History?tab=${encodeURIComponent("Uploaded Files")}`} className="block py-1 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                    Uploaded Files
                  </Link>
                </li>
                <li>
                  <Link href={`/Account/History?tab=${encodeURIComponent("Test Results")}`} className="block py-1 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors">
                    Test Results
                  </Link>
                </li>
              </ul>
            </div>

            {/* Setting Section */}
            <div>
              <p className="font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 py-1.5 rounded-lg">
                Setting
              </p>
              <ul className="space-y-3 text-neutral-600 dark:text-neutral-400 px-2 text-center">
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Change Password</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Learning Preferences</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Notifications</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Language</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Privacy</li>
                <li className="cursor-pointer text-neutral-600 dark:text-neutral-400 hover:text-red-500">Delete Account</li>
              </ul>
            </div>

            {/* Help & Support Section */}
            <div>
              <p className="font-semibold text-neutral-500 mb-3 text-center bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300 py-1.5 rounded-lg">
                Help & Support
              </p>
              <ul className="space-y-3 text-neutral-600 dark:text-neutral-400 px-2 text-center">
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Help Center / FAQ</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Report a Problem</li>
                <li className="cursor-pointer hover:text-black dark:hover:text-white">Contact Us</li>
              </ul>
            </div>
          </aside>

          {/* Right Main Display Panel */}
          <section className="flex-1 flex flex-col gap-4">
            <div className="h-[42px]" />

            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-8 min-h-[650px] bg-white dark:bg-neutral-900 flex flex-col justify-start relative">
              
              {/* Toast Notification */}
              {toastMessage && (
                <div className="absolute top-4 right-8 bg-black dark:bg-white dark:text-black text-white text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all animate-bounce">
                  ✓ {toastMessage}
                </div>
              )}

              {/* Sub-tab 1: Personal Info */}
              {activeTab === "Personal Info" && (
                <div className="max-w-xl flex flex-col gap-6">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Personal Information</h3>

                  <div className="flex items-center gap-6 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-2xl font-bold text-neutral-600 dark:text-neutral-300 overflow-hidden border border-neutral-300 dark:border-neutral-700 shrink-0">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                      ) : (
                        userInfo.name.charAt(0) || "U"
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer inline-block px-4 py-2 text-sm font-medium border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-neutral-400 mt-1.5">JPG, PNG or GIF (Max. 5MB)</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Full Name</label>
                      <input
                        type="text"
                        value={userInfo.name}
                        onChange={(e) => {
                          setUserInfo({ ...userInfo, name: e.target.value });
                          if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                          errors.name ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white"
                        }`}
                      />
                      {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Email Address</label>
                      <input
                        type="email"
                        value={userInfo.email}
                        onChange={(e) => {
                          setUserInfo({ ...userInfo, email: e.target.value });
                          if (errors.email) setErrors({ ...errors, email: undefined });
                        }}
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                          errors.email ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white"
                        }`}
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-0.5">{errors.email}</p>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Phone Number</label>
                      <input
                        type="text"
                        value={userInfo.phone}
                        onChange={(e) => {
                          setUserInfo({ ...userInfo, phone: e.target.value });
                          if (errors.phone) setErrors({ ...errors, phone: undefined });
                        }}
                        className={`rounded-xl border p-3 text-sm outline-none bg-transparent transition-all ${
                          errors.phone ? "border-red-500 focus:border-red-500" : "border-neutral-200 dark:border-neutral-700 focus:border-black dark:focus:border-white"
                        }`}
                      />
                      {errors.phone && <p className="text-xs text-red-500 mt-0.5">{errors.phone}</p>}
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl bg-black dark:bg-white dark:text-black px-6 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          "Save Changes"
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="rounded-xl border border-neutral-300 dark:border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Theme */}
              {activeTab === "Theme" && (
                <div className="max-w-xl flex flex-col gap-8">
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Appearance Mode</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Choose how LearnlyAI looks to you (Light / Dark).</p>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      {[
                        { id: "light", label: "Light Mode" },
                        { id: "dark", label: "Dark Mode" },
                        { id: "system", label: "System Default" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setTheme(item.id)}
                          className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-3 ${
                            theme === item.id
                              ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                          }`}
                        >
                          <div
                            className={`w-full h-20 rounded-xl border ${
                              item.id === "dark"
                                ? "bg-neutral-900 border-neutral-800"
                                : item.id === "light"
                                ? "bg-white border-neutral-200"
                                : "bg-gradient-to-br from-white via-neutral-400 to-neutral-900 border-neutral-300"
                            }`}
                          />
                          <span className="text-xs dark:text-neutral-200">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Brand Color Theme</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Select your preferred accent theme color.</p>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {[
                        { id: "default", label: "Teal Modern (#0AD1C1)", colorBg: "bg-[#0AD1C1]" },
                        { id: "theme-peach", label: "Soft Peach (#FFAAAA)", colorBg: "bg-[#FFAAAA]" },
                        { id: "theme-gold", label: "Golden Amber (#FFC06F)", colorBg: "bg-[#FFC06F]" },
                        { id: "theme-sky", label: "Sky Breeze (#BCE8FF)", colorBg: "bg-[#BCE8FF]" },
                        { id: "theme-ruby", label: "Ruby Burgundy (#911005)", colorBg: "bg-[#911005]" },
                        { id: "theme-slate", label: "Slate Blue (#375572)", colorBg: "bg-[#375572]" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleColorThemeChange(item.id)}
                          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
                            colorTheme === item.id
                              ? "border-black dark:border-white bg-neutral-50 dark:bg-neutral-800 font-semibold"
                              : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-400"
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full shrink-0 border border-neutral-300 ${item.colorBg}`} />
                          <div>
                            <span className="text-sm block dark:text-neutral-200">{item.label}</span>
                            <span className="text-[11px] text-neutral-400 font-normal">Active Palette</span>
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
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-neutral-900" />}>
      <ProfileContent />
    </Suspense>
  );
}