import type { Express, RequestHandler } from "express";
import { randomUUID } from "crypto";
import rateLimit from "express-rate-limit";
import type { Server } from "socket.io";
import {
  deleteOperatorAccess,
  getOperatorAccess,
  getUserOperatorAccess,
  setOperatorAccess,
} from "../db/database.ts";
import { isValidOperatorPin } from "../lib/operatorAccess.ts";
import {
  MAX_FAILED_PIN_ATTEMPTS,
  PIN_LOCK_MS,
  generatePin,
  hasValidDeviceToken,
  hashPin,
  isValidOperatorId,
  issueDeviceToken,
  verifyPin,
} from "./operatorCredentials.ts";

const SESSION_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_LIMIT = 30;

export interface OperatorAccessOptions {
  app: Express;
  io: Server;
  authenticate: RequestHandler;
  creationLimiter: RequestHandler;
  localMode: boolean;
  now: () => number;
  logError: (msg: string, error: unknown, context?: Record<string, unknown>) => void;
}

export function registerOperatorAccess({
  app,
  io,
  authenticate,
  creationLimiter,
  localMode,
  now,
  logError,
}: OperatorAccessOptions): { authenticateHandshake(operatorId: unknown, token: unknown): Promise<string | null> } {
  // Local mode has one operator and no way to tell two people apart, and its server
  // only listens on loopback. The explicit 404 stops GETs reaching the SPA catch-all.
  if (localMode) {
    app.use(["/api/operator-access", "/api/operator"], (_req, res) => {
      res.status(404).json({ error: "Not found" });
    });
    return { authenticateHandshake: async () => null };
  }

  // Every read-then-write of a record runs through this queue. Parallel PIN guesses
  // can't all see the same attempt count, and a guess in flight can't save its stale
  // copy over a new PIN or bring back a removed record.
  const queues = new Map<string, Promise<unknown>>();
  function runExclusive<T>(operatorId: string, task: () => Promise<T>): Promise<T> {
    const previous = queues.get(operatorId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.catch(() => undefined);
    queues.set(operatorId, settled);
    void settled.then(() => {
      if (queues.get(operatorId) === settled) queues.delete(operatorId);
    });
    return run;
  }

  async function disconnectOperators(userId: string) {
    const sockets = await io.in(userId).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.isOperator) socket.disconnect(true);
    }
  }

  const sessionLimiter = rateLimit({
    windowMs: SESSION_LIMIT_WINDOW_MS,
    limit: SESSION_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later.", retryAfterSeconds: SESSION_LIMIT_WINDOW_MS / 1000 },
  });

  app.get("/api/operator-access", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const access = await getUserOperatorAccess(userId);
      res.json({ operatorId: access?.operatorId ?? null });
    } catch (error) {
      logError("Error reading operator access", error, { userId });
      res.status(500).json({ error: "Failed to read operator access" });
    }
  });

  app.post("/api/operator-access", creationLimiter, authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      // The whole request holds the owner's lock, so two requests can't both see no
      // record and pick different links, and a removal can't be undone by a request
      // that read the record before it. Lock order is always owner, then operator.
      const result = await runExclusive(`user:${userId}`, async () => {
        const existing = await getUserOperatorAccess(userId);
        const operatorId = existing?.operatorId ?? randomUUID();
        const pin = generatePin();
        const credentials = await hashPin(pin);
        await runExclusive(operatorId, () =>
          setOperatorAccess({ operatorId, userId, ...credentials, failedAttempts: 0, lockedUntil: null, tokens: [] }),
        );
        return { operatorId, pin };
      });
      await disconnectOperators(userId);
      res.json(result);
    } catch (error) {
      logError("Error saving operator access", error, { userId });
      res.status(500).json({ error: "Failed to save operator access" });
    }
  });

  app.delete("/api/operator-access", authenticate, async (req, res) => {
    const userId = (req as any).user.uid;
    try {
      await runExclusive(`user:${userId}`, async () => {
        const existing = await getUserOperatorAccess(userId);
        if (existing) {
          await runExclusive(existing.operatorId, () => deleteOperatorAccess(userId));
        }
      });
      await disconnectOperators(userId);
      res.json({ success: true });
    } catch (error) {
      logError("Error removing operator access", error, { userId });
      res.status(500).json({ error: "Failed to remove operator access" });
    }
  });

  app.post("/api/operator/:operatorId/session", sessionLimiter, async (req, res) => {
    const { operatorId } = req.params;
    if (!isValidOperatorId(operatorId)) {
      res.status(404).json({ error: "Unknown link" });
      return;
    }
    const pin: unknown = req.body?.pin;
    if (!isValidOperatorPin(pin)) {
      res.status(400).json({ error: "PIN must be six digits" });
      return;
    }

    try {
      await runExclusive(operatorId, async () => {
        const access = await getOperatorAccess(operatorId);
        if (!access) {
          res.status(404).json({ error: "Unknown link" });
          return;
        }

        const nowMs = now();
        if (access.lockedUntil !== null && access.lockedUntil > nowMs) {
          res.status(429).json({
            error: "Too many wrong PINs",
            retryAfterSeconds: Math.ceil((access.lockedUntil - nowMs) / 1000),
          });
          return;
        }

        if (await verifyPin(pin, access)) {
          const { token, tokens } = issueDeviceToken(access.tokens, nowMs);
          await setOperatorAccess({ ...access, failedAttempts: 0, lockedUntil: null, tokens });
          res.json({ token });
          return;
        }

        // A lock that has run out starts a new count.
        const failedAttempts = (access.lockedUntil === null ? access.failedAttempts : 0) + 1;
        if (failedAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
          await setOperatorAccess({ ...access, failedAttempts, lockedUntil: nowMs + PIN_LOCK_MS });
          res.status(429).json({ error: "Too many wrong PINs", retryAfterSeconds: PIN_LOCK_MS / 1000 });
          return;
        }
        await setOperatorAccess({ ...access, failedAttempts, lockedUntil: null });
        res.status(401).json({ error: "Wrong PIN", attemptsLeft: MAX_FAILED_PIN_ATTEMPTS - failedAttempts });
      });
    } catch (error) {
      logError("Error checking operator PIN", error);
      res.status(500).json({ error: "Failed to check PIN" });
    }
  });

  return {
    async authenticateHandshake(operatorId: unknown, token: unknown): Promise<string | null> {
      if (!isValidOperatorId(operatorId) || typeof token !== "string") return null;
      const access = await getOperatorAccess(operatorId);
      return access && hasValidDeviceToken(access.tokens, token, now()) ? access.userId : null;
    },
  };
}
