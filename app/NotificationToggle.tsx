"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { Category } from "@/lib/sources/types";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "loading" | "subscribed" | "unsubscribed";

interface NotificationToggleProps {
  category: Category;
  enableLabelKey: string;
  disableLabelKey: string;
}

/**
 * Toggles push notifications for one category on the browser's single underlying
 * PushSubscription. Categories are tracked server-side per endpoint, so disabling
 * one category never touches the browser subscription itself — that only happens
 * to register it in the first place.
 */
export function NotificationToggle({ category, enableLabelKey, disableLabelKey }: NotificationToggleProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    async function checkStatus() {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!existing) {
        setStatus("unsubscribed");
        return;
      }
      const res = await fetch(`/api/subscribe?endpoint=${encodeURIComponent(existing.endpoint)}`);
      const { categories } = (await res.json()) as { categories: Category[] };
      setStatus(categories.includes(category) ? "subscribed" : "unsubscribed");
    }
    checkStatus().catch(() => setStatus("unsubscribed"));
  }, [category]);

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const keyRes = await fetch("/api/vapid-public-key");
    const { publicKey } = (await keyRes.json()) as { publicKey: string | null };
    if (!publicKey) {
      console.error("No VAPID public key configured on the server.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, category }),
    });

    setStatus("subscribed");
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, category }),
      });
    }
    setStatus("unsubscribed");
  }

  if (status === "loading") return null;

  if (status === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t(disableLabelKey)}
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
    >
      {t(enableLabelKey)}
    </button>
  );
}
