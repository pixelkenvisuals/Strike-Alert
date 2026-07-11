"use client";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationsSection } from "./NotificationsSection";
import { StatusDashboard } from "./StatusDashboard";
import { useLanguage } from "./LanguageProvider";

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <header className="mb-8 flex w-full max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("appTitle")}</h1>
          <p className="text-sm text-zinc-500">{t("tagline")}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationsSection />
          <LanguageSwitcher />
        </div>
      </header>

      <StatusDashboard />
    </div>
  );
}
