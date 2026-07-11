export type Source = "stib" | "nmbs" | "airport" | "news";

export type Category = "strike" | "construction";

export interface StrikeEvent {
  /** Stable identifier used to detect "is this new" — derived from source + title/date, not a DB row id. */
  externalId: string;
  source: Source;
  category: Category;
  title: string;
  description: string;
  link: string | null;
  /** ISO 8601 timestamp of when the source says the event starts/was published. */
  startsAt: string | null;
  language: "nl" | "fr" | "en";
}
