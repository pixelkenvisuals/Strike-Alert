"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { Category, StrikeEvent } from "@/lib/sources/types";

type StoredEvent = StrikeEvent & { firstSeenAt: string };

const SOURCES_BY_CATEGORY: Record<Category, { key: StrikeEvent["source"]; labelKey: string }[]> = {
  strike: [
    { key: "stib", labelKey: "sourceStib" },
    { key: "nmbs", labelKey: "sourceNmbs" },
    { key: "airport", labelKey: "sourceAirport" },
  ],
  construction: [
    { key: "stib", labelKey: "sourceStib" },
    { key: "nmbs", labelKey: "sourceNmbs" },
  ],
};

const TABS: { key: Category; labelKey: string }[] = [
  { key: "strike", labelKey: "tabStrikes" },
  { key: "construction", labelKey: "tabConstruction" },
];

const POLL_INTERVAL_MS = 60_000;

export function StatusDashboard() {
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<Category>("strike");
  const [events, setEvents] = useState<StoredEvent[] | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function loadEvents(category: Category) {
    const res = await fetch(`/api/events?category=${category}`, { cache: "no-store" });
    const data = (await res.json()) as { events: StoredEvent[] };
    setEvents(data.events);
    setLastFetched(new Date());
  }

  useEffect(() => {
    // Clearing stale events and fetching for the newly active tab; not derivable
    // from existing props+state, so this isn't the "you might not need an effect" case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvents(null);
    loadEvents(activeTab);
    const interval = setInterval(() => loadEvents(activeTab), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeTab]);

  const sources = SOURCES_BY_CATEGORY[activeTab];

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-4 flex gap-1 rounded-full border border-zinc-300 p-1 dark:border-zinc-700 w-fit">
        {TABS.map(({ key, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key ? "bg-foreground text-background" : "text-zinc-500 hover:text-foreground"
            }`}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {lastFetched ? `${t("lastUpdated")}: ${lastFetched.toLocaleTimeString(locale)}` : ""}
        </span>
        <button onClick={() => loadEvents(activeTab)} className="underline hover:text-foreground">
          {t("refresh")}
        </button>
      </div>

      <div className={`grid gap-4 ${sources.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {sources.map(({ key, labelKey }) => {
          const sourceEvents = (events ?? []).filter((e) => e.source === key);
          return (
            <div key={key} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-2 text-sm font-semibold">{t(labelKey)}</h2>
              {sourceEvents.length === 0 ? (
                <p className="text-sm text-emerald-600">{t(activeTab === "strike" ? "statusClear" : "statusClearConstruction")}</p>
              ) : (
                <p className="text-sm font-medium text-red-600">
                  {sourceEvents.length} {t(activeTab === "strike" ? "statusActive" : "statusActiveConstruction")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {events === null ? null : events.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("noEventsYet")}</p>
        ) : (
          events.map((event) => (
            <article
              key={event.externalId}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <span>{t(sources.find((s) => s.key === event.source)?.labelKey ?? event.source)}</span>
                <span>&middot;</span>
                <span>
                  {t("firstSeen")}: {new Date(event.firstSeenAt).toLocaleString(locale)}
                </span>
              </div>
              <h3 className="mb-1 font-medium">{event.title}</h3>
              {event.description && (
                <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">{event.description}</p>
              )}
              {event.link && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium underline"
                >
                  {t("readMore")}
                </a>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
