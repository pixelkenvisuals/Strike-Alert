import { matchesStrikeKeywords } from "./news";
import type { StrikeEvent } from "./types";

const IRAIL_USER_AGENT = "StrikeAlert/0.1 (Belgian strike tracker; contact: local-dev)";

interface IRailDisturbance {
  id: string;
  title: string;
  description: string;
  link: string;
  type: "disturbance" | "planned";
  timestamp: string;
}

interface IRailResponse {
  disturbance: IRailDisturbance[];
}

async function fetchDisturbances(): Promise<IRailDisturbance[]> {
  const url = "https://api.irail.be/disturbances/?format=json&lang=en";
  const res = await fetch(url, {
    headers: { "User-Agent": IRAIL_USER_AGENT },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`iRail disturbances request failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as IRailResponse;
  return data.disturbance ?? [];
}

function toEvent(d: IRailDisturbance, category: StrikeEvent["category"]): StrikeEvent {
  return {
    externalId: `nmbs-${d.id}`,
    source: "nmbs",
    category,
    title: d.title,
    description: d.description,
    link: d.link || null,
    startsAt: d.timestamp ? new Date(Number(d.timestamp) * 1000).toISOString() : null,
    language: "en",
  };
}

/**
 * iRail's disturbances feed includes every current NMBS issue (weather, crowding,
 * international incidents, etc.), not just strikes. We keep this app's strike-only
 * scope by filtering to entries whose text matches strike keywords in any language.
 */
export async function fetchNmbsEvents(): Promise<StrikeEvent[]> {
  const disturbances = await fetchDisturbances();
  return disturbances
    .filter((d) => matchesStrikeKeywords(`${d.title} ${d.description}`))
    .map((d) => toEvent(d, "strike"));
}

/** iRail tags scheduled engineering works separately (type: "planned") from unplanned disturbances. */
export async function fetchNmbsConstructionEvents(): Promise<StrikeEvent[]> {
  const disturbances = await fetchDisturbances();
  return disturbances.filter((d) => d.type === "planned").map((d) => toEvent(d, "construction"));
}
