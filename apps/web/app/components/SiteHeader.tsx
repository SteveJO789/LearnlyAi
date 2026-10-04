"use client";

import Link from "next/link";
import { useState } from "react";

// Shared top nav used by Home, Create, Lessons, and every Account/* page.
// Pass `links` for the plain-link buttons (e.g. Create, Lessons, HOME) and
// set `showAccountMenu` on pages that should show the "Account" dropdown
// (Profile / History / Setting / Log Out) instead of — or alongside — a
// plain Account link.

const NavButton =
  "rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-colors";

export type NavLink = {
  label: string;
  href: string;
};

type SiteHeaderProps = {
  /** Where the LOGO links to. Defaults to the Home page. */
  logoHref?: string;
  /** Plain-link nav buttons, rendered left to right in this order. */
  links?: NavLink[];
  /** Show the "Account" dropdown button (Profile / History / Setting / Log Out). */
  showAccountMenu?: boolean;
};

export default function SiteHeader({
  logoHref = "/Home",
  links = [],
  showAccountMenu = false,
}: SiteHeaderProps) {
  return (
    <header className="flex w-full items-center justify-between px-5 py-6 sm:px-12 lg:px-20">
      <Link href={logoHref} className="text-lg font-medium tracking-wide">
        LOGO
      </Link>

      <div className="flex items-center gap-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={NavButton}>
            {link.label}
          </Link>
        ))}

        {showAccountMenu && <AccountMenu />}
      </div>
    </header>
  );
}

function AccountMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen((open) => !open)} className={NavButton}>
        Account
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-2xl bg-white/80 p-2 shadow-xl backdrop-blur-md border border-neutral-100 flex flex-col space-y-1 z-50"
          style={{
            backgroundImage:
              "radial-gradient(120% 140% at 15% 20%, #ffe89e 0%, transparent 45%), radial-gradient(120% 140% at 80% 30%, #8178ff 0%, transparent 55%), radial-gradient(140% 160% at 60% 90%, #ff0d9b 0%, transparent 60%), linear-gradient(135deg, #ff2fb0, #8178ff)",
          }}
        >
          <Link
            href="/Account/Profile"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
          >
            Profile
          </Link>

          <Link
            href="/Account/History"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
          >
            History
          </Link>

          {/* NOTE(Cake): was pointing at /Account/Settings (plural, 404) —
              fixed to match the real route /Account/Setting. */}
          <Link
            href="/Account/Setting"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
          >
            Settings
          </Link>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              // TODO(Best): call the real logout endpoint once auth exists.
            }}
            className="w-full py-2 text-center text-sm font-medium text-purple-400 hover:text-purple-600 hover:bg-purple-50/50 rounded-xl transition-all mt-1"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}
