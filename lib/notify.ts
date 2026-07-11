import webpush from "web-push";
import { getSubscriptionsForCategory, removeSubscription } from "./db";
import type { Category, StrikeEvent } from "./sources/types";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contactEmail = process.env.VAPID_CONTACT_EMAIL || "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    console.warn(
      "[notify] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications are disabled. Run `npm run generate-vapid-keys`."
    );
    return false;
  }

  webpush.setVapidDetails(contactEmail, publicKey, privateKey);
  configured = true;
  return true;
}

function notificationTitle(category: Category, count: number): string {
  if (category === "strike") {
    return count === 1 ? "Strike alert" : `${count} new strike alerts`;
  }
  return count === 1 ? "Construction/roadwork update" : `${count} new construction updates`;
}

function notificationBody(events: StrikeEvent[]): string {
  const preview = events.slice(0, 3).map((e) => e.title);
  const remaining = events.length - preview.length;
  const suffix = remaining > 0 ? ` (+${remaining} more)` : "";
  return preview.join(" • ") + suffix;
}

/**
 * Sends one push notification per poll run per category (not one per event) —
 * STIB/NMBS construction feeds alone can surface dozens of "new" items in a single
 * run, so a single summarized notification avoids flooding subscribers.
 */
export async function notifySubscribers(events: StrikeEvent[], category: Category): Promise<void> {
  if (events.length === 0) return;
  if (!ensureConfigured()) return;

  const subscriptions = await getSubscriptionsForCategory(category);
  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title: notificationTitle(category, events.length),
    body: notificationBody(events),
    url: events[0].link ?? "/",
  });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(JSON.parse(sub.subscriptionJson), payload);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await removeSubscription(sub.endpoint);
      } else {
        console.error("[notify] Failed to send push notification:", err);
      }
    }
  }
}
