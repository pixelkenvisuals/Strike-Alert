import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type { StrikeEvent } from "./sources/types";

const dbPath = path.join(process.cwd(), "data", "strike-alert.db");

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      link TEXT,
      starts_at TEXT,
      language TEXT NOT NULL,
      first_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

/** Inserts events that aren't already known; returns only the ones that were actually new. */
export function insertNewEvents(events: StrikeEvent[]): StrikeEvent[] {
  const database = getDb();
  const insert = database.prepare(`
    INSERT OR IGNORE INTO events
      (external_id, source, severity, title, description, link, starts_at, language, first_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const newEvents: StrikeEvent[] = [];
  const now = new Date().toISOString();
  for (const event of events) {
    const result = insert.run(
      event.externalId,
      event.source,
      event.severity,
      event.title,
      event.description,
      event.link,
      event.startsAt,
      event.language,
      now
    );
    if (result.changes > 0) {
      newEvents.push(event);
    }
  }
  return newEvents;
}

export function getRecentEvents(limit = 50): (StrikeEvent & { firstSeenAt: string })[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT external_id, source, severity, title, description, link, starts_at, language, first_seen_at
       FROM events ORDER BY first_seen_at DESC LIMIT ?`
    )
    .all(limit) as {
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

export function saveSubscription(subscriptionJson: string, endpoint: string): void {
  const database = getDb();
  database
    .prepare(
      `INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription_json, created_at)
       VALUES (?, ?, ?)`
    )
    .run(endpoint, subscriptionJson, new Date().toISOString());
}

export function removeSubscription(endpoint: string): void {
  const database = getDb();
  database.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

export function getAllSubscriptions(): StoredPushSubscription[] {
  const database = getDb();
  const rows = database
    .prepare(`SELECT endpoint, subscription_json FROM push_subscriptions`)
    .all() as { endpoint: string; subscription_json: string }[];
  return rows.map((row) => ({ endpoint: row.endpoint, subscriptionJson: row.subscription_json }));
}
