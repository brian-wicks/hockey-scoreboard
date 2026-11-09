// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { io as createClient, type Socket } from "socket.io-client";
import { createScoreboardServer } from "../../serverApp";
import { OPERATOR_SESSION_ENDED_ERROR } from "../lib/operatorAccess";

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
const gate = vi.hoisted(() => ({
  plans: [] as unknown[],
  calls: 0,
  failGameLoadFor: null as string | null,
  afterPinHashed: null as (() => void) | null,
  writePlans: [] as unknown[],
  userReadPlans: [] as unknown[],
  beforeActiveGameSaved: null as (() => Promise<void>) | null,
}));
const captureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/node", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/node")>()),
  captureException,
}));

vi.mock("../server/operatorCredentials.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/operatorCredentials.ts")>();
  return {
    ...actual,
    hashPin: vi.fn(async (pin: string) => {
      const hashed = await actual.hashPin(pin);
      gate.afterPinHashed?.();
      return hashed;
    }),
  };
});

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
    getUserConfig: vi.fn(async (userId: string, key: string) => {
      if (userId === gate.failGameLoadFor) throw new Error("read failed");
      return actual.getUserConfig(userId, key);
    }),
    getUserOperatorAccess: vi.fn(async (userId: string) => {
      const plan = gate.userReadPlans.shift() as ReadPlan | undefined;
      const read = () => actual.getUserOperatorAccess(userId);
      return plan ? plan(read) : read();
    }),
    setOperatorAccess: vi.fn(async (access: Parameters<typeof actual.setOperatorAccess>[0]) => {
      const plan = gate.writePlans.shift() as ReadPlan | undefined;
      const write = () => actual.setOperatorAccess(access);
      return plan ? plan(write) : write();
    }),
    setUserConfig: vi.fn(async (userId: string, key: string, value: string) => {
      if (key === "activeGameId" && gate.beforeActiveGameSaved) await gate.beforeActiveGameSaved();
      return actual.setUserConfig(userId, key, value);
    }),
  };
});

const newUser = () => `operator-user-${randomUUID()}`;

