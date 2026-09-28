"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  return (
    <nav className="flex items-center justify-between px-8 py-6 relative">
      {/* LOGO */}
      <Link href="/" className="text-xl font-bold tracking-wide">
        LOGO
      </Link>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-4">
        <Link
          href="/Create"
          className="rounded-xl bg-black px-6 py-2.5 text-base font-medium text-white hover:bg-neutral-800 transition-all"
        >
          Create
        </Link>

        <Link
          href="/Lessons"
          className="rounded-xl bg-black px-6 py-2.5 text-base font-medium text-white hover:bg-neutral-800 transition-all"
        >
          Lessons
        </Link>

        {/* Account Button Container */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAccountOpen(!isAccountOpen)}
            className="rounded-xl bg-black px-6 py-2.5 text-base font-medium text-white hover:bg-neutral-800 transition-all focus:outline-none"
          >
            Account
          </button>

          {/* Dropdown Card */}
          {isAccountOpen && (
            <div
              className="absolute right-0 mt-3 w-56 rounded-3xl p-4 shadow-xl flex flex-col gap-2.5 z-50"
              style={{
                backgroundImage:
                  "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
              }}
            >
              <Link
                href="/Account/Profile"
                onClick={() => setIsAccountOpen(false)}
                className="w-full text-center py-2.5 rounded-2xl bg-white/70 hover:bg-white/90 text-sm font-medium text-purple-900 shadow-sm transition-all"
              >
                Profile
              </Link>

              <Link
                href="/Account/History"
                onClick={() => setIsAccountOpen(false)}
                className="w-full text-center py-2.5 rounded-2xl bg-white/70 hover:bg-white/90 text-sm font-medium text-purple-900 shadow-sm transition-all"
              >
                History
              </Link>

              <Link
                href="/Account/Settings"
                onClick={() => setIsAccountOpen(false)}
                className="w-full text-center py-2.5 rounded-2xl bg-white/70 hover:bg-white/90 text-sm font-medium text-purple-900 shadow-sm transition-all"
              >
                Settings
              </Link>

              <button
                type="button"
                onClick={() => {
                  setIsAccountOpen(false);
                  // ใส่ Logic Log Out ตรงนี้
                }}
                className="w-full text-center py-2.5 rounded-2xl bg-pink-500/80 hover:bg-pink-500 text-sm font-medium text-white shadow-sm transition-all mt-1"
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}