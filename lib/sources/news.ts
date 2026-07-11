import Parser from "rss-parser";
import type { StrikeEvent } from "./types";

const parser = new Parser();

interface NewsFeed {
  url: string;
  language: StrikeEvent["language"];
}

const FEEDS: NewsFeed[] = [
  { url: "https://www.vrt.be/vrtnws/en.rss.articles.xml", language: "en" },
  { url: "https://rss.rtbf.be/article/rss/highlight_rtbf_info-belgique.xml?source=internal", language: "fr" },
  { url: "https://www.bruzz.be/rss.xml", language: "nl" },
];

const STRIKE_KEYWORD_PATTERN = /\b(staking(en)?|staakt?|staken|gestaakt|grèves?|greves?|strikes?|striking)\b/i;

export function matchesStrikeKeywords(text: string): boolean {
  return STRIKE_KEYWORD_PATTERN.test(text);
}

function stableIdFor(item: { link?: string; guid?: string; title?: string }): string {
  return item.guid || item.link || item.title || Math.random().toString(36);
}

/** Scans all configured Belgian news feeds for items matching the given keyword filter. */
export async function scanNewsFeeds(
  filter: (text: string) => boolean = matchesStrikeKeywords
): Promise<StrikeEvent[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? [])
        .filter((item) => filter(`${item.title ?? ""} ${item.contentSnippet ?? item.content ?? ""}`))
        .map((item): StrikeEvent => ({
          externalId: `news-${stableIdFor(item)}`,
          source: "news",
          severity: "strike",
          title: item.title ?? "(untitled)",
          description: item.contentSnippet ?? item.content ?? "",
          link: item.link ?? null,
          startsAt: item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : null),
          language: feed.language,
        }));
    })
  );

  const events: StrikeEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    }
  }
  return events;
}
