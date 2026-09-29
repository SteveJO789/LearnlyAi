"use client";

import Link from "next/link";

type TabType = "Chat" | "Lessons" | "Uploaded Files" | "Test Results";
type SectionType = "Profile" | "History" | "Setting" | "Help";

interface AccountSidebarProps {
  activeSection: SectionType;
  activeTab?: TabType | null;
}

export default function AccountSidebar({
  activeSection,
  activeTab = null,
}: AccountSidebarProps) {
  return (
    <aside className="w-64 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-6 text-sm bg-white dark:bg-neutral-900 shrink-0">
      {/* 1. Profile Section */}
      <div>
        <Link
          href="/Account/Profile"
          className={`block font-semibold mb-3 text-center py-1.5 rounded-lg transition-colors ${
            activeSection === "Profile"
              ? "bg-black text-white dark:bg-white dark:text-black font-bold"
              : "text-neutral-500 hover:text-black dark:hover:text-white bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-300"
          }`}
        >
          Profile
        </Link>
        <ul className="space-y-3 text-neutral-600 dark:text-neutral-400 px-2 text-center">
          <li className="cursor-pointer hover:text-black dark:hover:text-white">
            <Link href="/Account/Profile">Personal Info</Link>
          </li>
          <li className="cursor-pointer hover:text-black dark:hover:text-white">
            <Link href="/Account/Profile">Theme</Link>
          </li>
        </ul>
      </div>

      {/* 2. History Section */}
      <div>
        <Link
          href="/Account/History"
          className={`block w-full font-bold mb-3 text-center py-1.5 rounded-lg cursor-pointer transition-colors ${
            activeSection === "History"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700"
          }`}
        >
          History
        </Link>
        <ul className="space-y-2 px-2 text-center">
          {(
            [
              "Chat",
              "Lessons",
              "Uploaded Files",
              "Test Results",
            ] as TabType[]
          ).map((tab) => {
            const isTabActive = activeSection === "History" && activeTab === tab;
            return (
              <li key={tab}>
                <Link
                  href={`/Account/History?tab=${encodeURIComponent(tab)}`}
                  className={`block w-full text-center py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                    isTabActive
                      ? "font-semibold text-black dark:text-white underline decoration-neutral-400 underline-offset-4 bg-neutral-100/70 dark:bg-neutral-800/70"
                      : "text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  {tab}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3. Setting Section */}
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

      {/* 4. Help & Support Section */}
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
  );
}