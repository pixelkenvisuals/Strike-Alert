import { matchesStrikeKeywords } from "./news";
import type { StrikeEvent } from "./types";

const TRAVELLERS_INFO_URL =
  "https://api-management-discovery-production.azure-api.net/api/datasets/stibmivb/rt/TravellersInformation";

const CONSTRUCTION_KEYWORD_PATTERN = /\b(works|travaux|werken)\b/i;

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

interface StibTexts {
  en: string;
  fr: string;
  nl: string;
}

function pickText(entry: StibResult): StibTexts | null {
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

async function fetchTravellersInfo(): Promise<StibResult[]> {
  const res = await fetch(TRAVELLERS_INFO_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`STIB TravellersInformation request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as StibResponse;
  return data.results ?? [];
}

function toEvent(entry: StibResult, texts: StibTexts, category: StrikeEvent["category"]): StrikeEvent {
  const lines = linesFor(entry);
  const description = texts.en || texts.fr || texts.nl;
  const title = lines.length > 0 ? `Line ${lines.join(", ")}: ${description.slice(0, 80)}` : description.slice(0, 80);

  return {
    externalId: `stib-${entry.id}`,
    source: "stib",
    category,
    title,
    description: texts.en || texts.fr,
    link: null,
    startsAt: null,
    language: texts.en ? "en" : texts.fr ? "fr" : "nl",
  };
}

/**
 * STIB's public "Travellers Information" JSON API (no key required) returns every
 * active service message, most of which are routine diversions/works, not strikes.
 * We keep the strike-focused scope of this app by filtering to entries whose text
 * matches strike keywords in any language.
 */
export async function fetchStibEvents(): Promise<StrikeEvent[]> {
  const results = await fetchTravellersInfo();
  const events: StrikeEvent[] = [];

  for (const entry of results) {
    const texts = pickText(entry);
    if (!texts) continue;
    const combined = `${texts.en} ${texts.fr} ${texts.nl}`;
    if (!matchesStrikeKeywords(combined)) continue;
    events.push(toEvent(entry, texts, "strike"));
  }

  return events;
}

/** STIB's own text conventionally prefixes planned works messages with "Works."/"Travaux."/"Werken.". */
export async function fetchStibConstructionEvents(): Promise<StrikeEvent[]> {
  const results = await fetchTravellersInfo();
  const events: StrikeEvent[] = [];

  for (const entry of results) {
    const texts = pickText(entry);
    if (!texts) continue;
    const combined = `${texts.en} ${texts.fr} ${texts.nl}`;
    if (!CONSTRUCTION_KEYWORD_PATTERN.test(combined)) continue;
    events.push(toEvent(entry, texts, "construction"));
  }

  return events;
}
