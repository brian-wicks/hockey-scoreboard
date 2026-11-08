import * as Sentry from "@sentry/node";
import { maskOperatorLinks } from "./src/lib/operatorAccess.ts";

// Imported before serverApp.ts (and everything it pulls in) so Sentry is
// initialized before the app does any real work. Errors are reported via
// explicit Sentry.captureException calls and the Express error handler in
// serverApp.ts, not automatic instrumentation, so this only needs dsn/env.
// Operator links are secrets in the URL, so they are masked in events and breadcrumbs.
// The RequestData integration also copies request headers and parsed cookies onto every
// event, so the owner's ID token and any cookie are masked there on every route.
// Express matches routes in any case, so this does too. Masking leaves the path in
// place, so the check works on a URL from before or after masking.
const isOperatorApiPath = (text: unknown): boolean => typeof text === "string" && /\/api\/operator\//i.test(text);

const HIDDEN = "[hidden]";
const CREDENTIAL_HEADERS = new Set(["authorization", "cookie", "set-cookie"]);

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const scrubbed = { ...headers };
  for (const name of Object.keys(scrubbed)) {
    if (CREDENTIAL_HEADERS.has(name.toLowerCase())) scrubbed[name] = HIDDEN;
  }
  return scrubbed;
}

function scrubCookies(cookies: unknown): Record<string, string> {
  if (cookies && typeof cookies === "object") {
    return Object.fromEntries(Object.keys(cookies).map((name) => [name, HIDDEN]));
  }
  // The SDK always parses these into an object, but the event type can't promise that.
  return HIDDEN as unknown as Record<string, string>;
}

export function scrubEvent<T extends Sentry.Event>(event: T): T {
  const request = event.request;
  // Sentry attaches incoming request bodies, and the body on these routes holds the PIN.
  if (request && (isOperatorApiPath(request.url) || isOperatorApiPath(event.transaction))) delete request.data;
  if (request?.url) request.url = maskOperatorLinks(request.url);
  if (typeof request?.query_string === "string") request.query_string = maskOperatorLinks(request.query_string);
  if (event.transaction) event.transaction = maskOperatorLinks(event.transaction);
  if (typeof request?.headers?.referer === "string") request.headers.referer = maskOperatorLinks(request.headers.referer);
  if (request?.headers) request.headers = scrubHeaders(request.headers);
  if (request?.cookies !== undefined) request.cookies = scrubCookies(request.cookies);
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

type Integration = Exclude<NonNullable<Sentry.NodeOptions["integrations"]>, (...args: never[]) => unknown>[number];

// Stops the SDK capturing these bodies at all. scrubEvent still removes them, in case
// an event reaches it some other way.
export function filterOperatorBodies(defaults: Integration[]): Integration[] {
  return defaults.map((integration) =>
    integration.name === "Http"
      ? Sentry.httpIntegration({ ignoreIncomingRequestBody: (url) => isOperatorApiPath(url) })
      : integration,
  );
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
      filterOperatorBodies(defaults).map((integration) =>
        integration.name === "OnUncaughtException"
          ? Sentry.onUncaughtExceptionIntegration({ exitEvenIfOtherHandlersAreRegistered: false })
          : integration,
      ),
  });
}
