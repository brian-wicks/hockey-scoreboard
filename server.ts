import "dotenv/config";
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
});
