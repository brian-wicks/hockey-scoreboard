// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { io as createClient, type Socket } from "socket.io-client";
import { createScoreboardServer } from "../../serverApp";

vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockImplementation(async (token: string) => {
      if (token.startsWith("operator-user-")) return { uid: token };
      throw new Error("invalid token");
    }),
  })),
}));

// The gate decides what each upcoming read of an operator record does, so the tests
// order the handshake and the owner's change by steps, not by timing.
type ReadPlan = (read: () => Promise<unknown>) => Promise<unknown>;
const gate = vi.hoisted(() => ({ plans: [] as unknown[], calls: 0 }));

vi.mock("../db/database.ts", async () => {
  const actual = await vi.importActual<typeof import("../db/database.ts")>("../db/database.ts");
  return {
    ...actual,
    getOperatorAccess: vi.fn(async (operatorId: string) => {
      gate.calls += 1;
      const plan = gate.plans.shift() as ReadPlan | undefined;
      const read = () => actual.getOperatorAccess(operatorId);
      return plan ? plan(read) : read();
    }),
  };
});

const newUser = () => `operator-user-${randomUUID()}`;

describe("second operator revoked during a handshake", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    gate.plans = [];
    gate.calls = 0;
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-race-"));
    server = createScoreboardServer({ dataDir });
    const port = await server.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const owner = (userId: string, method: string) =>
    fetch(`${baseUrl}/api/operator-access`, { method, headers: { Authorization: `Bearer ${userId}` } });

  const createAccess = async () => {
    const userId = newUser();
    const { operatorId, pin } = await (await owner(userId, "POST")).json();
    const res = await fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const { token } = await res.json();
    return { userId, operatorId: operatorId as string, token: token as string };
  };

  const readScore = async (userId: string) => {
    const { shareId } = await (
      await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } })
    ).json();
    return (await (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json()).homeTeam.score as number;
  };

  // Holds the next read after it has fetched the record, until release() is called.
  const holdNextRead = () => {
    let release!: () => void;
    let held!: () => void;
    const heldPromise = new Promise<void>((resolve) => (held = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    gate.plans.push(async (read: () => Promise<unknown>) => {
      const record = await read();
      held();
      await released;
      return record;
    });
    return { held: heldPromise, release };
  };

  const startOperator = (operatorId: string, token: string) => {
    const socket = createClient(baseUrl, {
      auth: { operatorId, operatorToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    openSockets.push(socket);
    const ended = new Promise<string>((resolve) => socket.once("disconnect", resolve));
    const connected = new Promise<void>((resolve) => socket.once("connect", () => resolve()));
    return { socket, ended, connected };
  };

  const expectRevokedSocketHasNoWriteAccess = async (userId: string, operatorId: string, token: string, revoke: () => Promise<unknown>) => {
    const { held, release } = holdNextRead();
    const { socket, ended, connected } = startOperator(operatorId, token);
    await held;
    await revoke();
    release();

    await connected;
    socket.emit("applyGamePatch", { opId: "late-1", home: { scoreDelta: 1 } }, () => {});
    expect(await ended).toBe("io server disconnect");
    expect(await readScore(userId)).toBe(0);
  };

  it("disconnects a handshake that raced with a new PIN", async () => {
    const { userId, operatorId, token } = await createAccess();
    await expectRevokedSocketHasNoWriteAccess(userId, operatorId, token, () => owner(userId, "POST"));
  });

  it("disconnects a handshake that raced with removal", async () => {
    const { userId, operatorId, token } = await createAccess();
    await expectRevokedSocketHasNoWriteAccess(userId, operatorId, token, () => owner(userId, "DELETE"));
  });

  it("fails closed when the second read errors", async () => {
    const { userId, operatorId, token } = await createAccess();
    gate.plans.push(undefined, async () => {
      throw new Error("read failed");
    });
    const { socket, ended, connected } = startOperator(operatorId, token);
    await connected;
    socket.emit("applyGamePatch", { opId: "late-2", home: { scoreDelta: 1 } }, () => {});
    // A database fault isn't a sign-out, so the client sees a dropped connection and keeps its token.
    expect(await ended).toBe("transport close");
    expect(await readScore(userId)).toBe(0);
  });

  it("keeps a normal operator connected after reading the record twice", async () => {
    const { userId, operatorId, token } = await createAccess();
    const before = gate.calls;
    const { socket, connected } = startOperator(operatorId, token);
    await connected;
    const ack = await new Promise((resolve) =>
      socket.emit("applyGamePatch", { opId: "ok-1", home: { scoreDelta: 1 } }, resolve),
    );
    expect(ack).toEqual({ ok: true });
    expect(gate.calls - before).toBe(2);
    expect(socket.connected).toBe(true);
    expect(await readScore(userId)).toBe(1);
  });
});
