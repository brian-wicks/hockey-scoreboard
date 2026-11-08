import * as Sentry from "@sentry/node";
import { maskOperatorLinks } from "./src/lib/operatorAccess.ts";

// Imported before serverApp.ts (and everything it pulls in) so Sentry is
// initialized before the app does any real work. Errors are reported via
// explicit Sentry.captureException calls and the Express error handler in
// serverApp.ts, not automatic instrumentation, so this only needs dsn/env.
// Operator links are secrets in the URL, so they are masked in events and breadcrumbs.
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request?.url) event.request.url = maskOperatorLinks(event.request.url);
  if (event.transaction) event.transaction = maskOperatorLinks(event.transaction);
  if (event.request?.headers?.referer) event.request.headers.referer = maskOperatorLinks(event.request.headers.referer);
  event.breadcrumbs?.forEach(scrubBreadcrumb);
  return event;
}

export function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (typeof breadcrumb.message === "string") breadcrumb.message = maskOperatorLinks(breadcrumb.message);
  if (breadcrumb.data) {
    for (const key of ["url", "from", "to"]) {
      if (typeof breadcrumb.data[key] === "string") breadcrumb.data[key] = maskOperatorLinks(breadcrumb.data[key]);
    }
  }
  return breadcrumb;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
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
