/**
 * Banner component to request notification permission
 * Shows a friendly banner when notifications are supported but not enabled
 */

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getNotificationPermission,
  requestNotificationPermissionWithFeedback,
  type NotificationPermissionState,
} from "@/lib/notifications";

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [dismissed, setDismissed] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this session
    const sessionDismissed = sessionStorage.getItem("notification-banner-dismissed");
    if (sessionDismissed) {
      setDismissed(true);
    }

    // Get initial permission state
    setPermission(getNotificationPermission());
  }, []);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    const granted = await requestNotificationPermissionWithFeedback();
    setIsRequesting(false);

    if (granted) {
      setPermission("granted");
    } else {
      setPermission("denied");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("notification-banner-dismissed", "true");
  };

  // Don't show if:
  // - User dismissed it
  // - Permission already granted
  // - Permission denied (user already made choice)
  // - Browser doesn't support notifications
  if (
    dismissed ||
    permission === "granted" ||
    permission === "denied" ||
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return null;
  }

  return (
    <Card className="mb-4 bg-blue-50 border-blue-200">
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">🔔 Povolit notifikace?</h3>
            <p className="text-sm text-blue-800">
              Budete informováni o dokončení zpracování dokumentů, i když pracujete v jiné záložce.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleEnableNotifications}
              disabled={isRequesting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRequesting ? "Povolování..." : "Povolit"}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Nyní ne
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
