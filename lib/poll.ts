import { insertNewEvents } from "./db";
import { notifySubscribers } from "./notify";
import { fetchAirportEvents } from "./sources/airport";
import { fetchNmbsConstructionEvents, fetchNmbsEvents } from "./sources/nmbs";
import { fetchStibConstructionEvents, fetchStibEvents } from "./sources/stib";
import type { StrikeEvent } from "./sources/types";

interface PollResult {
  fetched: number;
  new: number;
  errors: { source: string; message: string }[];
}

async function fetchAll(
  fetchers: { name: string; fetch: () => Promise<StrikeEvent[]> }[],
  errors: PollResult["errors"]
): Promise<StrikeEvent[]> {
  const events: StrikeEvent[] = [];
  const results = await Promise.allSettled(fetchers.map((f) => f.fetch()));
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      errors.push({ source: fetchers[i].name, message: String(result.reason) });
    }
  });
  return events;
}

/** Fetches every configured source, stores any events not seen before, and notifies subscribers of those. */
export async function pollAllSources(): Promise<PollResult> {
  const errors: PollResult["errors"] = [];

  const strikeEvents = await fetchAll(
    [
      { name: "stib-strike", fetch: fetchStibEvents },
      { name: "nmbs-strike", fetch: fetchNmbsEvents },
      { name: "airport-strike", fetch: fetchAirportEvents },
    ],
    errors
  );
  const constructionEvents = await fetchAll(
    [
      { name: "stib-construction", fetch: fetchStibConstructionEvents },
      { name: "nmbs-construction", fetch: fetchNmbsConstructionEvents },
    ],
    errors
  );

  const newStrikeEvents = await insertNewEvents(strikeEvents);
  const newConstructionEvents = await insertNewEvents(constructionEvents);

  await notifySubscribers(newStrikeEvents, "strike");
  await notifySubscribers(newConstructionEvents, "construction");

  return {
    fetched: strikeEvents.length + constructionEvents.length,
    new: newStrikeEvents.length + newConstructionEvents.length,
    errors,
  };
}
