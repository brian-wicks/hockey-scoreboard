import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, KeyboardShortcut, ShortcutAction } from "../store";

const listeners = new Map<string, (payload: any) => void>();
const socketMock = {
  on: vi.fn((event: string, handler: (payload: any) => void) => {
    listeners.set(event, handler);
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
};
const ioMock = vi.fn(() => socketMock);

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

vi.mock("../lib/firebase", () => ({
  auth: {
    currentUser: { getIdToken: vi.fn().mockResolvedValue("test-token") },
  },
  googleProvider: {},
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

const mockUser = {
  uid: "test-user-id",
  displayName: "Test User",
  photoURL: "https://example.com/photo.jpg",
  getIdToken: vi.fn().mockResolvedValue("test-token"),
};

const baseState: GameState = {
  homeTeam: {
    name: "Home",
    abbreviation: "HOM",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [],
  },
  awayTeam: {
    name: "Away",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  },
  clock: {
    timeRemaining: 60000,
    isRunning: false,
    lastUpdate: 0,
  },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  overlayCorner: "top-left",
  jumbotronGradientsEnabled: true,
  lowerThird: { active: false, title: "", subtitle: "" },
  jumbotronGoalHighlight: null,
};

describe("store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    vi.resetModules();
    if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== "function") {
      const store = new Map<string, string>();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      });
    } else {
      localStorage.clear();
    }
  });

  it("connects and hydrates game state with server time offset", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    await useStore.getState().connect();
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.on).toHaveBeenCalled();

    const handler = listeners.get("gameState");
    expect(handler).toBeDefined();
    handler?.({ ...baseState, serverTime: 1500 });

    expect(useStore.getState().gameState?.period).toBe("1st");
    expect(useStore.getState().serverTimeOffsetMs).toBe(500);
    nowSpy.mockRestore();
  });

  it("uses a token-refreshing auth callback so a reconnect doesn't reuse an expired token", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });
    await useStore.getState().connect();

    const options = (ioMock.mock.calls[0] as any[])[1] as { auth: unknown };
    // A static { token } object would be resent verbatim by Socket.IO on every
    // reconnection attempt; a function is re-invoked each time, fetching a fresh
    // (auto-refreshed) ID token instead of the one captured at initial connect.
    expect(typeof options.auth).toBe("function");

    mockUser.getIdToken.mockClear();
    const authCallback = vi.fn();
    (options.auth as (cb: (data: { token: string }) => void) => void)(authCallback);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockUser.getIdToken).toHaveBeenCalled();
    expect(authCallback).toHaveBeenCalledWith({ token: "test-token" });
  });

  it("tracks socket connection state", async () => {
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    await useStore.getState().connect();

    listeners.get("connect")?.(undefined);
    expect(useStore.getState().isConnected).toBe(true);

    listeners.get("disconnect")?.(undefined);
    expect(useStore.getState().isConnected).toBe(false);

    listeners.get("connect_error")?.(new Error("err"));
    expect(useStore.getState().isConnected).toBe(false);
  });

  it("emits updates through the socket", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    useStore.getState().updateState({ period: "2nd" });
    expect(socketMock.emit).toHaveBeenCalledWith(
      "applyGamePatch",
      expect.objectContaining({ fields: { period: "2nd" } }),
      expect.any(Function),
    );
    expect(useStore.getState().gameState?.period).toBe("2nd");
  });

  it("supports undo for score/shots/penalty updates", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    useStore.getState().updateState({
      homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 },
    });

    expect(useStore.getState().undoStack.at(-1)?.home?.scoreDelta).toBe(-1);
    useStore.getState().undoLastUpdate();

    expect(socketMock.emit).toHaveBeenLastCalledWith(
      "applyGamePatch",
      expect.objectContaining({ home: { scoreDelta: -1 }, undoOf: expect.any(String) }),
      expect.any(Function),
    );
    expect(useStore.getState().gameState?.homeTeam.score).toBe(baseState.homeTeam.score);
    expect(useStore.getState().gameState?.period).toBe(baseState.period);
  });

  it("undo erases the event the action created, not just annotates it", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    // Operator scores a goal — client sends the score bump...
    useStore.getState().updateState({
      homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 },
    });

    // ...and the server broadcasts back a state with the new "goal" event appended, tagged
    // with the patch that caused it.
    const sent = socketMock.emit.mock.calls.filter(([event]: any[]) => event === "applyGamePatch").at(-1)!;
    const goalEvent = { id: "evt-1", type: "goal", team: "home", period: "1st", clockTime: "20:00", createdAt: 1, opId: sent[1].opId } as const;
    useStore.setState({
      gameState: { ...useStore.getState().gameState!, eventLog: [goalEvent] },
    });
    expect(useStore.getState().gameState?.eventLog).toHaveLength(1);

    useStore.getState().undoLastUpdate();

    // Undo removes that event rather than appending a compensating "goal_revoked" entry.
    expect(socketMock.emit).toHaveBeenLastCalledWith(
      "applyGamePatch",
      expect.objectContaining({ undoOf: sent[1].opId }),
      expect.any(Function),
    );
    expect(useStore.getState().gameState?.eventLog).toEqual([]);
  });

  it("sends nothing and adds no undo step when nothing changed", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState, undoStack: [] });
    socketMock.emit.mockClear();

    useStore.getState().updateState({ homeTeam: { ...baseState.homeTeam }, eventLog: [...baseState.eventLog] });

    expect(socketMock.emit).not.toHaveBeenCalled();
    expect(useStore.getState().undoStack).toEqual([]);
  });

  it("keeps a share link trying to reconnect for as long as it's open", async () => {
    const { useStore } = await import("../store");
    ioMock.mockClear();
    await useStore.getState().connectViewer("share-1");
    expect((ioMock.mock.calls.at(-1) as unknown[])[1]).toMatchObject({ reconnectionAttempts: Infinity });
  });

  describe("changes still in transit", () => {
    const connected = async () => {
      const { useStore } = await import("../store");
      useStore.setState({ user: mockUser as any });
      await useStore.getState().connect();
      useStore.setState({ gameState: baseState, pendingPatches: [], undoStack: [] });
      socketMock.emit.mockClear();
      return useStore;
    };
    const lastAck = () => socketMock.emit.mock.calls.at(-1)!.at(-1) as () => void;
    const tick = (overrides: Partial<GameState> = {}) => listeners.get("gameState")?.({ ...baseState, ...overrides });

    it("keeps an unconfirmed change on screen through clock ticks", async () => {
      const useStore = await connected();
      useStore.getState().updateState({ lowerThird: { active: false, title: "Typed", subtitle: "" } });

      tick();

      expect(useStore.getState().gameState?.lowerThird?.title).toBe("Typed");
    });

    it("trusts the server again once the change is confirmed", async () => {
      const useStore = await connected();
      useStore.getState().updateState({ homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 } });
      lastAck()();
      expect(useStore.getState().pendingPatches).toEqual([]);

      const serverScore = baseState.homeTeam.score + 1;
      tick({ homeTeam: { ...baseState.homeTeam, score: serverScore } });

      expect(useStore.getState().gameState?.homeTeam.score).toBe(serverScore);
    });

    it("counts two quick goals even if a stale tick arrives between them", async () => {
      const useStore = await connected();
      useStore.getState().updateState({ homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 } });
      tick();
      const current = useStore.getState().gameState!;
      useStore.getState().updateState({ homeTeam: { ...current.homeTeam, score: current.homeTeam.score + 1 } });

      const patches = socketMock.emit.mock.calls.map((call: any[]) => call[1].home.scoreDelta);
      expect(patches).toEqual([1, 1]);
      expect(useStore.getState().gameState?.homeTeam.score).toBe(baseState.homeTeam.score + 2);
    });

    it("stops holding on to a change that's never confirmed", async () => {
      const useStore = await connected();
      useStore.getState().updateState({ lowerThird: { active: false, title: "Lost", subtitle: "" } });
      const realNow = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(realNow + 16_000);

      tick();
      clock.mockRestore();

      expect(useStore.getState().gameState?.lowerThird?.title).not.toBe("Lost");
      expect(useStore.getState().pendingPatches).toEqual([]);
    });

    it("forgets unconfirmed changes when the connection drops", async () => {
      const useStore = await connected();
      useStore.getState().updateState({ homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 } });

      listeners.get("disconnect")?.(undefined);
      tick();

      expect(useStore.getState().gameState?.homeTeam.score).toBe(baseState.homeTeam.score);
    });
  });

  it("supports undoing multiple actions in sequence, most recent first", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    useStore.getState().updateState({
      homeTeam: { ...baseState.homeTeam, score: 1 },
    });
    useStore.getState().updateState({
      homeTeam: { ...baseState.homeTeam, score: 2 },
    });
    useStore.getState().updateState({
      awayTeam: { ...baseState.awayTeam, score: 1 },
    });

    expect(useStore.getState().undoStack).toHaveLength(3);

    useStore.getState().undoLastUpdate();
    expect(useStore.getState().gameState?.awayTeam.score).toBe(baseState.awayTeam.score);
    expect(useStore.getState().gameState?.homeTeam.score).toBe(2);
    expect(useStore.getState().undoStack).toHaveLength(2);

    useStore.getState().undoLastUpdate();
    expect(useStore.getState().gameState?.homeTeam.score).toBe(1);
    expect(useStore.getState().undoStack).toHaveLength(1);

    useStore.getState().undoLastUpdate();
    expect(useStore.getState().gameState?.homeTeam.score).toBe(baseState.homeTeam.score);
    expect(useStore.getState().undoStack).toHaveLength(0);
  });

  it("hydrates from cached state before socket updates arrive", async () => {
    localStorage.setItem("scoreboard:gameStateCache:v1", JSON.stringify({ ...baseState, period: "cached" }));
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    useStore.getState().ensureInitialized();

    expect(useStore.getState().gameState?.period).toBe("cached");
  });

  it("posts shortcut updates to the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    const shortcut: KeyboardShortcut = { key: "A", action: "toggleClock", description: "Toggle clock" };
    await useStore.getState().updateShortcut(0, shortcut);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("rolls back an optimistic shortcut update if the server save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    const previousShortcuts = useStore.getState().keyboardShortcuts;
    const shortcut: KeyboardShortcut = { key: "Z", action: "toggleClock", description: "Toggle clock" };
    await useStore.getState().updateShortcut(0, shortcut);
    expect(useStore.getState().keyboardShortcuts).toEqual(previousShortcuts);
  });

  it("loads shortcuts and fills missing defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve([{ key: " ", action: "toggleClock", description: "Toggle clock" } satisfies KeyboardShortcut]),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    useStore.setState({ user: mockUser as any });
    await useStore.getState().loadShortcuts();
    const shortcuts = useStore.getState().keyboardShortcuts;
    expect(shortcuts.length).toBeGreaterThan(1);
    expect(shortcuts.some((shortcut) => shortcut.action === "clockIncrease")).toBe(true);
  });

  it("connects as viewer and handles errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...baseState, serverTime: 2000 }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    await useStore.getState().connectViewer("test-share");
    expect(useStore.getState().isViewer).toBe(true);
    expect(useStore.getState().shareId).toBe("test-share");

    const handler = listeners.get("gameState");
    handler?.({ ...baseState, serverTime: 3000 });
    expect(useStore.getState().gameState).toBeDefined();

    // Test error case
    fetchMock.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Share not found" }),
    });
    await useStore.getState().connectViewer("bad-share");
    expect(useStore.getState().authError).toBe("Share not found");
  });

  it("handles clock operations", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    const state = useStore.getState();
    state.startClock();
    expect(socketMock.emit).toHaveBeenCalledWith("startClock");

    state.stopClock();
    expect(socketMock.emit).toHaveBeenCalledWith("stopClock");

    state.setClock(5000);
    expect(socketMock.emit).toHaveBeenCalledWith("setClock", 5000);

    state.clockIncrease();
    expect(socketMock.emit).toHaveBeenCalledWith("clockIncrease");

    state.clockDecrease();
    expect(socketMock.emit).toHaveBeenCalledWith("clockDecrease");
  });

  it("updates streamdeck buttons", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });

    const button = { id: "btn-0", label: "NEW", action: "homeScoreUp" as ShortcutAction, backgroundColor: "#000", textColor: "#fff" };
    await useStore.getState().updateStreamDeckButton(0, button);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/streamdeck"), expect.objectContaining({ method: "POST" }));
  });

  it("rolls back an optimistic streamdeck button update if the server save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });

    const previousConfig = useStore.getState().streamDeckConfig;
    const button = { id: "btn-0", label: "NEW", action: "homeScoreUp" as ShortcutAction, backgroundColor: "#000", textColor: "#fff" };
    await useStore.getState().updateStreamDeckButton(0, button);
    expect(useStore.getState().streamDeckConfig).toEqual(previousConfig);
  });

  it("resets shortcuts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });

    await useStore.getState().resetShortcuts();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/shortcuts"), expect.objectContaining({ method: "POST" }));
  });

  it("rolls back an optimistic shortcuts reset if the server save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    const customShortcuts: KeyboardShortcut[] = [{ key: "Q", action: "toggleClock", description: "Toggle clock" }];
    useStore.setState({ user: mockUser as any, keyboardShortcuts: customShortcuts });

    await useStore.getState().resetShortcuts();
    expect(useStore.getState().keyboardShortcuts).toEqual(customShortcuts);
  });

  it("performs full cleanup on logout, including the undo stack", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, user: mockUser as any, undoStack: [{ opId: "old", home: { scoreDelta: 1 } }] });

    await useStore.getState().logout();
    expect(socketMock.disconnect).toHaveBeenCalled();
    expect(useStore.getState().user).toBeNull();
    expect(useStore.getState().gameState).toBeNull();
    // A leftover undo entry from the previous operator's session must not be able to
    // splice their data into whichever account signs in next on the same machine.
    expect(useStore.getState().undoStack).toEqual([]);
  });

  it("clears the undo stack when opening a saved game", async () => {
    const savedGameState = { ...baseState, homeTeam: { ...baseState.homeTeam, score: 9 } };
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });
    await useStore.getState().connect();
    useStore.setState({
      gameState: baseState,
      // Stale undo entry from the previously open/edited game.
      undoStack: [{ opId: "old", home: { scoreDelta: 1 } }],
    });

    // Simulate the server: it broadcasts the opened game's state, then acks.
    socketMock.emit.mockImplementation((event: string, ...args: any[]) => {
      if (event === "openGame") {
        listeners.get("gameState")?.(savedGameState);
        const callback = args[args.length - 1];
        callback?.({ ok: true });
      }
    });

    await useStore.getState().openGame("game-1");

    // The stale entry must not survive — undoing right after opening a game must not
    // splice an unrelated game's team/event data back into the just-opened game.
    expect(useStore.getState().undoStack).toEqual([]);
    expect(useStore.getState().gameState?.homeTeam.score).toBe(9);
  });

  describe("second operator", () => {
    const operatorId = "3f2b8c1e-9a47-4d21-8f6e-0c1d2e3f4a5b";
    const tokenKey = `scoreboard:operatorToken:${operatorId}`;

    beforeEach(() => {
      sessionStorage.clear();
      window.history.pushState({}, "", `/operate/${operatorId}`);
      (socketMock as any).connect = vi.fn();
      (socketMock as any).active = false;
    });

    afterEach(() => {
      window.history.pushState({}, "", "/");
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    const respondWith = (status: number, body: unknown) => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    };

    it("asks for the PIN when there is no stored token", async () => {
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.getState().ensureInitialized();
      expect(useStore.getState().isOperator).toBe(true);
      expect(useStore.getState().operatorId).toBe(operatorId);
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin" });
      expect(ioMock).not.toHaveBeenCalled();
    });

    it("reconnects with a stored token, for this link only", async () => {
      sessionStorage.setItem(tokenKey, "stored-token");
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.getState().ensureInitialized();
      expect((ioMock.mock.calls.at(-1) as unknown[])[1]).toMatchObject({
        auth: { operatorId, operatorToken: "stored-token" },
        reconnectionAttempts: Infinity,
      });
    });

    it("uses the PIN flow even when the owner is signed in on this browser", async () => {
      const fetchMock = respondWith(200, {});
      const { useStore } = await import("../store");
      ioMock.mockClear();
      useStore.setState({ user: mockUser as any });
      useStore.getState().ensureInitialized();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin" });
      expect(ioMock).not.toHaveBeenCalled();
      expect(mockUser.getIdToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("stores the token and connects after a correct PIN", async () => {
      const fetchMock = respondWith(200, { token: "new-token" });
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      ioMock.mockClear();

      await useStore.getState().submitOperatorPin("123456");

      expect(fetchMock.mock.calls[0][0]).toContain(`/api/operator/${operatorId}/session`);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ pin: "123456" });
      expect(sessionStorage.getItem(tokenKey)).toBe("new-token");
      expect(useStore.getState().operatorAuth).toEqual({ status: "connecting" });
      expect(ioMock).toHaveBeenCalledTimes(1);

      listeners.get("connect")?.(undefined);
      expect(useStore.getState().operatorAuth).toEqual({ status: "connected" });
      expect(useStore.getState().isConnected).toBe(true);
    });

    it("reports each PIN failure", async () => {
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();

      respondWith(401, { attemptsLeft: 3 });
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "wrong-pin", attemptsLeft: 3 });

      respondWith(429, { retryAfterSeconds: 600 });
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "locked", retryAfterSeconds: 600 });

      respondWith(404, {});
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "not-found" });

      respondWith(500, {});
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "error" });

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      await useStore.getState().submitOperatorPin("000000");
      expect(useStore.getState().operatorAuth).toEqual({ status: "error" });

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
    });

    it("ends the session when the token is rejected", async () => {
      sessionStorage.setItem(tokenKey, "stale");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });

      listeners.get("connect_error")?.(new Error("Authentication error: Operator session ended"));

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin", sessionEnded: true });
      expect(useStore.getState().gameState).toBeNull();
      expect(useStore.getState().socket).toBeNull();
      expect(socketMock.disconnect).toHaveBeenCalled();
    });

    it("ends the session when the server disconnects the socket", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("connect")?.(undefined);

      listeners.get("disconnect")?.("io server disconnect");

      expect(sessionStorage.getItem(tokenKey)).toBeNull();
      expect(useStore.getState().operatorAuth).toEqual({ status: "needs-pin", sessionEnded: true });
    });

    it("keeps the token through a dropped connection", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("connect")?.(undefined);

      listeners.get("disconnect")?.("transport close");

      expect(sessionStorage.getItem(tokenKey)).toBe("good");
      expect(useStore.getState().operatorAuth).toEqual({ status: "connected" });
      expect(useStore.getState().isConnected).toBe(false);
    });

    it("retries after a server fault during the handshake, keeping the token", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      vi.useFakeTimers();
      useStore.getState().ensureInitialized();

      listeners.get("connect_error")?.(new Error("Authentication error: Could not check operator session"));

      expect(sessionStorage.getItem(tokenKey)).toBe("good");
      expect((socketMock as any).connect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect((socketMock as any).connect).toHaveBeenCalledTimes(1);
    });

    it("leaves retries to Socket.IO when it is already reconnecting", async () => {
      (socketMock as any).active = true;
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      vi.useFakeTimers();
      useStore.getState().ensureInitialized();

      listeners.get("connect_error")?.(new Error("xhr poll error"));
      vi.advanceTimersByTime(2000);

      expect((socketMock as any).connect).not.toHaveBeenCalled();
    });

    it("doesn't touch the owner's local game cache", async () => {
      localStorage.setItem("scoreboard:gameStateCache:v1", '{"period":"owner"}');
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();

      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });
      useStore.getState().updateState({ period: "2nd" });

      expect(useStore.getState().gameState?.period).toBe("2nd");
      expect(localStorage.getItem("scoreboard:gameStateCache:v1")).toBe('{"period":"owner"}');
    });

    it("keeps a change on top of older server state until it is confirmed", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("gameState")?.({ ...baseState, serverTime: 1 });

      useStore.getState().updateState({ period: "2nd" });
      listeners.get("gameState")?.({ ...baseState, serverTime: 2 });

      expect(useStore.getState().gameState?.period).toBe("2nd");
    });

    it("applies the owner's Deck and shortcut config, adding missing default shortcuts", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      const defaults = useStore.getState().keyboardShortcuts;
      const streamDeck = { buttons: [{ id: "1", label: "Owner" }] };
      const custom = { ...defaults[0], key: "z" };

      listeners.get("operatorConfig")?.({ streamDeck, shortcuts: [custom] });

      expect(useStore.getState().streamDeckConfig).toEqual(streamDeck);
      expect(useStore.getState().keyboardShortcuts).toHaveLength(defaults.length);
      expect(useStore.getState().keyboardShortcuts[0]).toEqual(custom);
    });

    it("keeps the defaults when the config is null", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      const { streamDeckConfig, keyboardShortcuts } = useStore.getState();

      listeners.get("operatorConfig")?.({ streamDeck: null, shortcuts: null });

      expect(useStore.getState().streamDeckConfig).toBe(streamDeckConfig);
      expect(useStore.getState().keyboardShortcuts).toBe(keyboardShortcuts);
    });

    it("tracks the owner's active game", async () => {
      sessionStorage.setItem(tokenKey, "good");
      const { useStore } = await import("../store");
      useStore.getState().ensureInitialized();
      listeners.get("activeGame")?.(null);
      expect(useStore.getState().activeGameId).toBeNull();
      listeners.get("activeGame")?.("game-1");
      expect(useStore.getState().activeGameId).toBe("game-1");
    });
  });
});