describe("second operator session races", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    gate.plans = [];
    gate.calls = 0;
    gate.failGameLoadFor = null;
    gate.afterPinHashed = null;
    gate.writePlans = [];
    gate.userReadPlans = [];
    gate.beforeActiveGameSaved = null;
    captureException.mockClear();
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

  const createAccessWithPin = async () => {
    const userId = newUser();
    const { operatorId, pin } = await (await owner(userId, "POST")).json();
    return { userId, operatorId: operatorId as string, pin: pin as string };
  };

  const createAccess = async () => {
    const { userId, operatorId, pin } = await createAccessWithPin();
    const res = await fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const { token } = await res.json();
    return { userId, operatorId, token: token as string };
  };

  const readState = async (userId: string) => {
    const { shareId } = await (
      await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } })
    ).json();
    return (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
  };

  const readScore = async (userId: string) => (await readState(userId)).homeTeam.score as number;

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

  // Holds the next read before it fetches anything, then gives whatever `outcome` gives.
  const holdReadThen = (outcome: (read: () => Promise<unknown>) => Promise<unknown> = (read) => read()) => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    gate.plans.push(async (read: () => Promise<unknown>) => {
      await released;
      return outcome(read);
    });
    return { release };
  };

  // Lets the handshake's read through and holds the re-check after it.
  const holdRecheck = (outcome?: (read: () => Promise<unknown>) => Promise<unknown>) => {
    gate.plans.push(undefined);
    return holdReadThen(outcome);
  };

  const drain = () => new Promise<void>((resolve) => setImmediate(resolve));

  // Resolves once the server has received `count` events on the next connection and
  // handed them to its listeners, if there are any, so a test can tell a held event
  // from one still on the wire. Also records every ack the server calls.
  const watchNextConnection = (count: number) => {
    const acks: unknown[] = [];
    const arrived = new Promise<void>((resolve) => {
      server.io.once("connection", (serverSocket) => {
        let seen = 0;
        serverSocket.use((packet, next) => {
          const ack = packet[packet.length - 1];
          if (typeof ack === "function") {
            packet[packet.length - 1] = (result: unknown) => {
              acks.push(result);
              ack(result);
            };
          }
          next();
          seen += 1;
          if (seen === count) void drain().then(resolve);
        });
      });
    });
    return { arrived, acks };
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
    const recheck = holdReadThen();
    const { arrived, acks } = watchNextConnection(1);
    const { socket, ended, connected } = startOperator(operatorId, token);
    await held;
    await revoke();
    release();

    await connected;
    socket.emit("applyGamePatch", { opId: "late-1", home: { scoreDelta: 1 } }, () => {});
    await arrived;
    recheck.release();
    expect(await ended).toBe("io server disconnect");
    await drain();
    expect(acks).toEqual([{ ok: false }]);
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
    const { release } = holdRecheck(async () => {
      throw new Error("read failed");
    });
    const { arrived, acks } = watchNextConnection(1);
    const { socket, ended, connected } = startOperator(operatorId, token);
    await connected;
    socket.emit("applyGamePatch", { opId: "late-2", home: { scoreDelta: 1 } }, () => {});
    await arrived;
    release();
    // A database fault isn't a sign-out, so the client sees a dropped connection and keeps its token.
    expect(await ended).toBe("transport close");
    await drain();
    expect(acks).toEqual([{ ok: false }]);
    expect(await readScore(userId)).toBe(0);
  });

  it("runs a change sent straight after connecting, once the re-check passes", async () => {
    const { userId, operatorId, token } = await createAccess();
    const { release } = holdRecheck();
    const { arrived } = watchNextConnection(1);
    const { socket, connected } = startOperator(operatorId, token);
    await connected;
    const ack = new Promise((resolve) =>
      socket.emit("applyGamePatch", { opId: "queued-1", home: { scoreDelta: 1 } }, resolve),
    );
    await arrived;
    expect(await readScore(userId)).toBe(0);

    release();
    expect(await ack).toEqual({ ok: true });
    expect(await readScore(userId)).toBe(1);
  });

  it("does not apply a change held behind a re-check that shows revocation", async () => {
    const { userId, operatorId, token } = await createAccess();
    const { release } = holdRecheck(async () => null);
    const { arrived, acks } = watchNextConnection(1);
    const { socket, ended, connected } = startOperator(operatorId, token);
    let gotState = false;
    socket.on("gameState", () => (gotState = true));
    await connected;
    socket.emit("applyGamePatch", { opId: "queued-2", home: { scoreDelta: 1 } }, () => {});
    await arrived;

    release();
    expect(await ended).toBe("io server disconnect");
    await drain();
    expect(acks).toEqual([{ ok: false }]);
    expect(await readScore(userId)).toBe(0);
    expect(gotState).toBe(false);
  });

  it("does not apply a held change when the owner signs the socket out during a re-check that read the old record", async () => {
    const { userId, operatorId, token } = await createAccess();
    gate.plans.push(undefined);
    const { held, release } = holdNextRead();
    const { arrived, acks } = watchNextConnection(1);
    const { socket, ended, connected } = startOperator(operatorId, token);
    await connected;
    await held;
    socket.emit("applyGamePatch", { opId: "queued-3", home: { scoreDelta: 1 } }, () => {});
    await arrived;

    await owner(userId, "POST");
    expect(await ended).toBe("io server disconnect");
    release();
    await drain();
    expect(acks).toEqual([{ ok: false }]);
    expect(await readScore(userId)).toBe(0);
  });

  it("runs events held behind the re-check in the order they arrived", async () => {
    const { userId, operatorId, token } = await createAccess();
    const { release } = holdRecheck();
    const { arrived } = watchNextConnection(3);
    const { socket, connected } = startOperator(operatorId, token);
    await connected;
    socket.emit("setClock", 5000);
    socket.emit("clockIncrease");
    const ack = new Promise((resolve) => socket.emit("applyGamePatch", { opId: "queued-4", noLog: true }, resolve));
    await arrived;

    release();
    expect(await ack).toEqual({ ok: true });
    expect((await readState(userId)).clock.timeRemaining).toBe(6000);
  });

  it("runs a clock start held behind the re-check, which has no ack to retry on", async () => {
    const { operatorId, token } = await createAccess();
    const { release } = holdRecheck();
    const { arrived } = watchNextConnection(1);
    const { socket, connected } = startOperator(operatorId, token);
    await connected;
    const running = new Promise<void>((resolve) =>
      socket.on("gameState", (state) => {
        if (state.clock.isRunning) resolve();
      }),
    );
    socket.emit("startClock");
    await arrived;

    release();
    await running;
  });

  it("sends the game and the config only after the re-check passes", async () => {
    const { operatorId, token } = await createAccess();
    const { release } = holdRecheck();
    const { arrived } = watchNextConnection(1);
    const { socket, connected } = startOperator(operatorId, token);
    const received: string[] = [];
    socket.onAny((event) => received.push(event));
    const configured = new Promise((resolve) => socket.once("operatorConfig", resolve));
    await connected;
    socket.emit("clockIncrease");
    await arrived;
    expect(received).toEqual([]);

    release();
    await configured;
    expect(received).toContain("gameState");
    expect(received).toContain("activeGame");
  });

  it("closes the connection when the game can't load, then recovers on reconnect", async () => {
    const { userId, operatorId, token } = await createAccess();
    gate.failGameLoadFor = userId;
    const first = startOperator(operatorId, token);
    expect(await first.ended).toBe("transport close");
    expect(captureException).toHaveBeenCalledTimes(1);
    const reported = JSON.stringify(captureException.mock.calls[0][1]);
    expect(Object.keys(captureException.mock.calls[0][1].extra).sort()).toEqual(["socketId", "userId"]);
    expect(reported).not.toContain(operatorId);
    expect(reported).not.toContain(token);

    gate.failGameLoadFor = null;
    const second = startOperator(operatorId, token);
    await new Promise((resolve) => second.socket.once("gameState", resolve));
    expect(second.socket.connected).toBe(true);
  });

  it("reports a database fault at the handshake as something other than a sign-out", async () => {
    const { operatorId, token } = await createAccess();
    gate.plans.push(async () => {
      throw new Error("read failed");
    });
    const socket = createClient(baseUrl, {
      auth: { operatorId, operatorToken: token },
      transports: ["websocket"],
      reconnection: false,
    });
    openSockets.push(socket);
    const error = await new Promise<Error>((resolve) => socket.once("connect_error", resolve));
    expect(error.message).toBe("Authentication error: Could not check operator session");
    expect(error.message).not.toBe(OPERATOR_SESSION_ENDED_ERROR);
    expect(captureException).toHaveBeenCalledTimes(1);
    const reported = JSON.stringify(captureException.mock.calls[0][1]);
    expect(reported).not.toContain(operatorId);
    expect(reported).not.toContain(token);
  });

  it("makes a guess in flight wait, so it can't write the old PIN back over a new one", async () => {
    const { userId, operatorId, pin } = await createAccessWithPin();
    const { held, release } = holdNextRead();
    const guess = fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin === "000000" ? "111111" : "000000" }),
    });
    await held;

    // The owner's request now goes as far as it can: with the queue it waits behind the
    // guess, and without it the new PIN is saved before the guess saves its old copy.
    const hashed = new Promise<void>((resolve) => (gate.afterPinHashed = resolve));
    const created = owner(userId, "POST");
    await hashed;
    await drain();

    release();
    expect((await guess).status).toBe(401);
    const { pin: newPin } = await (await created).json();
    const postPin = (value: string) =>
      fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
    if (newPin !== pin) expect((await postPin(pin)).status).toBe(401);
    expect((await postPin(newPin)).status).toBe(200);
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

  describe("when the owner's game changes", () => {
    const NEXT_GAME = "Next game team";
    const nextGameTeams = {
      homeTeam: { name: NEXT_GAME, abbreviation: "NXT", score: 0, shots: 0, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [] },
    };

    const connectOwner = async (userId: string) => {
      const socket = createClient(baseUrl, { auth: { token: userId }, transports: ["websocket"], reconnection: false });
      openSockets.push(socket);
      await new Promise<void>((resolve) => socket.once("connect", () => resolve()));
      return socket;
    };

    const startNewGame = (socket: Socket, teams?: unknown) =>
      new Promise<{ gameId: string }>((resolve) => socket.emit("startNewGame", teams, resolve));

    // An owner in a game, with a second operator who has finished connecting.
    const setupInGame = async () => {
      const userId = newUser();
      const ownerSocket = await connectOwner(userId);
      const first = await startNewGame(ownerSocket);
      const { pin, operatorId } = await (await owner(userId, "POST")).json();
      const { token } = await (
        await fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        })
      ).json();
      return { userId, ownerSocket, firstGameId: first.gameId, operatorId: operatorId as string, token: token as string, pin: pin as string };
    };

    const startOperatorAndRecord = (operatorId: string, token: string) => {
      const operator = startOperator(operatorId, token);
      const states: { homeTeam: { name: string } }[] = [];
      const activeGames: unknown[] = [];
      operator.socket.on("gameState", (state) => states.push(state));
      operator.socket.on("activeGame", (gameId) => activeGames.push(gameId));
      return { ...operator, states, activeGames };
    };

    const holdNextWrite = () => {
      let release!: () => void;
      let held!: () => void;
      const heldPromise = new Promise<void>((resolve) => (held = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      gate.writePlans.push(async (write: () => Promise<unknown>) => {
        held();
        await released;
        return write();
      });
      return { held: heldPromise, release };
    };

    it("signs the second operator out before anyone gets the new game's state", async () => {
      const { userId, ownerSocket, firstGameId, operatorId, token } = await setupInGame();
      const operator = startOperatorAndRecord(operatorId, token);
      await new Promise((resolve) => operator.socket.once("operatorConfig", resolve));
      const ownerStates: { homeTeam: { name: string } }[] = [];
      ownerSocket.on("gameState", (state) => ownerStates.push(state));

      const { held, release } = holdNextWrite();
      const started = startNewGame(ownerSocket, nextGameTeams);
      await held;
      await drain();

      // While the reset is held, the old game is still the live one for everybody.
      expect(ownerStates.map((state) => state.homeTeam.name)).not.toContain(NEXT_GAME);
      expect((await readState(userId)).homeTeam.name).not.toBe(NEXT_GAME);
      expect(operator.socket.connected).toBe(true);

      release();
      expect(await operator.ended).toBe("io server disconnect");
      const { gameId } = await started;
      expect(ownerStates.map((state) => state.homeTeam.name)).toContain(NEXT_GAME);
      await drain();
      expect(operator.states.map((state) => state.homeTeam.name)).not.toContain(NEXT_GAME);
      expect(operator.activeGames).toEqual([firstGameId]);
      expect(operator.activeGames).not.toContain(gameId);
    });

    it("sends the new game to no one who connected on a session from the old game", async () => {
      const { ownerSocket, operatorId, token } = await setupInGame();

      // The handshake reads the old record and stays held while the whole reset runs.
      const handshake = holdNextRead();
      const recheck = holdReadThen();
      const operator = startOperatorAndRecord(operatorId, token);
      await handshake.held;

      let releaseSave!: () => void;
      let saveHeld!: () => void;
      const reachedSave = new Promise<void>((resolve) => (saveHeld = resolve));
      gate.beforeActiveGameSaved = () =>
        new Promise<void>((resolve) => {
          saveHeld();
          releaseSave = resolve;
        });
      const started = startNewGame(ownerSocket, nextGameTeams);
      await reachedSave;

      // The socket now joins, after the reset's sign-out and before the new game goes out.
      handshake.release();
      await operator.connected;
      releaseSave();
      await started;
      await drain();

      recheck.release();
      expect(await operator.ended).toBe("io server disconnect");
      await drain();
      expect(operator.states).toEqual([]);
      expect(operator.activeGames).toEqual([]);
    });

    it("still changes the owner's game when the reset can't be saved, and logs no credentials", async () => {
      const { userId, ownerSocket, operatorId, token, pin } = await setupInGame();
      const operator = startOperatorAndRecord(operatorId, token);
      await new Promise((resolve) => operator.socket.once("operatorConfig", resolve));
      captureException.mockClear();
      gate.writePlans.push(async () => {
        throw new Error("write failed");
      });
      const activeGame = new Promise<string>((resolve) => ownerSocket.once("activeGame", resolve));

      const { gameId } = await startNewGame(ownerSocket, nextGameTeams);

      expect(await activeGame).toBe(gameId);
      expect((await readState(userId)).homeTeam.name).toBe(NEXT_GAME);
      expect(await operator.ended).toBe("io server disconnect");
      expect(captureException).toHaveBeenCalledTimes(1);
      expect(captureException.mock.calls[0][1]).toEqual({ extra: { userId } });
      const reported = JSON.stringify(captureException.mock.calls[0]);
      for (const secret of [operatorId, token, pin]) expect(reported).not.toContain(secret);
    });

    describe("when the active game can't be saved as the user's choice", () => {
      const failSave = () => {
        gate.beforeActiveGameSaved = async () => {
          throw new Error("write failed");
        };
      };

      const patch = (socket: Socket, gameId: string) =>
        new Promise((resolve) => socket.emit("applyGamePatch", { opId: randomUUID(), gameId, home: { scoreDelta: 1 } }, resolve));

      const expectGameIsLive = async (ownerSocket: Socket, userId: string, gameId: string, activeGame: Promise<string>) => {
        expect(await activeGame).toBe(gameId);
        expect(captureException).toHaveBeenCalledTimes(1);
        expect(captureException.mock.calls[0][1]).toEqual({ extra: { userId, gameId } });
        const before = await readScore(userId);
        expect(await patch(ownerSocket, gameId)).toEqual({ ok: true });
        expect(await readScore(userId)).toBe(before + 1);
      };

      it("still starts the new game and acknowledges it", async () => {
        const userId = newUser();
        const ownerSocket = await connectOwner(userId);
        await startNewGame(ownerSocket);
        failSave();
        captureException.mockClear();
        const activeGame = new Promise<string>((resolve) => ownerSocket.once("activeGame", resolve));

        const { gameId } = await startNewGame(ownerSocket);

        await expectGameIsLive(ownerSocket, userId, gameId, activeGame);
      });

      it("still opens the game and acknowledges it", async () => {
        const userId = newUser();
        const ownerSocket = await connectOwner(userId);
        const { gameId } = await startNewGame(ownerSocket);
        await startNewGame(ownerSocket);
        failSave();
        captureException.mockClear();
        const activeGame = new Promise<string>((resolve) => ownerSocket.once("activeGame", resolve));

        const result = await new Promise((resolve) => ownerSocket.emit("openGame", gameId, resolve));

        expect(result).toEqual({ ok: true });
        await expectGameIsLive(ownerSocket, userId, gameId, activeGame);
      });
    });

    it("still opens the owner's game when the record can't be read", async () => {
      const { userId, ownerSocket, firstGameId, operatorId } = await setupInGame();
      await startNewGame(ownerSocket);
      const { pin } = await (await owner(userId, "POST")).json();
      const { token: fresh } = await (
        await fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        })
      ).json();
      const operator = startOperatorAndRecord(operatorId, fresh);
      await new Promise((resolve) => operator.socket.once("operatorConfig", resolve));
      captureException.mockClear();
      gate.userReadPlans.push(async () => {
        throw new Error("read failed");
      });

      const result = await new Promise((resolve) => ownerSocket.emit("openGame", firstGameId, resolve));

      expect(result).toEqual({ ok: true });
      expect(await operator.ended).toBe("io server disconnect");
      expect(captureException.mock.calls[0][1]).toEqual({ extra: { userId } });
    });
  });
});
