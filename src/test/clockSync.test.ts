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
      if (token.startsWith("clock-user-")) return { uid: token };
      throw new Error("invalid token");
    }),
  })),
}));

const START = 60_000;
const penalty = (id: string, timeRemaining = 120_000) => ({
  id,
  playerNumber: "10",
  infraction: "HOOK",
  duration: 120_000,
  timeRemaining,
});

describe("a running clock", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  // Real time plus however far a test has moved it on, so the tick interval keeps running.
  let shiftMs: number;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    shiftMs = 0;
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-clock-"));
    server = createScoreboardServer({ dataDir, now: () => Date.now() + shiftMs });
    const port = await server.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const serverNow = () => Date.now() + shiftMs;
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const connect = (auth: Record<string, unknown>) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = createClient(baseUrl, { auth, transports: ["websocket"], reconnection: false });
      openSockets.push(socket);
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });

  const sendPatch = (socket: Socket, patch: Record<string, unknown>) =>
    new Promise<{ ok: boolean }>((resolve) => socket.emit("applyGamePatch", patch, resolve));

  // Events on one socket run in order, so once this is acknowledged the ones before it are done.
  const settled = (socket: Socket) => sendPatch(socket, { opId: `settle-${randomUUID()}`, noLog: true });

  const setupOwner = async (penalties: ReturnType<typeof penalty>[] = []) => {
    const userId = `clock-user-${randomUUID()}`;
    const owner = await connect({ token: userId });
    await new Promise((resolve) => owner.emit("startNewGame", undefined, resolve));
    const res = await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } });
    const { shareId } = await res.json();
    owner.emit("setClock", START);
    if (penalties.length > 0) await sendPatch(owner, { opId: "penalties", noLog: true, home: { penalties: { added: penalties } } });
    await settled(owner);
    const read = async () => (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
    return { owner, shareId, read };
  };

  describe("updates to screens", () => {
    it("sends the clock about once a second instead of the whole game on every tick", async () => {
      const { owner, shareId } = await setupOwner();
      const screen = await connect({ shareId });
      const received: string[] = [];
      screen.onAny((event) => received.push(event));

      owner.emit("startClock");
      await wait(2_300);

      const fullUpdates = received.filter((event) => event === "gameState").length;
      const syncs = received.filter((event) => event === "clockSync").length;
      // One full update for the start, where every tick used to send one.
      expect(fullUpdates).toBe(1);
      expect(syncs).toBeGreaterThanOrEqual(1);
      expect(syncs).toBeLessThanOrEqual(3);
    });

    it("sends only the clock and penalty times in a sync", async () => {
      const { owner, shareId } = await setupOwner([penalty("p1")]);
      const screen = await connect({ shareId });
      const sync = new Promise<any>((resolve) => screen.once("clockSync", resolve));

      owner.emit("startClock");

      const payload = await sync;
      expect(Object.keys(payload).sort()).toEqual(["clock", "penalties", "serverTime"]);
      expect(payload.clock.isRunning).toBe(true);
      expect(payload.penalties.home).toEqual([{ id: "p1", timeRemaining: expect.any(Number) }]);
      expect(payload.penalties.away).toEqual([]);
    });

    it("sends the whole game when a penalty runs out", async () => {
      const { owner, shareId } = await setupOwner([penalty("short", 300)]);
      const screen = await connect({ shareId });
      const states: any[] = [];
      screen.on("gameState", (state) => states.push(state));

      owner.emit("startClock");
      await wait(700);

      const ended = states.find((state) => state.homeTeam.penalties.length === 0);
      expect(ended).toBeDefined();
      expect(ended.eventLog.some((event: any) => event.type === "penalty_over_notice" && event.penaltyId === "short")).toBe(true);
    });
  });

  describe("stopping", () => {
    it("stops at the time the button was pressed when the event arrives late", async () => {
      const { owner, read } = await setupOwner([penalty("p1")]);
      const startedAt = serverNow();
      owner.emit("startClock", { at: startedAt });
      await settled(owner);

      // The connection drops for ten seconds, and the operator pressed stop three seconds in.
      shiftMs += 10_000;
      await wait(150);
      owner.emit("stopClock", { at: startedAt + 3_000 });
      await settled(owner);

      const state = await read();
      expect(state.clock.isRunning).toBe(false);
      expect(state.clock.timeRemaining).toBeGreaterThanOrEqual(START - 3_100);
      expect(state.clock.timeRemaining).toBeLessThanOrEqual(START - 3_000);
      expect(state.homeTeam.penalties[0].timeRemaining).toBeGreaterThanOrEqual(120_000 - 3_100);
      expect(state.homeTeam.penalties[0].timeRemaining).toBeLessThanOrEqual(120_000 - 3_000);
    });

    it("never gives back time from before the clock started", async () => {
      const { owner, read } = await setupOwner();
      const startedAt = serverNow();
      owner.emit("startClock", { at: startedAt });
      await settled(owner);
      shiftMs += 5_000;

      owner.emit("stopClock", { at: startedAt - 60_000 });
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeLessThanOrEqual(START);
    });

    it("stops now when the press time is in the future", async () => {
      const { owner, read } = await setupOwner();
      owner.emit("startClock");
      await settled(owner);
      shiftMs += 4_000;

      owner.emit("stopClock", { at: serverNow() + 60_000 });
      await settled(owner);

      const { clock } = await read();
      expect(clock.timeRemaining).toBeLessThanOrEqual(START - 4_000);
      expect(clock.timeRemaining).toBeGreaterThan(START - 4_500);
    });

    it("stops now when no press time is sent", async () => {
      const { owner, read } = await setupOwner();
      owner.emit("startClock");
      await settled(owner);
      shiftMs += 4_000;

      owner.emit("stopClock");
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeLessThanOrEqual(START - 4_000);
    });

    it("doesn't give back time from before the clock was set", async () => {
      const { owner, read } = await setupOwner();
      const startedAt = serverNow();
      owner.emit("startClock", { at: startedAt });
      await settled(owner);
      shiftMs += 5_000;
      owner.emit("setClock", 30_000);
      await settled(owner);

      owner.emit("stopClock", { at: startedAt + 1_000 });
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeLessThanOrEqual(30_000);
    });

    it("never takes a penalty past its full length", async () => {
      const { owner, read } = await setupOwner([penalty("p1", 119_000)]);
      const startedAt = serverNow();
      owner.emit("startClock", { at: startedAt });
      await settled(owner);
      shiftMs += 3_000;

      // Earlier than the penalty's missing second, though not before the start.
      owner.emit("stopClock", { at: startedAt });
      await settled(owner);

      expect((await read()).homeTeam.penalties[0].timeRemaining).toBeLessThanOrEqual(120_000);
    });
  });

  describe("what a late stop can give back", () => {
    const startNewGame = (socket: Socket) =>
      new Promise<string>((resolve) => socket.emit("startNewGame", undefined, (result: { gameId: string }) => resolve(result.gameId)));

    it("never uses the start of the game it switched away from", async () => {
      const { owner, read } = await setupOwner();
      // Game B is left with its clock running.
      const gameB = await startNewGame(owner);
      owner.emit("setClock", START);
      owner.emit("startClock");
      await settled(owner);
      // Game A's clock starts, then the operator goes back to B ten seconds later.
      await startNewGame(owner);
      owner.emit("setClock", START);
      const aStartedAt = serverNow();
      owner.emit("startClock", { at: aStartedAt });
      await settled(owner);
      shiftMs += 10_000;
      await new Promise((resolve) => owner.emit("openGame", gameB, resolve));
      const reopened = (await read()).clock.timeRemaining;

      // A stop that claims to be from just after A started can't give B that time back.
      owner.emit("stopClock", { at: aStartedAt + 1_000 });
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeLessThanOrEqual(reopened);
    });

    it("never reaches back past a clock replaced by an update", async () => {
      const { owner, read } = await setupOwner();
      const startedAt = serverNow();
      owner.emit("startClock", { at: startedAt });
      await settled(owner);
      shiftMs += 5_000;

      await sendPatch(owner, {
        opId: "replace-clock",
        noLog: true,
        fields: { clock: { timeRemaining: 30_000, isRunning: true, lastUpdate: serverNow() } },
      });
      owner.emit("stopClock", { at: startedAt + 1_000 });
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeLessThanOrEqual(30_000);
    });
  });

  describe("starting", () => {
    it("starts at the time the button was pressed when the event arrives late", async () => {
      const { owner, read } = await setupOwner();
      const setAt = serverNow();
      shiftMs += 10_000;

      owner.emit("startClock", { at: setAt + 4_000 });
      await settled(owner);

      const { clock } = await read();
      expect(clock.isRunning).toBe(true);
      // Running for the six seconds since the press.
      expect(clock.timeRemaining).toBeLessThanOrEqual(START - 6_000);
      expect(clock.timeRemaining).toBeGreaterThan(START - 6_500);
    });

    it("never starts before the clock last changed", async () => {
      const { owner, read } = await setupOwner();
      shiftMs += 2_000;

      owner.emit("startClock", { at: serverNow() - 60_000 });
      await settled(owner);

      expect((await read()).clock.timeRemaining).toBeGreaterThan(START - 2_500);
    });
  });
});
