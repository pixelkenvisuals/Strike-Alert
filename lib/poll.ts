import { insertNewEvents } from "./db";
import { notifySubscribers } from "./notify";
import { fetchAirportEvents } from "./sources/airport";
import { fetchNmbsEvents } from "./sources/nmbs";
import { fetchStibEvents } from "./sources/stib";
import type { StrikeEvent } from "./sources/types";

interface PollResult {
  fetched: number;
  new: number;
  errors: { source: string; message: string }[];
}

/** Fetches every configured source, stores any events not seen before, and notifies subscribers of those. */
export async function pollAllSources(): Promise<PollResult> {
  const sourceFetchers: { name: string; fetch: () => Promise<StrikeEvent[]> }[] = [
    { name: "stib", fetch: fetchStibEvents },
    { name: "nmbs", fetch: fetchNmbsEvents },
    { name: "airport", fetch: fetchAirportEvents },
  ];

  const errors: PollResult["errors"] = [];
  const allEvents: StrikeEvent[] = [];

  const results = await Promise.allSettled(sourceFetchers.map((s) => s.fetch()));
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    } else {
      errors.push({ source: sourceFetchers[i].name, message: String(result.reason) });
    }
  });

  const newEvents = await insertNewEvents(allEvents);
  await notifySubscribers(newEvents);

  return { fetched: allEvents.length, new: newEvents.length, errors };
}
