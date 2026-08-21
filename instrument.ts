import * as Sentry from "@sentry/node";

// Imported before serverApp.ts (and everything it pulls in) so Sentry is
// initialized before the app does any real work. Errors are reported via
// explicit Sentry.captureException calls and the Express error handler in
// serverApp.ts, not automatic instrumentation, so this only needs dsn/env.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    // Sentry's default OnUncaughtException integration reports the error and then
    // exits the process — appropriate for most apps, but this server holds every
    // connected user's live game state in memory, so one client's bad input taking
    // down the process takes every other user's game down with it. The handlers in
    // serverApp.ts/server.ts are the real fix (catch and sanitize instead of
    // throwing), this just stops Sentry from exiting on whatever they didn't catch.
    integrations: (defaults) =>
      defaults.map((integration) =>
        integration.name === "OnUncaughtException"
          ? Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false })
          : integration,
      ),
  });
}
