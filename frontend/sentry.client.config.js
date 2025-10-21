import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "https://12bed452098e2f35afccb553a993d76f@o4510228118372352.ingest.de.sentry.io/4510228120862800",
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/astro/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});