import { matchesStrikeKeywords } from "./news";
import type { StrikeEvent } from "./types";

const TRAVELLERS_INFO_URL =
  "https://api-management-discovery-production.azure-api.net/api/datasets/stibmivb/rt/TravellersInformation";

interface StibTextEntry {
  text: { en?: string; fr?: string; nl?: string }[];
  type: string;
}

interface StibResult {
  id: string;
  content: string; // JSON-encoded StibTextEntry[]
  type: string;
  lines: string; // JSON-encoded { id: string }[]
  priority: number;
  points: string; // JSON-encoded { id: string }[]
}

interface StibResponse {
  results: StibResult[];
}

function pickText(entry: StibResult): { en: string; fr: string; nl: string } | null {
  try {
    const parsed = JSON.parse(entry.content) as StibTextEntry[];
    const texts = parsed[0]?.text?.[0];
    if (!texts) return null;
    return { en: texts.en ?? "", fr: texts.fr ?? "", nl: texts.nl ?? "" };
  } catch {
    return null;
  }
}

function linesFor(entry: StibResult): string[] {
  try {
    const parsed = JSON.parse(entry.lines) as { id: string }[];
    return parsed.map((l) => l.id);
  } catch {
    return [];
  }
}

/**
 * STIB's public "Travellers Information" JSON API (no key required) returns every
 * active service message, most of which are routine diversions/works, not strikes.
 * We keep the strike-focused scope of this app by filtering to entries whose text
 * matches strike keywords in any language.
 */
export async function fetchStibEvents(): Promise<StrikeEvent[]> {
  const res = await fetch(TRAVELLERS_INFO_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`STIB TravellersInformation request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as StibResponse;
  const events: StrikeEvent[] = [];

  for (const entry of data.results ?? []) {
    const texts = pickText(entry);
    if (!texts) continue;

    const combined = `${texts.en} ${texts.fr} ${texts.nl}`;
    if (!matchesStrikeKeywords(combined)) continue;

    const lines = linesFor(entry);
    const description = texts.en || texts.fr || texts.nl;
    const title = lines.length > 0 ? `Line ${lines.join(", ")}: ${description.slice(0, 80)}` : description.slice(0, 80);

    events.push({
      externalId: `stib-${entry.id}`,
      source: "stib",
      severity: "strike",
      title,
      description: texts.en || texts.fr,
      link: null,
      startsAt: null,
      language: texts.en ? "en" : texts.fr ? "fr" : "nl",
    });
  }

  return events;
}
