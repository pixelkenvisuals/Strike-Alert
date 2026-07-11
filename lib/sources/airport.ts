import { matchesStrikeKeywords, scanNewsFeeds } from "./news";
import type { StrikeEvent } from "./types";

const AIRPORT_KEYWORD_PATTERN = /\b(brussels airport|zaventem|brucargo)\b/i;

/**
 * Brussels Airport has no public disruption API and its own site blocks automated
 * fetches, so this reuses the news scanner filtered to airport + strike mentions
 * (best-effort early warning, not a first-party feed).
 */
export async function fetchAirportEvents(): Promise<StrikeEvent[]> {
  const events = await scanNewsFeeds(
    (text) => AIRPORT_KEYWORD_PATTERN.test(text) && matchesStrikeKeywords(text)
  );

  return events.map((event) => ({
    ...event,
    externalId: event.externalId.replace(/^news-/, "airport-"),
    source: "airport" as const,
  }));
}
