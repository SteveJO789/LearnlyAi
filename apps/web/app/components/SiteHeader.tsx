"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLanguage } from "../lib/i18n/LanguageContext";
import { getSupabaseClient } from "../../lib/supabase";

// Shared top nav used by Home, Create, Lessons, and every Account/* page.
// Pass `links` for the plain-link buttons (e.g. Create, Lessons, HOME) and
// set `showAccountMenu` on pages that should show the "Account" dropdown
// (Profile / History / Setting / Log Out) instead of — or alongside — a
// plain Account link.
//
// `labelKey` is a dictionary key (see app/lib/i18n/dictionary.ts), not the
// literal label — that's what lets the same nav translate everywhere it's
// used without every page having to call t() itself.

const NavButton =
  "rounded-lg bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground shadow-sm hover:opacity-90 transition-colors";

export type NavLink = {
  labelKey: string;
  href: string;
};

type SiteHeaderProps = {
  /** Where the LearnlyAI brand links to. Defaults to the Home page. */
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
  const { t } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="relative z-30 flex w-full flex-wrap items-center justify-between gap-y-3 px-4 py-4 sm:px-12 sm:py-6 lg:px-20">
      <Link href={logoHref} aria-label="LearnlyAI home" className="auth-brand inline-flex items-center gap-3">
        <span aria-hidden="true" className="auth-brand-mark">✿</span>
        <span className="auth-brand-word">LearnlyAI</span>
      </Link>

      <nav aria-label="Main navigation" className="hidden items-center gap-3 md:flex">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={NavButton}>
            {t(link.labelKey)}
          </Link>
        ))}
        {showAccountMenu && <AccountMenu />}
      </nav>

      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-surface-border bg-surface text-2xl text-text shadow-sm md:hidden"
        aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-site-navigation"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{isMobileMenuOpen ? "×" : "☰"}</span>
      </button>

      {isMobileMenuOpen && (
        <nav
          id="mobile-site-navigation"
          aria-label="Mobile navigation"
          className="flex w-full flex-col gap-2 rounded-2xl border border-surface-border bg-background/95 p-3 shadow-lg backdrop-blur-md md:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={NavButton + " w-full text-center"}
            >
              {t(link.labelKey)}
            </Link>
          ))}
          {showAccountMenu && <div className="w-full"><AccountMenu /></div>}
        </nav>
      )}
    </header>
  );
}

function AccountMenu() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsOpen(false);
    setIsLoggingOut(true);
    try {
      await getSupabaseClient().auth.signOut();
    } finally {
      router.replace("/SignIn");
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen((open) => !open)} className={NavButton + " w-full text-center md:w-auto"}>
        {t("nav.account")}
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
            {t("nav.profile")}
          </Link>

          <Link
            href="/Account/History"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
          >
            {t("nav.history")}
          </Link>

          <Link
            href="/Account/Setting"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 text-center text-sm font-medium text-purple-600 bg-white/70 hover:bg-purple-50 rounded-xl transition-all shadow-sm"
          >
            {t("nav.settings")}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-2 text-center text-sm font-medium text-purple-400 hover:text-purple-600 hover:bg-purple-50/50 rounded-xl transition-all mt-1"
          >
            {t("nav.logOut")}
          </button>
        </div>
      )}
    </div>
  );
}
