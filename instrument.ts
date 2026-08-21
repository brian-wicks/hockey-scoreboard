import * as Sentry from "@sentry/node";

// Imported before serverApp.ts (and everything it pulls in) so Sentry is
// initialized before the app does any real work. Errors are reported via
// explicit Sentry.captureException calls and the Express error handler in
// serverApp.ts, not automatic instrumentation, so this only needs dsn/env.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
  });
}
