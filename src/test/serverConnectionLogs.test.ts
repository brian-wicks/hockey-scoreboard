// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { io as createClient, type Socket } from "socket.io-client";

// Every line the server logs, so these tests can check what a problem at the rink leaves behind.
const logs = vi.hoisted(() => [] as { level: string; fields: Record<string, unknown>; msg: string }[]);

vi.mock("pino", () => {
  const record = (level: string) => (fieldsOrMsg: unknown, msg?: string) => {
    if (typeof fieldsOrMsg === "string") logs.push({ level, fields: {}, msg: fieldsOrMsg });
    else logs.push({ level, fields: (fieldsOrMsg ?? {}) as Record<string, unknown>, msg: msg ?? "" });
  };
  const logger = { info: record("info"), warn: record("warn"), error: record("error"), debug: () => {}, trace: () => {}, fatal: record("fatal") };
  return { default: () => logger };
});
vi.mock("pino-http", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn(async (token: string) => {
      if (token.startsWith("log-user-")) return { uid: token };
      throw new Error("invalid token");
    }),
  })),
}));
// A share link whose lookup hits a database fault.
vi.mock("../db/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/database")>();
  return {
    ...actual,
    getShareUserId: vi.fn(async (shareId: string) => {
      if (shareId === "database-down") throw new Error("database fault");
      return actual.getShareUserId(shareId);
    }),
  };
});

describe("server connection logs", () => {
  let server: { start: (port: number) => Promise<number>; stop: () => Promise<void> };
  let baseUrl: string;
  let dataDir: string;

  beforeAll(async () => {
    const { createScoreboardServer } = await import("../../serverApp");
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-logs-"));
    server = createScoreboardServer({ dataDir });
    baseUrl = `http://127.0.0.1:${await server.start(0)}`;
  });

  afterAll(async () => {
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    logs.length = 0;
  });

  const connect = (auth: Record<string, unknown>, transports: ("polling" | "websocket")[] = ["websocket"]) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = createClient(baseUrl, { auth, transports, reconnection: false });
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });

  const logged = (msg: string) =>
    vi.waitFor(() => {
      const line = logs.find((entry) => entry.msg === msg);
      if (!line) throw new Error(`Nothing logged as "${msg}"`);
      return line;
    });

  it("logs why a screen disconnected, how long it was connected, and over what", async () => {
    const socket = await connect({ token: "log-user-1" });
    const socketId = socket.id;
    socket.close();

    const line = await logged("User disconnected from socket");
    expect(line.fields).toMatchObject({
      userId: "log-user-1",
      socketId,
      reason: "client namespace disconnect",
      transport: "websocket",
      connectedMs: expect.any(Number),
    });
  });

  it("logs a screen moving from polling to a WebSocket", async () => {
    const socket = await connect({ token: "log-user-2" }, ["polling", "websocket"]);
    expect((await logged("User connected via socket")).fields).toMatchObject({ transport: "polling" });

    const upgrade = await logged("Socket upgraded transport");
    expect(upgrade.fields).toMatchObject({ socketId: socket.id, transport: "websocket" });
    socket.close();
  });

  it("tells a share link screen to try again when the database fails, and logs the fault", async () => {
    await expect(connect({ shareId: "database-down" })).rejects.toThrow("Authentication error: Could not check share link");

    const line = await logged("[Socket] Share link lookup error");
    expect(line.level).toBe("error");
  });

  it("still tells a screen when its share link doesn't exist", async () => {
    await expect(connect({ shareId: "no-such-link" })).rejects.toThrow("Authentication error: Invalid share link");
  });
});
