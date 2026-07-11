import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import type { Category, StrikeEvent } from "./sources/types";

let cachedSql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (cachedSql) return cachedSql;

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not set — connect a Postgres database to this project in Vercel's Storage tab, then copy its connection string into .env.local for local development."
    );
  }
  cachedSql = neon(url);
  return cachedSql;
}

let schemaReady: Promise<void> | null = null;

function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          external_id TEXT NOT NULL UNIQUE,
          source TEXT NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          link TEXT,
          starts_at TEXT,
          language TEXT NOT NULL,
          first_seen_at TIMESTAMPTZ NOT NULL
        )
      `;
      // Older deployments created this table with a "severity" column that only
      // ever held the value "strike" — rename it in place now that it carries
      // real variance ("strike" | "construction").
      await sql`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'severity')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'category') THEN
            ALTER TABLE events RENAME COLUMN severity TO category;
          END IF;
        END $$
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          endpoint TEXT NOT NULL UNIQUE,
          subscription_json TEXT NOT NULL,
          categories TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}'`;
    })();
  }
  return schemaReady;
}

/** Inserts events that aren't already known; returns only the ones that were actually new. */
export async function insertNewEvents(events: StrikeEvent[]): Promise<StrikeEvent[]> {
  const sql = getSql();
  await ensureSchema(sql);

  const now = new Date().toISOString();
  const newEvents: StrikeEvent[] = [];

  for (const event of events) {
    const result = await sql`
      INSERT INTO events
        (external_id, source, category, title, description, link, starts_at, language, first_seen_at)
      VALUES
        (${event.externalId}, ${event.source}, ${event.category}, ${event.title}, ${event.description},
         ${event.link}, ${event.startsAt}, ${event.language}, ${now})
      ON CONFLICT (external_id) DO NOTHING
      RETURNING id
    `;
    if (result.length > 0) {
      newEvents.push(event);
    }
  }

  return newEvents;
}

export async function getRecentEvents(
  category: Category,
  limit = 50
): Promise<(StrikeEvent & { firstSeenAt: string })[]> {
  const sql = getSql();
  await ensureSchema(sql);

  const rows = (await sql`
    SELECT external_id, source, category, title, description, link, starts_at, language, first_seen_at
    FROM events WHERE category = ${category} ORDER BY first_seen_at DESC LIMIT ${limit}
  `) as {
    external_id: string;
    source: StrikeEvent["source"];
    category: Category;
    title: string;
    description: string;
    link: string | null;
    starts_at: string | null;
    language: StrikeEvent["language"];
    first_seen_at: string;
  }[];

  return rows.map((row) => ({
    externalId: row.external_id,
    source: row.source,
    category: row.category,
    title: row.title,
    description: row.description,
    link: row.link,
    startsAt: row.starts_at,
    language: row.language,
    firstSeenAt: row.first_seen_at,
  }));
}

export interface StoredPushSubscription {
  endpoint: string;
  subscriptionJson: string;
}

/** Adds a category to this endpoint's subscription, creating the subscription row if needed. */
export async function addSubscriptionCategory(
  subscriptionJson: string,
  endpoint: string,
  category: Category
): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`
    INSERT INTO push_subscriptions (endpoint, subscription_json, categories, created_at)
    VALUES (${endpoint}, ${subscriptionJson}, ARRAY[${category}], ${new Date().toISOString()})
    ON CONFLICT (endpoint) DO UPDATE SET
      subscription_json = EXCLUDED.subscription_json,
      categories = ARRAY(
        SELECT DISTINCT unnest(push_subscriptions.categories || ARRAY[${category}]::text[])
      )
  `;
}

/** Removes a category from this endpoint's subscription; deletes the row entirely if none remain. */
export async function removeSubscriptionCategory(endpoint: string, category: Category): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`
    UPDATE push_subscriptions
    SET categories = array_remove(categories, ${category})
    WHERE endpoint = ${endpoint}
  `;
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND categories = '{}'`;
}

export async function getSubscriptionCategories(endpoint: string): Promise<Category[]> {
  const sql = getSql();
  await ensureSchema(sql);
  const rows = (await sql`
    SELECT categories FROM push_subscriptions WHERE endpoint = ${endpoint}
  `) as { categories: Category[] }[];
  return rows[0]?.categories ?? [];
}

export async function getSubscriptionsForCategory(category: Category): Promise<StoredPushSubscription[]> {
  const sql = getSql();
  await ensureSchema(sql);
  const rows = (await sql`
    SELECT endpoint, subscription_json FROM push_subscriptions WHERE ${category} = ANY(categories)
  `) as { endpoint: string; subscription_json: string }[];
  return rows.map((row) => ({ endpoint: row.endpoint, subscriptionJson: row.subscription_json }));
}

/** Fully removes a subscription, e.g. when the browser reports it as expired/invalid (404/410). */
export async function removeSubscription(endpoint: string): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}
