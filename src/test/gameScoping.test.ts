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

const newUser = () => `operator-user-${randomUUID()}`;
const STALE = "a-game-that-is-no-longer-active";

describe("changes scoped to a game", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  let currentTime: number;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    currentTime = Date.now();
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-scoping-"));
    server = createScoreboardServer({ dataDir, now: () => currentTime });
    const port = await server.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    openSockets.splice(0).forEach((socket) => socket.close());
    await server.stop();
    await rm(dataDir, { recursive: true, force: true });
  });

  const connect = (auth: Record<string, unknown>) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = createClient(baseUrl, { auth, transports: ["websocket"], reconnection: false });
      openSockets.push(socket);
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });

  const startNewGame = (socket: Socket) =>
    new Promise<string>((resolve) => socket.emit("startNewGame", undefined, (result: { gameId: string }) => resolve(result.gameId)));

  const sendPatch = (socket: Socket, patch: Record<string, unknown>) =>
    new Promise<{ ok: boolean }>((resolve) => socket.emit("applyGamePatch", patch, resolve));

  // An owner in a game, and a way to read the live state as a viewer would.
  const setupOwner = async () => {
    const userId = newUser();
    const owner = await connect({ token: userId });
    const gameId = await startNewGame(owner);
    const res = await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } });
    const { shareId } = await res.json();
    const read = async () => (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
    return { userId, owner, gameId, read };
  };

  // Events on one socket run in order, so once this is acknowledged the ones before it are done.
  const settled = (socket: Socket) => sendPatch(socket, { opId: `settle-${randomUUID()}`, noLog: true });

  describe("applyGamePatch", () => {
    it("drops a patch for another game, and sends the sender the live state to replace its copy", async () => {
      const { owner, read } = await setupOwner();
      const received: number[] = [];
      owner.on("gameState", (state) => received.push(state.homeTeam.score));
      const before = await read();

      const nextState = new Promise((resolve) => owner.once("gameState", resolve));
      expect(await sendPatch(owner, { opId: "stale", gameId: STALE, home: { scoreDelta: 1 } })).toEqual({ ok: false });
      await nextState;

      expect(received).toEqual([0]);
      const after = await read();
      expect(after.homeTeam.score).toBe(0);
      expect(after.eventLog).toEqual(before.eventLog);
    });

    it("applies a patch for the active game", async () => {
      const { owner, gameId, read } = await setupOwner();
      expect(await sendPatch(owner, { opId: "match", gameId, home: { scoreDelta: 1 } })).toEqual({ ok: true });
      expect((await read()).homeTeam.score).toBe(1);
    });

    it("applies a patch with no game ID, from a tab still open across a deploy", async () => {
      const { owner, read } = await setupOwner();
      expect(await sendPatch(owner, { opId: "none", home: { scoreDelta: 1 } })).toEqual({ ok: true });
      expect((await read()).homeTeam.score).toBe(1);
    });

    it("treats a game ID that isn't a string as missing", async () => {
      const { owner, read } = await setupOwner();
      expect(await sendPatch(owner, { opId: "odd", gameId: 42, home: { scoreDelta: 1 } })).toEqual({ ok: true });
      expect((await read()).homeTeam.score).toBe(1);
    });

    it("drops a patch for a game when no game is active", async () => {
      const owner = await connect({ token: newUser() });
      expect(await sendPatch(owner, { opId: "stale", gameId: STALE, home: { scoreDelta: 1 } })).toEqual({ ok: false });
    });

    it("keeps the game ID out of the game state", async () => {
      const { owner, gameId, read } = await setupOwner();
      await sendPatch(owner, { opId: "a", gameId, fields: { period: "2nd", gameId: "smuggled" } as never });
      const state = await read();
      expect(state.period).toBe("2nd");
      expect(state.gameId).toBeUndefined();
    });

    it("drops a second operator's patch for another game the same way", async () => {
      const { userId, owner, read } = await setupOwner();
      const access = await fetch(`${baseUrl}/api/operator-access`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } });
      const { operatorId, pin } = await access.json();
      const session = await fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const operator = await connect({ operatorId, operatorToken: (await session.json()).token });

      expect(await sendPatch(operator, { opId: "stale", gameId: STALE, home: { scoreDelta: 1 } })).toEqual({ ok: false });
      await settled(owner);
      expect((await read()).homeTeam.score).toBe(0);
    });
  });

  describe("clock events", () => {
    const START = 60_000;

    // Each event, with its leading arguments, the clock before it and what it should do.
    const cases: {
      event: string;
      args: unknown[];
      running?: boolean;
      applied: (clock: { isRunning: boolean; timeRemaining: number }) => void;
      unchanged: (clock: { isRunning: boolean; timeRemaining: number }) => void;
    }[] = [
      {
        event: "startClock",
        args: [],
        applied: (clock) => expect(clock.isRunning).toBe(true),
        unchanged: (clock) => expect(clock.isRunning).toBe(false),
      },
      {
        event: "stopClock",
        args: [],
        running: true,
        applied: (clock) => expect(clock.isRunning).toBe(false),
        unchanged: (clock) => expect(clock.isRunning).toBe(true),
      },
      {
        event: "setClock",
        args: [90_000],
        applied: (clock) => expect(clock.timeRemaining).toBe(90_000),
        unchanged: (clock) => expect(clock.timeRemaining).toBe(START),
      },
      {
        event: "clockIncrease",
        args: [],
        applied: (clock) => expect(clock.timeRemaining).toBe(START + 1000),
        unchanged: (clock) => expect(clock.timeRemaining).toBe(START),
      },
      {
        event: "clockDecrease",
        args: [],
        applied: (clock) => expect(clock.timeRemaining).toBe(START - 1000),
        unchanged: (clock) => expect(clock.timeRemaining).toBe(START),
      },
    ];

    const setupClock = async (running = false) => {
      const setup = await setupOwner();
      setup.owner.emit("setClock", START);
      if (running) setup.owner.emit("startClock");
      await settled(setup.owner);
      return setup;
    };

    for (const { event, args, running, applied, unchanged } of cases) {
      describe(event, () => {
        it("ignores a stale game ID", async () => {
          const { owner, read } = await setupClock(running);
          owner.emit(event, ...args, { gameId: STALE });
          await settled(owner);
          unchanged((await read()).clock);
        });

        it("applies a matching game ID", async () => {
          const { owner, gameId, read } = await setupClock(running);
          owner.emit(event, ...args, { gameId });
          await settled(owner);
          applied((await read()).clock);
        });

        it("applies an event with no game ID", async () => {
          const { owner, read } = await setupClock(running);
          owner.emit(event, ...args);
          await settled(owner);
          applied((await read()).clock);
        });

        it("treats a malformed scope as no scope", async () => {
          for (const scope of ["junk", 7, null, [], { gameId: 42 }]) {
            const { owner, read } = await setupClock(running);
            owner.emit(event, ...args, scope);
            await settled(owner);
            applied((await read()).clock);
          }
        });
      });
    }

    it("still refuses a bad time from setClock when the game ID matches", async () => {
      const { owner, gameId, read } = await setupClock();
      owner.emit("setClock", "soon", { gameId });
      await settled(owner);
      expect((await read()).clock.timeRemaining).toBe(START);
    });
  });

  describe("a change buffered through a dropped connection", () => {
    it("does not reach the game that became active in the meantime", async () => {
      const { userId, owner, gameId: gameA, read } = await setupOwner();

      owner.disconnect();
      const ack = new Promise<{ ok: boolean }>((resolve) =>
        owner.emit("applyGamePatch", { opId: "buffered", gameId: gameA, home: { scoreDelta: 1 } }, resolve),
      );
      owner.emit("setClock", 12_345, { gameId: gameA });

      const otherDevice = await connect({ token: userId });
      const gameB = await startNewGame(otherDevice);
      expect(gameB).not.toBe(gameA);

      owner.connect();
      expect(await ack).toEqual({ ok: false });
      await settled(owner);

      const state = await read();
      expect(state.homeTeam.score).toBe(0);
      expect(state.clock.timeRemaining).not.toBe(12_345);
    });
  });
});
