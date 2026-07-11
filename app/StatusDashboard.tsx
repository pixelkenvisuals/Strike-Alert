"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { StrikeEvent } from "@/lib/sources/types";

type StoredEvent = StrikeEvent & { firstSeenAt: string };

const SOURCES: { key: StrikeEvent["source"]; labelKey: string }[] = [
  { key: "stib", labelKey: "sourceStib" },
  { key: "nmbs", labelKey: "sourceNmbs" },
  { key: "airport", labelKey: "sourceAirport" },
];

const POLL_INTERVAL_MS = 60_000;

export function StatusDashboard() {
  const { t, locale } = useLanguage();
  const [events, setEvents] = useState<StoredEvent[] | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  async function loadEvents() {
    const res = await fetch("/api/events", { cache: "no-store" });
    const data = (await res.json()) as { events: StoredEvent[] };
    setEvents(data.events);
    setLastFetched(new Date());
  }

  useEffect(() => {
    // Mount-time data fetch from our own API route; there's no simpler sync target
    // (no server component data available here since this is a client-rendered dashboard).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
    const interval = setInterval(loadEvents, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {lastFetched ? `${t("lastUpdated")}: ${lastFetched.toLocaleTimeString(locale)}` : ""}
        </span>
        <button onClick={loadEvents} className="underline hover:text-foreground">
          {t("refresh")}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SOURCES.map(({ key, labelKey }) => {
          const sourceEvents = (events ?? []).filter((e) => e.source === key);
          return (
            <div
              key={key}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <h2 className="mb-2 text-sm font-semibold">{t(labelKey)}</h2>
              {sourceEvents.length === 0 ? (
                <p className="text-sm text-emerald-600">{t("statusClear")}</p>
              ) : (
                <p className="text-sm font-medium text-red-600">
                  {sourceEvents.length} {t("statusActive")}
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
                <span>{t(SOURCES.find((s) => s.key === event.source)?.labelKey ?? event.source)}</span>
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
