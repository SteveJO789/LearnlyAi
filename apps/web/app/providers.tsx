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

function applyDefaultPalette(isDark: boolean) {
  const root = document.documentElement;

  const palette = isDark
    ? {
        primary: "#F3F4F6",
        primaryForeground: "#111827",
        secondary: "#374151",
        surface: "#1F2937",
        background: "#111827",
        text: "#F9FAFB",
        muted: "#9CA3AF",
        surfaceBorder: "#374151",
        accent: "#9CA3AF",
        danger: "#EF4444",
        primaryRgb: "243, 244, 246",
        textRgb: "249, 250, 251",
      }
    : {
        primary: "#111827",
        primaryForeground: "#FFFFFF",
        secondary: "#F3F4F6",
        surface: "#FFFFFF",
        background: "#FFFFFF",
        text: "#111827",
        muted: "#6B7280",
        surfaceBorder: "#E5E7EB",
        accent: "#6B7280",
        danger: "#B91C1C",
        primaryRgb: "17, 24, 39",
        textRgb: "17, 24, 39",
      };

  root.style.setProperty("--color-primary-rgb", palette.primaryRgb);
  root.style.setProperty("--color-text-rgb", palette.textRgb);
  root.style.setProperty("--primary", palette.primary);
  root.style.setProperty("--primary-foreground", palette.primaryForeground);
  root.style.setProperty("--secondary", palette.secondary);
  root.style.setProperty("--surface", palette.surface);
  root.style.setProperty("--background", palette.background);
  root.style.setProperty("--text", palette.text);
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--surface-border", palette.surfaceBorder);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--danger", palette.danger);
}

function clearDefaultPalette() {
  const root = document.documentElement;

  [
    "--color-primary-rgb",
    "--color-text-rgb",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--surface",
    "--background",
    "--text",
    "--muted",
    "--surface-border",
    "--accent",
    "--danger",
  ].forEach((property) => root.style.removeProperty(property));
}

function applySavedColorTheme(colorTheme: ColorTheme, isDark: boolean) {
  const root = document.documentElement;

  root.classList.remove(...COLOR_THEME_CLASSES);

  if (colorTheme === "default") {
    applyDefaultPalette(isDark);
    return;
  }

  if (colorTheme === "theme-teal") {
    const palette = isDark
      ? {
          primary: "#0AD1C1",
          primaryForeground: "#0B1B1A",
          secondary: "#164E4A",
          surface: "#1F2937",
          background: "#111827",
          text: "#EFF6FF",
          muted: "#9CA3AF",
          surfaceBorder: "#374151",
          accent: "#FFC06F",
          danger: "#EF4444",
          primaryRgb: "10, 209, 193",
          textRgb: "239, 246, 255",
        }
      : {
          primary: "#0AD1C1",
          primaryForeground: "#FFFFFF",
          secondary: "#93FBFF",
          surface: "#E2FFFC",
          background: "#FFFFFF",
          text: "#375572",
          muted: "#6B7280",
          surfaceBorder: "#E5E7EB",
          accent: "#FFC06F",
          danger: "#911005",
          primaryRgb: "10, 209, 193",
          textRgb: "55, 85, 114",
        };

    root.style.setProperty("--color-primary-rgb", palette.primaryRgb);
    root.style.setProperty("--color-text-rgb", palette.textRgb);
    root.style.setProperty("--primary", palette.primary);
    root.style.setProperty("--primary-foreground", palette.primaryForeground);
    root.style.setProperty("--secondary", palette.secondary);
    root.style.setProperty("--surface", palette.surface);
    root.style.setProperty("--background", palette.background);
    root.style.setProperty("--text", palette.text);
    root.style.setProperty("--muted", palette.muted);
    root.style.setProperty("--surface-border", palette.surfaceBorder);
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--danger", palette.danger);
    return;
  }

  clearDefaultPalette();
  root.classList.add(colorTheme);
}

function ThemeEffects() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const savedColorTheme =
      (localStorage.getItem("app-color-theme") as ColorTheme | null) ??
      "default";

    const root = document.documentElement;
    root.classList.add("theme-transition");

    applySavedColorTheme(
      savedColorTheme,
      resolvedTheme === "dark",
    );

    const timeoutId = window.setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 220);

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

      applySavedColorTheme(
        savedColorTheme,
        resolvedTheme === "dark",
      );

      window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, 220);
    };

    window.addEventListener("color-theme-changed", handleColorThemeChanged);

    return () => {
      window.removeEventListener("color-theme-changed", handleColorThemeChanged);
    };
  }, [resolvedTheme]);

  useEffect(() => {
    void getCurrentUserThemePreferences()
      .then((preferences) => {
        localStorage.setItem("app-color-theme", preferences.colorTheme);

        const currentTheme =
          document.documentElement.classList.contains("dark")
            ? "dark"
            : "light";

        if (preferences.appearanceMode !== currentTheme) {
          document.documentElement.classList.add("theme-transition");
        }
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
