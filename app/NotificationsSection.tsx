"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { NotificationToggle } from "./NotificationToggle";

type SupportStatus = "loading" | "unsupported" | "blocked" | "ready";

export function NotificationsSection() {
  const { t } = useLanguage();
  const [supportStatus, setSupportStatus] = useState<SupportStatus>("loading");

  useEffect(() => {
    const status: SupportStatus =
      !("serviceWorker" in navigator) || !("PushManager" in window)
        ? "unsupported"
        : Notification.permission === "denied"
          ? "blocked"
          : "ready";
    // One-time read of browser capability/permission state on mount — there's no
    // props/state this could be derived from instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupportStatus(status);
  }, []);

  if (supportStatus === "loading") return null;

  if (supportStatus === "unsupported") {
    return <p className="text-sm text-zinc-500">{t("notificationsUnsupported")}</p>;
  }

  if (supportStatus === "blocked") {
    return <p className="text-sm text-amber-600">{t("notificationsBlocked")}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NotificationToggle
        category="strike"
        enableLabelKey="enableStrikeNotifications"
        disableLabelKey="disableStrikeNotifications"
      />
      <NotificationToggle
        category="construction"
        enableLabelKey="enableConstructionNotifications"
        disableLabelKey="disableConstructionNotifications"
      />
    </div>
  );
}
