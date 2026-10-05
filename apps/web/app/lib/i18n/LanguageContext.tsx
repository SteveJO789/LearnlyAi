"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { en, th, type Dictionary } from "./dictionary";

export type Language = "en" | "th";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = "learnly-language";
const dictionaries: Record<Language, Dictionary> = { en, th };

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Defaults to English on the server (and on first client render, to avoid
  // a hydration mismatch), then syncs to whatever was saved once mounted.
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "th") {
      setLanguageState(saved);
    }
  }, []);

  function setLanguage(next: Language) {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  function t(key: string): string {
    return dictionaries[language][key] ?? key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
