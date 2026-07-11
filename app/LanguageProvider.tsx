"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Locale, LOCALES, translate } from "@/lib/i18n/dictionaries";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "strike-alert-locale";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale;
  const browserLang = window.navigator.language.slice(0, 2);
  if (LOCALES.includes(browserLang as Locale)) return browserLang as Locale;
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Deferred to an effect (not a lazy useState initializer) so the client's first
    // render matches the server's "en" default and avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t: (key: string) => translate(locale, key) }),
    [locale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
