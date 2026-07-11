"use client";

import { LOCALES } from "@/lib/i18n/dictionaries";
import { useLanguage } from "./LanguageProvider";

const LABELS: Record<string, string> = { en: "EN", nl: "NL", fr: "FR" };

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex gap-1 rounded-full border border-zinc-300 p-1 dark:border-zinc-700">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            locale === l
              ? "bg-foreground text-background"
              : "text-zinc-500 hover:text-foreground"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
