/**
 * Browser Notification utilities
 * No backend or external services required - uses Web Notifications API
 */

export type NotificationPermissionState = "granted" | "denied" | "default";

/**
 * Request notification permission from the user
 * Should be called on user interaction (e.g., button click)
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  // Check if notifications are supported
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return "denied";
  }

  // If already granted, return immediately
  if (Notification.permission === "granted") {
    return "granted";
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionState;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return "denied";
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.permission as NotificationPermissionState;
}

interface ShowNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

/**
 * Show a browser notification
 * Automatically requests permission if not already granted
 */
export async function showNotification(options: ShowNotificationOptions): Promise<void> {
  // Check browser support
  if (!("Notification" in window)) {
    console.warn("Notifications not supported");
    return;
  }

  // Request permission if needed
  if (Notification.permission === "default") {
    const permission = await requestNotificationPermission();
    if (permission !== "granted") {
      console.warn("Notification permission not granted");
      return;
    }
  }

  // Don't show if permission denied
  if (Notification.permission !== "granted") {
    return;
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || "/pwa-192x192.png",
      badge: options.badge || "/pwa-64x64.png",
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    });

    // Handle click event
    if (options.onClick) {
      notification.onclick = () => {
        options.onClick?.();
        notification.close();
      };
    }

    // Auto-close after 10 seconds if not requireInteraction
    if (!options.requireInteraction) {
      setTimeout(() => notification.close(), 10000);
    }
  } catch (error) {
    console.error("Error showing notification:", error);
  }
}

/**
 * Show notification for completed document processing
 */
export async function notifyProcessingComplete(documentName?: string): Promise<void> {
  await showNotification({
    title: "✅ Zpracování dokončeno",
    body: documentName
      ? `Dokument "${documentName}" byl úspěšně zpracován`
      : "Dokument byl úspěšně zpracován",
    tag: "processing-complete",
    requireInteraction: false,
    onClick: () => {
      // Focus the window when notification is clicked
      window.focus();
    },
  });
}

/**
 * Show notification for failed document processing
 */
export async function notifyProcessingFailed(error?: string): Promise<void> {
  await showNotification({
    title: "❌ Zpracování selhalo",
    body: error || "Při zpracování dokumentu došlo k chybě",
    tag: "processing-failed",
    requireInteraction: true,
    onClick: () => {
      window.focus();
    },
  });
}

/**
 * Request permission with a user-friendly approach
 * Call this when user starts an upload or on app load
 */
export async function requestNotificationPermissionWithFeedback(): Promise<boolean> {
  const permission = await requestNotificationPermission();

  if (permission === "granted") {
    // Show a test notification to confirm it works
    await showNotification({
      title: "🔔 Notifikace aktivovány",
      body: "Budete informováni o dokončení zpracování dokumentů",
      tag: "permission-granted",
    });
    return true;
  }

  return false;
}
