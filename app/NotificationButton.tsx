"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "unsupported" | "loading" | "subscribed" | "unsubscribed" | "blocked";

export function NotificationButton() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    async function checkStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("blocked");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "unsubscribed");
    }
    checkStatus().catch(() => setStatus("unsupported"));
  }, []);

  async function subscribe() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("blocked");
      return;
    }

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
      body: JSON.stringify(subscription),
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
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }

  if (status === "loading") return null;

  if (status === "unsupported") {
    return <p className="text-sm text-zinc-500">{t("notificationsUnsupported")}</p>;
  }

  if (status === "blocked") {
    return <p className="text-sm text-amber-600">{t("notificationsBlocked")}</p>;
  }

  if (status === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {t("disableNotifications")}
      </button>
    );
  }

  return (
    <button
      onClick={subscribe}
      className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
    >
      {t("enableNotifications")}
    </button>
  );
}
