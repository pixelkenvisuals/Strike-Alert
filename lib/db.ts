import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import type { StrikeEvent } from "./sources/types";

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
          severity TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          link TEXT,
          starts_at TEXT,
          language TEXT NOT NULL,
          first_seen_at TIMESTAMPTZ NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          endpoint TEXT NOT NULL UNIQUE,
          subscription_json TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `;
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
        (external_id, source, severity, title, description, link, starts_at, language, first_seen_at)
      VALUES
        (${event.externalId}, ${event.source}, ${event.severity}, ${event.title}, ${event.description},
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

export async function getRecentEvents(limit = 50): Promise<(StrikeEvent & { firstSeenAt: string })[]> {
  const sql = getSql();
  await ensureSchema(sql);

  const rows = (await sql`
    SELECT external_id, source, severity, title, description, link, starts_at, language, first_seen_at
    FROM events ORDER BY first_seen_at DESC LIMIT ${limit}
  `) as {
    external_id: string;
    source: StrikeEvent["source"];
    severity: StrikeEvent["severity"];
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
    severity: row.severity,
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

export async function saveSubscription(subscriptionJson: string, endpoint: string): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`
    INSERT INTO push_subscriptions (endpoint, subscription_json, created_at)
    VALUES (${endpoint}, ${subscriptionJson}, ${new Date().toISOString()})
    ON CONFLICT (endpoint) DO UPDATE SET subscription_json = EXCLUDED.subscription_json
  `;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export async function getAllSubscriptions(): Promise<StoredPushSubscription[]> {
  const sql = getSql();
  await ensureSchema(sql);
  const rows = (await sql`SELECT endpoint, subscription_json FROM push_subscriptions`) as {
    endpoint: string;
    subscription_json: string;
  }[];
  return rows.map((row) => ({ endpoint: row.endpoint, subscriptionJson: row.subscription_json }));
}
