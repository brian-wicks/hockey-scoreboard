import "dotenv/config";
import { findMissingFirebaseEnvVars, formatMissingEnvError } from "./env-check.ts";
import { isLocalModeEnv } from "./src/lib/localMode.ts";

const localMode = isLocalModeEnv(process.env);

// Local mode disables authentication outright (src/lib/localMode.ts), which is
// only defensible on a single offline machine. Refuse to pair it with a
// production build rather than trust that nobody sets both by accident.
if (localMode && process.env.NODE_ENV === "production") {
  console.error(
    "\nLOCAL_MODE cannot be used with NODE_ENV=production: it disables " +
      "authentication entirely. Unset one of them and restart.\n",
  );
  process.exit(1);
}

// Local mode never talks to Firebase, so its config isn't required to start.
if (!localMode) {
  const missingFirebaseVars = findMissingFirebaseEnvVars(process.env);
  if (missingFirebaseVars.length > 0) {
    console.error(`\n${formatMissingEnvError(missingFirebaseVars)}\n`);
    process.exit(1);
  }
}

import "./instrument.ts";
import * as Sentry from "@sentry/node";
import { createScoreboardServer } from "./serverApp.ts";

// Last-resort safety net: this process holds every connected user's live game state
// in memory, so an uncaught error crashing it takes every user's game down at once,
// not just whoever triggered it. serverApp.ts already catches and sanitizes the
// known failure points (socket handlers, the clock tick interval); this just makes
// sure nothing unanticipated can still take the whole server down silently.
process.on("uncaughtException", (error) => {
  console.error("[Process] Uncaught exception (server continuing):", error);
  Sentry.captureException(error);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled rejection (server continuing):", reason);
  Sentry.captureException(reason);
});

const PORT = process.env.PORT || 3696;

const server = createScoreboardServer();
server.start(Number(PORT)).then((port) => {
  console.log(`Server running on http://localhost:${port}`);
  if (localMode) {
    console.log("[Local mode] Running offline as the local operator; data stays in this machine's database.");
  }
});
