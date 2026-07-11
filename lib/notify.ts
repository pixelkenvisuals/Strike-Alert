import webpush from "web-push";
import { getAllSubscriptions, removeSubscription } from "./db";
import type { StrikeEvent } from "./sources/types";

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

function titleFor(event: StrikeEvent): string {
  const sourceLabel: Record<StrikeEvent["source"], string> = {
    stib: "STIB",
    nmbs: "NMBS/SNCB",
    airport: "Brussels Airport",
    news: "News",
  };
  return `Strike alert: ${sourceLabel[event.source]}`;
}

/** Sends a push notification for each new event to every subscribed browser, pruning dead subscriptions. */
export async function notifySubscribers(events: StrikeEvent[]): Promise<void> {
  if (events.length === 0) return;
  if (!ensureConfigured()) return;

  const subscriptions = getAllSubscriptions();
  if (subscriptions.length === 0) return;

  for (const event of events) {
    const payload = JSON.stringify({
      title: titleFor(event),
      body: event.title,
      url: event.link ?? "/",
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(JSON.parse(sub.subscriptionJson), payload);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          removeSubscription(sub.endpoint);
        } else {
          console.error("[notify] Failed to send push notification:", err);
        }
      }
    }
  }
}
