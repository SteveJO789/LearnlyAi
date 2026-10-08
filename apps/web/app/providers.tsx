"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, ReactNode } from "react";

import { getCurrentUserThemePreferences, type ColorTheme } from "./../lib/user-profile";
import { LanguageProvider } from "./lib/i18n/LanguageContext";

// ดักจับและซ่อน Warning ของ React 19 ที่มาจาก next-themes ในโหมด Development
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

const COLOR_THEME_CLASSES: ColorTheme[] = [
  "theme-ruby",
  "theme-peach",
  "theme-sky",
  "theme-gold",
  "theme-slate",
  "theme-teal",
];

function applySavedColorTheme(colorTheme: ColorTheme) {
  const root = document.documentElement;

  root.classList.remove(...COLOR_THEME_CLASSES);

  if (colorTheme !== "default") {
    root.classList.add(colorTheme);
  }
}

function ThemeEffects() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const savedColorTheme =
      (localStorage.getItem("app-color-theme") as ColorTheme | null) ??
      "default";

    applySavedColorTheme(savedColorTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-transition");

    const timeoutId = window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      root.classList.remove("theme-transition");
    };
  }, [resolvedTheme]);

  useEffect(() => {
    const handleColorThemeChanged = () => {
      const savedColorTheme =
        (localStorage.getItem("app-color-theme") as ColorTheme | null) ??
        "default";

      const root = document.documentElement;
      root.classList.add("theme-transition");
      applySavedColorTheme(savedColorTheme);

      window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, 180);
    };

    window.addEventListener("color-theme-changed", handleColorThemeChanged);

    return () => {
      window.removeEventListener("color-theme-changed", handleColorThemeChanged);
    };
  }, []);

  useEffect(() => {
    void getCurrentUserThemePreferences()
      .then((preferences) => {
        localStorage.setItem("app-color-theme", preferences.colorTheme);
        applySavedColorTheme(preferences.colorTheme);
      })
      .catch(() => {
        // Local storage remains the fallback for the current session.
      });
  }, []);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
    >
      <ThemeEffects />
      <LanguageProvider>{children}</LanguageProvider>
    </NextThemesProvider>
  );
}
