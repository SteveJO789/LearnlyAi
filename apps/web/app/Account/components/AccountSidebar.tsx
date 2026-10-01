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
    <aside className="w-64 rounded-2xl border border-surface-border p-5 flex flex-col gap-6 text-sm bg-surface shrink-0">
      {/* 1. Profile Section */}
      <div>
        <Link
          href="/Account/Profile"
          className={`block font-semibold mb-3 text-center py-1.5 rounded-lg transition-colors ${
            activeSection === "Profile"
              ? "bg-primary text-primary-foreground font-bold"
              : "text-muted hover:text-text bg-secondary"
          }`}
        >
          Profile
        </Link>
        <ul className="space-y-3 text-muted px-2 text-center">
          <li className="cursor-pointer hover:text-text">
            <Link href="/Account/Profile">Personal Info</Link>
          </li>
          <li className="cursor-pointer hover:text-text">
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
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted hover:opacity-80"
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
                      ? "font-semibold text-text underline decoration-muted underline-offset-4 bg-secondary/70"
                      : "text-muted hover:text-text hover:bg-secondary/50"
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
        <p className="font-semibold text-muted mb-3 text-center bg-secondary py-1.5 rounded-lg">
          Setting
        </p>
        <ul className="space-y-3 text-muted px-2 text-center">
          <li className="cursor-pointer hover:text-text">Change Password</li>
          <li className="cursor-pointer hover:text-text">Learning Preferences</li>
          <li className="cursor-pointer hover:text-text">Notifications</li>
          <li className="cursor-pointer hover:text-text">Language</li>
          <li className="cursor-pointer hover:text-text">Privacy</li>
          <li className="cursor-pointer text-muted hover:text-danger">Delete Account</li>
        </ul>
      </div>

      {/* 4. Help & Support Section */}
      <div>
        <p className="font-semibold text-muted mb-3 text-center bg-secondary py-1.5 rounded-lg">
          Help & Support
        </p>
        <ul className="space-y-3 text-muted px-2 text-center">
          <li className="cursor-pointer hover:text-text">Help Center / FAQ</li>
          <li className="cursor-pointer hover:text-text">Report a Problem</li>
          <li className="cursor-pointer hover:text-text">Contact Us</li>
        </ul>
      </div>
    </aside>
  );
}
