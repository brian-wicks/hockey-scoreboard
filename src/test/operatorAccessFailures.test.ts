// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { randomUUID } from "crypto";

const db = vi.hoisted(() => ({
  getOperatorAccess: vi.fn(),
  getUserOperatorAccess: vi.fn(),
  setOperatorAccess: vi.fn(),
  deleteOperatorAccess: vi.fn(),
}));
vi.mock("../db/database.ts", () => db);
vi.mock("../server/operatorCredentials.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/operatorCredentials.ts")>();
  return { ...actual, verifyPin: vi.fn(actual.verifyPin) };
});

import { registerOperatorAccess } from "../server/operatorAccess";
import { hashPin, verifyPin } from "../server/operatorCredentials";

describe("second operator access when the database fails", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  const logError = vi.fn();
  const operatorId = randomUUID();

  const postPin = (pin: string) =>
    fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

  beforeEach(async () => {
    vi.clearAllMocks();
    const app = express();
    app.use(express.json());
    registerOperatorAccess({
      app,
      io: { in: () => ({ fetchSockets: async () => [] }) } as any,
      authenticate: (_req, _res, next) => next(),
      creationLimiter: (_req, _res, next) => next(),
      localMode: false,
      now: Date.now,
      logError,
    });
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
  });

  const storedAccess = async () => ({
    operatorId,
    userId: "user-1",
    ...(await hashPin("123456")),
    failedAttempts: 0,
    lockedUntil: null,
    tokens: [],
  });

  it("refuses the PIN when a failed attempt can't be saved", async () => {
    db.getOperatorAccess.mockResolvedValue(await storedAccess());
    db.setOperatorAccess.mockRejectedValue(new Error("write failed"));
    expect((await postPin("654321")).status).toBe(500);
    expect(logError).toHaveBeenCalled();
  });

  it("returns 500 and writes nothing when the record can't be read", async () => {
    db.getOperatorAccess.mockRejectedValue(new Error("read failed"));
    expect((await postPin("654321")).status).toBe(500);
    expect(db.setOperatorAccess).not.toHaveBeenCalled();
  });

  it("issues no token when it can't be saved", async () => {
    db.getOperatorAccess.mockResolvedValue(await storedAccess());
    db.setOperatorAccess.mockRejectedValue(new Error("write failed"));
    const res = await postPin("123456");
    expect(res.status).toBe(500);
    expect((await res.json()).token).toBeUndefined();
  });

  it("does not log the PIN, or the link in its context", async () => {
    db.getOperatorAccess.mockRejectedValue(new Error("read failed"));
    await postPin("654321");
    expect(JSON.stringify(logError.mock.calls)).not.toContain("654321");
    expect(JSON.stringify(logError.mock.calls)).not.toContain(operatorId);
  });

  it("says there is no PIN without running scrypt or counting an attempt", async () => {
    db.getOperatorAccess.mockResolvedValue({ ...(await storedAccess()), pinHash: "", pinSalt: "" });
    const res = await postPin("654321");
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "No PIN for this game" });
    expect(verifyPin).not.toHaveBeenCalled();
    expect(db.setOperatorAccess).not.toHaveBeenCalled();
  });

  describe("resetForNewGame", () => {
    const disconnect = vi.fn();
    const fetchSockets = vi.fn();
    const failure = new Error("database fault");

    const register = (localMode = false) =>
      registerOperatorAccess({
        app: express(),
        io: { in: () => ({ fetchSockets }) } as any,
        authenticate: (_req, _res, next) => next(),
        creationLimiter: (_req, _res, next) => next(),
        localMode,
        now: Date.now,
        logError,
      });

    const record = () => ({
      operatorId,
      userId: "user-1",
      pinHash: "hash",
      pinSalt: "salt",
      failedAttempts: 3,
      lockedUntil: 12345,
      tokens: [{ tokenHash: "token-hash", expiresAt: 99 }],
    });

    beforeEach(() => {
      db.setOperatorAccess.mockReset();
      db.setOperatorAccess.mockResolvedValue(undefined);
      db.getUserOperatorAccess.mockReset();
      fetchSockets.mockReset();
      fetchSockets.mockResolvedValue([{ data: { isOperator: true }, disconnect }, { data: {}, disconnect: vi.fn() }]);
    });

    it("clears the PIN, tokens and lock, keeps the link, then signs second operators out", async () => {
      db.getUserOperatorAccess.mockResolvedValue(record());
      const order: string[] = [];
      db.setOperatorAccess.mockImplementation(async () => void order.push("write"));
      fetchSockets.mockImplementation(async () => {
        order.push("disconnect");
        return [{ data: { isOperator: true }, disconnect }];
      });

      await register().resetForNewGame("user-1");

      expect(db.setOperatorAccess).toHaveBeenCalledWith({
        operatorId,
        userId: "user-1",
        pinHash: "",
        pinSalt: "",
        pin: null,
        failedAttempts: 0,
        lockedUntil: null,
        tokens: [],
      });
      expect(order).toEqual(["write", "disconnect"]);
      expect(disconnect).toHaveBeenCalledWith(true);
    });

    it("does nothing when the user has no record", async () => {
      db.getUserOperatorAccess.mockResolvedValue(null);
      await register().resetForNewGame("user-1");
      expect(db.setOperatorAccess).not.toHaveBeenCalled();
      expect(fetchSockets).not.toHaveBeenCalled();
    });

    it("does nothing in local mode", async () => {
      await register(true).resetForNewGame("user-1");
      expect(db.getUserOperatorAccess).not.toHaveBeenCalled();
      expect(fetchSockets).not.toHaveBeenCalled();
    });

    it("logs a failed write with the user ID alone and still signs second operators out", async () => {
      db.getUserOperatorAccess.mockResolvedValue(record());
      db.setOperatorAccess.mockRejectedValue(failure);
      await expect(register().resetForNewGame("user-1")).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(expect.any(String), failure, { userId: "user-1" });
      expect(disconnect).toHaveBeenCalledWith(true);
    });

    it("logs a failed read with the user ID alone and still signs second operators out", async () => {
      db.getUserOperatorAccess.mockRejectedValue(failure);
      await expect(register().resetForNewGame("user-1")).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(expect.any(String), failure, { userId: "user-1" });
      expect(disconnect).toHaveBeenCalledWith(true);
    });

    it("never rejects when signing out fails", async () => {
      db.getUserOperatorAccess.mockResolvedValue(record());
      fetchSockets.mockRejectedValue(failure);
      await expect(register().resetForNewGame("user-1")).resolves.toBeUndefined();
      expect(logError).toHaveBeenCalledWith(expect.any(String), failure, { userId: "user-1" });
    });

  });

  describe("owner requests racing each other", () => {
    let ownerBase: string;
    let ownerServer: HttpServer;
    let stored: any;
    const writes: any[] = [];

    const ownerRequest = (method: string) => fetch(`${ownerBase}/api/operator-access`, { method });
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

    beforeEach(async () => {
      stored = null;
      writes.length = 0;
      // An in-memory record. The reads are slow on purpose, so a request that
      // reads outside a lock gets overtaken by another one.
      db.getUserOperatorAccess.mockImplementation(async () => {
        const snapshot = stored;
        await tick();
        return snapshot;
      });
      db.setOperatorAccess.mockImplementation(async (access: any) => {
        await tick();
        writes.push(access);
        stored = access;
      });
      db.deleteOperatorAccess.mockImplementation(async () => {
        await tick();
        stored = null;
      });
      const app = express();
      app.use(express.json());
      registerOperatorAccess({
        app,
        io: { in: () => ({ fetchSockets: async () => [] }) } as any,
        authenticate: (req, _res, next) => {
          (req as any).user = { uid: "user-1" };
          next();
        },
        creationLimiter: (_req, _res, next) => next(),
        localMode: false,
        now: Date.now,
        logError,
      });
      ownerServer = createServer(app);
      await new Promise<void>((resolve) => ownerServer.listen(0, "127.0.0.1", resolve));
      ownerBase = `http://127.0.0.1:${(ownerServer.address() as AddressInfo).port}`;
    });

    afterEach(async () => {
      await new Promise((resolve) => ownerServer.close(resolve));
    });

    it("gives two first-time requests the same link", async () => {
      const results = await Promise.all([ownerRequest("POST"), ownerRequest("POST")]);
      const bodies = await Promise.all(results.map((res) => res.json()));
      expect(new Set(writes.map((access) => access.operatorId)).size).toBe(1);
      expect(bodies[0].operatorId).toBe(bodies[1].operatorId);
    });

    it("never brings back a link that a removal has finished removing", async () => {
      const { operatorId } = await (await ownerRequest("POST")).json();
      await Promise.all([ownerRequest("DELETE"), ownerRequest("POST")]);
      // Run one after the other, the result is either no record (the POST came first)
      // or a new link (the DELETE came first). The old link coming back means the
      // POST wrote a record based on a read from before the removal.
      if (stored) expect(stored.operatorId).not.toBe(operatorId);
    });
  });
});
