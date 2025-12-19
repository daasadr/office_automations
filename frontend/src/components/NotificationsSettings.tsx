/**
 * Notifications Settings Component
 * Allows users to manage browser notification permissions
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getNotificationPermission,
  type NotificationPermissionState,
  requestNotificationPermissionWithFeedback,
} from "@/lib/notifications";

export default function NotificationsSettings() {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check browser support
    if (typeof window !== "undefined" && "Notification" in window) {
      setIsSupported(true);
      setPermission(getNotificationPermission());
    } else {
      setIsSupported(false);
    }
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

  const getStatusInfo = () => {
    if (!isSupported) {
      return {
        title: "Notifikace nejsou podporovány",
        description: "Váš prohlížeč nepodporuje notifikace.",
        color: "gray",
        icon: "❌",
      };
    }

    switch (permission) {
      case "granted":
        return {
          title: "Notifikace jsou povoleny",
          description:
            "Budete informováni o dokončení zpracování dokumentů, i když pracujete v jiné záložce.",
          color: "green",
          icon: "✅",
        };
      case "denied":
        return {
          title: "Notifikace jsou zakázány",
          description: "Pro povolení notifikací je nutné změnit nastavení v prohlížeči.",
          color: "red",
          icon: "🔕",
        };
      default:
        return {
          title: "Notifikace nejsou povoleny",
          description: "Povolte notifikace pro informování o dokončení zpracování dokumentů.",
          color: "yellow",
          icon: "🔔",
        };
    }
  };

  const statusInfo = getStatusInfo();

  const getCardClassName = () => {
    const baseClass = "p-6 rounded-lg border shadow-sm";
    switch (statusInfo.color) {
      case "green":
        return `${baseClass} bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900`;
      case "red":
        return `${baseClass} bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900`;
      case "yellow":
        return `${baseClass} bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900`;
      default:
        return `${baseClass} bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-700`;
    }
  };

  const getTitleClassName = () => {
    switch (statusInfo.color) {
      case "green":
        return "text-xl font-semibold mb-2 text-green-900 dark:text-green-100";
      case "red":
        return "text-xl font-semibold mb-2 text-red-900 dark:text-red-100";
      case "yellow":
        return "text-xl font-semibold mb-2 text-yellow-900 dark:text-yellow-100";
      default:
        return "text-xl font-semibold mb-2";
    }
  };

  const getDescriptionClassName = () => {
    switch (statusInfo.color) {
      case "green":
        return "text-sm text-green-800 dark:text-green-200 mb-4";
      case "red":
        return "text-sm text-red-800 dark:text-red-200 mb-4";
      case "yellow":
        return "text-sm text-yellow-800 dark:text-yellow-200 mb-4";
      default:
        return "text-sm text-muted-foreground mb-4";
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={getCardClassName()}>
        <div className="flex items-start gap-4">
          <div className="text-3xl">{statusInfo.icon}</div>
          <div className="flex-1">
            <h2 className={getTitleClassName()}>{statusInfo.title}</h2>
            <p className={getDescriptionClassName()}>{statusInfo.description}</p>

            {/* Enable button for default state */}
            {permission === "default" && isSupported && (
              <div className="space-y-3">
                <Button
                  onClick={handleEnableNotifications}
                  disabled={isRequesting}
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {isRequesting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Povolování...
                    </>
                  ) : (
                    <>🔔 Povolit notifikace pro tuto aplikaci</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Po kliknutí se zobrazí výzva prohlížeče k povolení notifikací
                </p>
              </div>
            )}

            {/* Instructions for denied state */}
            {permission === "denied" && (
              <div className="space-y-3">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                    Jak povolit notifikace v prohlížeči:
                  </h3>
                  <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground ml-2">
                    <li>
                      <strong>Chrome/Edge:</strong> Klikněte na ikonu zámku v adresním řádku →
                      Nastavení webu → Notifikace → Povolit
                    </li>
                    <li>
                      <strong>Firefox:</strong> Klikněte na ikonu zámku → Další informace →
                      Oprávnění → Notifikace → Povolit
                    </li>
                    <li>
                      <strong>Safari:</strong> Safari → Předvolby → Webové stránky → Notifikace →
                      Povolit pro tuto stránku
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Obnovit stránku
                </Button>
                <p className="text-xs text-muted-foreground">
                  Po povolení notifikací v prohlížeči klikněte na tlačítko pro obnovení stránky
                </p>
              </div>
            )}

            {/* Test notification button for granted state */}
            {permission === "granted" && (
              <div className="space-y-2">
                <Button
                  onClick={handleEnableNotifications}
                  disabled={isRequesting}
                  variant="outline"
                  className="font-semibold"
                >
                  {isRequesting ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Odesílání...
                    </>
                  ) : (
                    <>🧪 Odeslat testovací notifikaci</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ověřte, že notifikace fungují správně
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">O notifikacích</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Kdy obdržíte notifikaci?</strong>
            <br />
            Notifikace vás upozorní, když je dokončeno zpracování dokumentu. To vám umožní pracovat
            v jiné záložce nebo aplikaci, zatímco se dokument zpracovává.
          </p>
          <p>
            <strong>Soukromí:</strong>
            <br />
            Notifikace jsou plně klientské a používají standardní API prohlížeče. Žádné údaje nejsou
            odesílány na externí servery.
          </p>
          <p>
            <strong>Kompatibilita:</strong>
            <br />
            Notifikace jsou podporovány ve všech moderních prohlížečích (Chrome, Firefox, Edge,
            Safari 16+).
          </p>
        </div>
      </Card>
    </div>
  );
}
