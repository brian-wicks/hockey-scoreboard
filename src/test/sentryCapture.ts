import * as Sentry from "@sentry/node";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";

let httpServer: HttpServer;

export const closeCapture = async () => {
  await new Promise((resolve) => httpServer.close(resolve));
  await Sentry.close();
};

/**
 * Runs the real SDK over a real server, with an operator route and another route both
 * failing while the JSON body is in hand, and returns the envelopes it would have sent.
 * The SDK sets up its HTTP integration once per process, so a test file can only try
 * one set of HTTP integration options.
 */
export const captureFromPosts = async (operatorId: string, options: Partial<Sentry.NodeOptions>) => {
  const sent: string[] = [];
  Sentry.init({
    dsn: "https://key@example.invalid/1",
    transport: () => ({
      send: async (envelope) => {
        sent.push(JSON.stringify(envelope));
        return {};
      },
      flush: async () => true,
    }),
    ...options,
  });
  const app = express();
  app.use(express.json());
  app.post("/api/*path", (_req, res) => {
    Sentry.captureException(new Error("database fault"));
    res.status(500).json({});
  });
  httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  await post(`/api/operator/${operatorId}/session`, { pin: "123456" });
  await post("/api/shortcuts", { marker: "kept-body" });
  await Sentry.flush(2000);
  return sent;
};
