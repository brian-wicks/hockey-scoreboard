// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
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
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

describe("second operator access", () => {
  let server: ReturnType<typeof createScoreboardServer>;
  let baseUrl: string;
  let dataDir: string;
  let currentTime: number;
  const openSockets: Socket[] = [];

  beforeEach(async () => {
    currentTime = Date.now();
    dataDir = await mkdtemp(path.join(tmpdir(), "scoreboard-operator-"));
    server = createScoreboardServer({ dataDir, now: () => currentTime });
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

  const createAccess = async (userId = newUser()) => {
    const res = await owner(userId, "POST");
    const { operatorId, pin } = await res.json();
    return { userId, operatorId: operatorId as string, pin: pin as string };
  };

  const postPin = (operatorId: string, pin: unknown) =>
    fetch(`${baseUrl}/api/operator/${operatorId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

  const wrongPinFor = (pin: string) => (pin === "000000" ? "000001" : "000000");

  describe("owner routes", () => {
    it("requires the owner's sign-in", async () => {
      expect((await fetch(`${baseUrl}/api/operator-access`)).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/operator-access`, { method: "POST" })).status).toBe(401);
      expect((await fetch(`${baseUrl}/api/operator-access`, { method: "DELETE" })).status).toBe(401);
    });

    it("reports no access, then the link, and never the PIN", async () => {
      const userId = newUser();
      expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId: null, needsPin: false });

      const { operatorId, pin } = await createAccess(userId);
      expect(pin).toMatch(/^\d{6}$/);

      const body = await (await owner(userId, "GET")).json();
      expect(body).toEqual({ operatorId, needsPin: false });
    });

    it("keeps the link and replaces the PIN on a new PIN", async () => {
      const userId = newUser();
      const first = await createAccess(userId);
      const second = await createAccess(userId);
      expect(second.operatorId).toBe(first.operatorId);
      expect((await postPin(second.operatorId, second.pin)).status).toBe(200);
      if (first.pin !== second.pin) {
        expect((await postPin(second.operatorId, first.pin)).status).toBe(401);
      }
    });

    it("stops the link working after removal", async () => {
      const { userId, operatorId, pin } = await createAccess();
      expect((await owner(userId, "DELETE")).status).toBe(200);
      expect((await postPin(operatorId, pin)).status).toBe(404);
      expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId: null, needsPin: false });
    });

    it("keeps each account's access separate", async () => {
      const first = await createAccess();
      const second = await createAccess();
      expect(second.operatorId).not.toBe(first.operatorId);
      await owner(second.userId, "DELETE");
      expect((await postPin(first.operatorId, first.pin)).status).toBe(200);
    });
  });

  describe("PIN check", () => {
    it("returns a token for the right PIN", async () => {
      const { operatorId, pin } = await createAccess();
      const res = await postPin(operatorId, pin);
      expect(res.status).toBe(200);
      expect(typeof (await res.json()).token).toBe("string");
    });

    it("rejects a malformed PIN without counting an attempt", async () => {
      const { operatorId, pin } = await createAccess();
      expect((await postPin(operatorId, "12")).status).toBe(400);
      expect((await postPin(operatorId, 123456)).status).toBe(400);
      const wrong = await postPin(operatorId, wrongPinFor(pin));
      expect((await wrong.json()).attemptsLeft).toBe(4);
    });

    it("returns 404 for an unknown or badly formed link", async () => {
      expect((await postPin(randomUUID(), "123456")).status).toBe(404);
      expect((await postPin("not-a-uuid", "123456")).status).toBe(404);
    });

    it("locks after five wrong PINs, refuses the right PIN while locked, then recovers", async () => {
      const { operatorId, pin } = await createAccess();
      const wrong = wrongPinFor(pin);

      for (const attemptsLeft of [4, 3, 2, 1]) {
        const res = await postPin(operatorId, wrong);
        expect(res.status).toBe(401);
        expect((await res.json()).attemptsLeft).toBe(attemptsLeft);
      }

      const locked = await postPin(operatorId, wrong);
      expect(locked.status).toBe(429);
      expect((await locked.json()).retryAfterSeconds).toBe(900);
      expect((await postPin(operatorId, pin)).status).toBe(429);

      currentTime += FIFTEEN_MINUTES + 1;
      const afterLock = await postPin(operatorId, wrong);
      expect(afterLock.status).toBe(401);
      expect((await afterLock.json()).attemptsLeft).toBe(4);
      expect((await postPin(operatorId, pin)).status).toBe(200);
    });

    it("resets the count after a correct PIN", async () => {
      const { operatorId, pin } = await createAccess();
      await postPin(operatorId, wrongPinFor(pin));
      await postPin(operatorId, pin);
      const res = await postPin(operatorId, wrongPinFor(pin));
      expect((await res.json()).attemptsLeft).toBe(4);
    });

    it("clears a lock when the owner creates a new PIN", async () => {
      const { userId, operatorId, pin } = await createAccess();
      for (let i = 0; i < 5; i += 1) await postPin(operatorId, wrongPinFor(pin));
      const next = await createAccess(userId);
      expect((await postPin(operatorId, next.pin)).status).toBe(200);
    });

    it("does not let parallel guesses get past the limit", async () => {
      const { operatorId, pin } = await createAccess();
      const results = await Promise.all(
        Array.from({ length: 12 }, () => postPin(operatorId, wrongPinFor(pin))),
      );
      const statuses = results.map((res) => res.status);
      expect(statuses.filter((status) => status === 401)).toHaveLength(4);
      expect(statuses.filter((status) => status === 429)).toHaveLength(8);
    });

    it("limits requests per IP", async () => {
      const { operatorId } = await createAccess();
      for (let i = 0; i < 30; i += 1) {
        expect((await postPin(operatorId, "bad")).status).toBe(400);
      }
      const limited = await postPin(operatorId, "bad");
      expect(limited.status).toBe(429);
      expect((await limited.json()).retryAfterSeconds).toBe(900);
    });
  });

  describe("operator socket", () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const signIn = async (operatorId: string, pin: string) => {
      const res = await postPin(operatorId, pin);
      return (await res.json()).token as string;
    };

    const connectWith = (auth: Record<string, unknown>) =>
      new Promise<Socket>((resolve, reject) => {
        const socket = createClient(baseUrl, { auth, transports: ["websocket"], reconnection: false });
        openSockets.push(socket);
        socket.once("connect", () => resolve(socket));
        socket.once("connect_error", (error) => reject(error));
      });

    const connectOperator = async (operatorId: string, token: string) => connectWith({ operatorId, operatorToken: token });

    const handshakeError = (auth: Record<string, unknown>) =>
      connectWith(auth).then(
        () => null,
        (error: Error) => error.message,
      );

    const readState = async (userId: string) => {
      const res = await fetch(`${baseUrl}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${userId}` } });
      const { shareId } = await res.json();
      const read = async () => (await fetch(`${baseUrl}/api/share/${shareId}/state`)).json();
      return { read, shareId: shareId as string };
    };

    const setup = async () => {
      const { userId, operatorId, pin } = await createAccess();
      const ownerSocket = await connectWith({ token: userId });
      const token = await signIn(operatorId, pin);
      const operator = await connectOperator(operatorId, token);
      const { read, shareId } = await readState(userId);
      return { userId, operatorId, pin, token, ownerSocket, operator, read, shareId };
    };

    const ENDED = "Authentication error: Operator session ended";

    it("rejects missing, wrong and expired tokens", async () => {
      const { operatorId, pin } = await createAccess();
      const token = await signIn(operatorId, pin);
      expect(await handshakeError({ operatorId, operatorToken: "wrong" })).toBe(ENDED);
      expect(await handshakeError({ operatorId })).toBe(ENDED);
      expect(await handshakeError({ operatorId: randomUUID(), operatorToken: token })).toBe(ENDED);

      currentTime += ONE_DAY + 1;
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    it("keeps five device tokens and drops the oldest", async () => {
      const { operatorId, pin } = await createAccess();
      const tokens: string[] = [];
      for (let i = 0; i < 6; i += 1) {
        tokens.push(await signIn(operatorId, pin));
        currentTime += 1;
      }
      expect(await handshakeError({ operatorId, operatorToken: tokens[0] })).toBe(ENDED);
      expect(await handshakeError({ operatorId, operatorToken: tokens[5] })).toBeNull();
    });

    it("doesn't accept a viewer share ID as an operator credential", async () => {
      const { userId } = await createAccess();
      const { shareId } = await readState(userId);
      expect(await handshakeError({ operatorId: shareId, operatorToken: shareId })).toBe(ENDED);
    });

    it("lets the second operator change the owner's live game, and the owner sees it", async () => {
      const { operator, ownerSocket, read } = await setup();
      const seen = new Promise<any>((resolve) => {
        ownerSocket.on("gameState", (state) => {
          if (state.homeTeam.score === 1) resolve(state);
        });
      });

      const ack = await new Promise((resolve) =>
        operator.emit("applyGamePatch", { opId: "op-1", home: { scoreDelta: 1 } }, resolve),
      );

      expect(ack).toEqual({ ok: true });
      await seen;
      expect((await read()).homeTeam.score).toBe(1);
    });

    it("sends the owner's changes to the second operator", async () => {
      const { operator, ownerSocket } = await setup();
      const seen = new Promise<void>((resolve) => {
        operator.on("gameState", (state) => {
          if (state.awayTeam.score === 2) resolve();
        });
      });
      ownerSocket.emit("applyGamePatch", { opId: "own-1", away: { scoreDelta: 2 } }, () => {});
      await seen;
    });

    it("lets the second operator use the clock", async () => {
      const { operator, read } = await setup();
      operator.emit("startClock");
      await sleep(50);
      expect((await read()).clock.isRunning).toBe(true);
      operator.emit("stopClock");
      await sleep(50);
      expect((await read()).clock.isRunning).toBe(false);
      operator.emit("setClock", 90_000);
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(90_000);
      operator.emit("clockIncrease");
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(91_000);
      operator.emit("clockDecrease");
      await sleep(50);
      expect((await read()).clock.timeRemaining).toBe(90_000);
    });

    it("refuses a full state replacement", async () => {
      const { operator, read } = await setup();
      const before = (await read()).period;
      const replacement = before === "2nd" ? "3rd" : "2nd";
      operator.emit("updateGameState", { period: replacement });
      await sleep(50);
      expect((await read()).period).toBe(before);
    });

    it("refuses starting a new game", async () => {
      const { operator, ownerSocket, read } = await setup();
      await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      await new Promise((resolve) => ownerSocket.emit("applyGamePatch", { opId: "own-2", home: { scoreDelta: 3 } }, resolve));

      operator.emit("startNewGame", undefined);
      await sleep(100);

      expect((await read()).homeTeam.score).toBe(3);
    });

    it("refuses opening a saved game", async () => {
      const { operator, ownerSocket } = await setup();
      const first: any = await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      await new Promise((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));
      const opened = vi.fn();
      ownerSocket.on("activeGame", opened);

      operator.emit("openGame", first.gameId);
      await sleep(100);

      expect(opened).not.toHaveBeenCalled();
    });

    it("doesn't accept an operator token on account routes", async () => {
      const { token } = await setup();
      const res = await fetch(`${baseUrl}/api/streamdeck`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status).toBe(401);
    });

    it("keeps viewer links read-only alongside a second operator", async () => {
      const { shareId, read } = await setup();
      const viewer = await connectWith({ shareId });
      const result = await new Promise((resolve) =>
        viewer.emit("applyGamePatch", { opId: "v-1", home: { scoreDelta: 5 } }, resolve),
      );
      expect(result).toEqual({ ok: false });
      expect((await read()).homeTeam.score).toBe(0);
    });

    it("signs the second operator out on a new PIN, leaving the owner and viewers connected", async () => {
      const { userId, operatorId, token, operator, ownerSocket, shareId } = await setup();
      const viewer = await connectWith({ shareId });
      const ended = new Promise<string>((resolve) => operator.on("disconnect", resolve));

      await owner(userId, "POST");

      expect(await ended).toBe("io server disconnect");
      expect(ownerSocket.connected).toBe(true);
      expect(viewer.connected).toBe(true);
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    it("signs the second operator out on removal", async () => {
      const { userId, operatorId, token, operator } = await setup();
      const ended = new Promise<string>((resolve) => operator.on("disconnect", resolve));

      await owner(userId, "DELETE");

      expect(await ended).toBe("io server disconnect");
      expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
    });

    describe("a new PIN for each game", () => {
      const startNewGame = (ownerSocket: Socket) =>
        new Promise<{ gameId: string }>((resolve) => ownerSocket.emit("startNewGame", undefined, resolve));

      const openGame = (ownerSocket: Socket, gameId: string) =>
        new Promise<{ ok: boolean }>((resolve) => ownerSocket.emit("openGame", gameId, resolve));

      // The owner has `games` saved games and is in the last one, with a second operator signed in.
      const setupInGame = async (games = 1) => {
        const userId = newUser();
        const ownerSocket = await connectWith({ token: userId });
        const gameIds: string[] = [];
        for (let i = 0; i < games; i++) gameIds.push((await startNewGame(ownerSocket)).gameId);
        const { operatorId, pin } = await createAccess(userId);
        const token = await signIn(operatorId, pin);
        const operator = await connectOperator(operatorId, token);
        const ended = new Promise<string>((resolve) => operator.on("disconnect", resolve));
        return { userId, ownerSocket, gameIds, operatorId, pin, token, operator, ended };
      };

      const expectNoPinUntilANewOneIsCreated = async (userId: string, operatorId: string, pin: string, token: string) => {
        expect(await handshakeError({ operatorId, operatorToken: token })).toBe(ENDED);
        expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId, needsPin: true });

        // More tries than the limit, which never counts them or locks the link.
        for (let i = 0; i < 6; i++) {
          const res = await postPin(operatorId, pin);
          expect(res.status).toBe(409);
          expect(await res.json()).toEqual({ error: "No PIN for this game" });
        }

        const created = await createAccess(userId);
        expect(created.operatorId).toBe(operatorId);
        expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId, needsPin: false });
        const wrong = await postPin(operatorId, wrongPinFor(created.pin));
        expect((await wrong.json()).attemptsLeft).toBe(4);
        expect((await postPin(operatorId, created.pin)).status).toBe(200);
      };

      it("ends the PIN and every session when the owner starts another game", async () => {
        const { userId, ownerSocket, operatorId, pin, token, ended } = await setupInGame();
        await startNewGame(ownerSocket);
        expect(await ended).toBe("io server disconnect");
        await expectNoPinUntilANewOneIsCreated(userId, operatorId, pin, token);
      });

      it("ends the PIN and every session when the owner opens a different game", async () => {
        const { userId, ownerSocket, gameIds, operatorId, pin, token, ended } = await setupInGame(2);
        expect(await openGame(ownerSocket, gameIds[0])).toEqual({ ok: true });
        expect(await ended).toBe("io server disconnect");
        await expectNoPinUntilANewOneIsCreated(userId, operatorId, pin, token);
      });

      it("changes nothing when the owner reopens the same game", async () => {
        const { ownerSocket, gameIds, operatorId, pin, token, operator } = await setupInGame();
        expect(await openGame(ownerSocket, gameIds[0])).toEqual({ ok: true });
        expect(operator.connected).toBe(true);
        expect((await postPin(operatorId, pin)).status).toBe(200);
        const again = await connectOperator(operatorId, token);
        expect(again.connected).toBe(true);
      });

      it("changes nothing when opening a game fails", async () => {
        const { ownerSocket, operatorId, pin, operator } = await setupInGame();
        expect((await openGame(ownerSocket, randomUUID())).ok).toBe(false);
        expect(operator.connected).toBe(true);
        expect((await postPin(operatorId, pin)).status).toBe(200);
      });

      it("keeps a PIN and session from before the very first game", async () => {
        const userId = newUser();
        const ownerSocket = await connectWith({ token: userId });
        const { operatorId, pin } = await createAccess(userId);
        const operator = await connectOperator(operatorId, await signIn(operatorId, pin));
        const gotGame = new Promise<string>((resolve) =>
          operator.on("activeGame", (gameId) => {
            if (gameId) resolve(gameId);
          }),
        );

        const { gameId } = await startNewGame(ownerSocket);

        expect(await gotGame).toBe(gameId);
        expect(operator.connected).toBe(true);
        expect((await postPin(operatorId, pin)).status).toBe(200);
        expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId, needsPin: false });
      });

      it("clears a lock along with the PIN", async () => {
        const { ownerSocket, operatorId, pin } = await setupInGame();
        for (let i = 0; i < 5; i++) await postPin(operatorId, wrongPinFor(pin));
        expect((await postPin(operatorId, pin)).status).toBe(429);
        await startNewGame(ownerSocket);
        expect((await postPin(operatorId, pin)).status).toBe(409);
      });

      it("checks the PIN format and the link before saying there is no PIN", async () => {
        const { ownerSocket, operatorId, pin } = await setupInGame();
        await startNewGame(ownerSocket);
        expect((await postPin(operatorId, "12")).status).toBe(400);
        expect((await postPin("not-a-uuid", pin)).status).toBe(404);
        expect((await postPin(randomUUID(), pin)).status).toBe(404);
      });

      it("leaves the owner, viewers and other accounts connected", async () => {
        const { userId, ownerSocket, ended } = await setupInGame();
        const { shareId } = await readState(userId);
        const viewer = await connectWith({ shareId });
        const other = await setupInGame();

        await startNewGame(ownerSocket);

        expect(await ended).toBe("io server disconnect");
        expect(ownerSocket.connected).toBe(true);
        expect(viewer.connected).toBe(true);
        expect(other.operator.connected).toBe(true);
        expect((await postPin(other.operatorId, other.pin)).status).toBe(200);
      });

      const deleteGame = (userId: string, gameId: string) =>
        fetch(`${baseUrl}/api/games/${gameId}`, { method: "DELETE", headers: { Authorization: `Bearer ${userId}` } });

      it("ends the PIN and every session when the owner deletes the active game", async () => {
        const { userId, gameIds, operatorId, pin, token, ended } = await setupInGame();
        expect((await deleteGame(userId, gameIds[0])).status).toBe(200);
        expect(await ended).toBe("io server disconnect");
        await expectNoPinUntilANewOneIsCreated(userId, operatorId, pin, token);
      });

      it("changes nothing when the owner deletes a different game", async () => {
        const { userId, gameIds, operatorId, pin, operator } = await setupInGame(2);
        expect((await deleteGame(userId, gameIds[0])).status).toBe(200);
        expect(operator.connected).toBe(true);
        expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId, needsPin: false });
        expect((await postPin(operatorId, pin)).status).toBe(200);
      });

      it("changes nothing when someone else's game ID is the one deleted", async () => {
        const other = await setupInGame();
        const { userId, operatorId, pin, operator } = await setupInGame();
        expect((await deleteGame(userId, other.gameIds[0])).status).toBe(200);
        expect(operator.connected).toBe(true);
        expect(other.operator.connected).toBe(true);
        expect((await postPin(operatorId, pin)).status).toBe(200);
      });

      it("does nothing for an owner with no second operator", async () => {
        const userId = newUser();
        const ownerSocket = await connectWith({ token: userId });
        await startNewGame(ownerSocket);
        const { gameId } = await startNewGame(ownerSocket);
        expect(gameId).toEqual(expect.any(String));
        expect(await (await owner(userId, "GET")).json()).toEqual({ operatorId: null, needsPin: false });
      });
    });

    it("sends the owner's Deck and shortcut config on connect", async () => {
      const { userId, operatorId, pin } = await createAccess();
      const streamDeck = { buttons: [{ id: "1", label: "Goal" }] };
      const shortcuts = [{ key: "g", action: "homeScoreIncrease", description: "Goal" }];
      const save = (route: string, body: unknown) =>
        fetch(`${baseUrl}/api/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${userId}` },
          body: JSON.stringify(body),
        });
      await save("streamdeck", streamDeck);
      await save("shortcuts", shortcuts);
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config).toEqual({ streamDeck, shortcuts });
    });

    it("falls back to the global config files", async () => {
      const { operatorId, pin } = await createAccess();
      const streamDeck = { buttons: [{ id: "global", label: "Global" }] };
      await writeFile(path.join(dataDir, "streamdeck.json"), JSON.stringify(streamDeck));
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config: any = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config.streamDeck).toEqual(streamDeck);
    });

    it("sends null for an unreadable config file, with the connection staying up", async () => {
      const { operatorId, pin } = await createAccess();
      await writeFile(path.join(dataDir, "streamdeck.json"), "{not json");
      const token = await signIn(operatorId, pin);

      const socket = createClient(baseUrl, {
        auth: { operatorId, operatorToken: token },
        transports: ["websocket"],
      });
      openSockets.push(socket);
      const config: any = await new Promise((resolve) => socket.once("operatorConfig", resolve));

      expect(config.streamDeck).toBeNull();
      expect(socket.connected).toBe(true);
    });

    it("doesn't send operator config to owner or viewer sockets", async () => {
      const { userId, shareId } = await setup();
      const spy = vi.fn();
      const ownerSocket = createClient(baseUrl, { auth: { token: userId }, transports: ["websocket"] });
      const viewer = createClient(baseUrl, { auth: { shareId }, transports: ["websocket"] });
      openSockets.push(ownerSocket, viewer);
      ownerSocket.on("operatorConfig", spy);
      viewer.on("operatorConfig", spy);
      await sleep(150);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
