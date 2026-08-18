import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(socketMock.emit).toHaveBeenCalledWith("updateGameState", { period: "2nd" });
    expect(useStore.getState().gameState?.period).toBe("2nd");
  });

  it("supports undo for score/shots/penalty updates", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, gameState: baseState });

    useStore.getState().updateState({
      homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 },
    });

    expect(useStore.getState().undoStack.at(-1)?.homeTeam?.score).toBe(baseState.homeTeam.score);
    useStore.getState().undoLastUpdate();

    expect(socketMock.emit).toHaveBeenCalledWith("updateGameState", {
      eventLog: baseState.eventLog,
      homeTeam: baseState.homeTeam,
    });
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

    // ...and the server broadcasts back a state with the new "goal" event appended.
    const goalEvent = { id: "evt-1", type: "goal", team: "home", period: "1st", clockTime: "20:00", createdAt: 1 } as const;
    const stateWithGoalEvent: GameState = {
      ...useStore.getState().gameState!,
      eventLog: [goalEvent],
    };
    useStore.setState({ gameState: stateWithGoalEvent });
    expect(useStore.getState().gameState?.eventLog).toHaveLength(1);

    useStore.getState().undoLastUpdate();

    // Undo must tell the server to revert to the pre-goal eventLog (event gone),
    // not append a compensating "goal_revoked" entry.
    expect(socketMock.emit).toHaveBeenCalledWith("updateGameState", {
      eventLog: baseState.eventLog,
      homeTeam: baseState.homeTeam,
    });
    expect(useStore.getState().gameState?.eventLog).toEqual(baseState.eventLog);
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
    const shortcut: KeyboardShortcut = { key: "A", action: "toggleClock", description: "Toggle Clock" };
    await useStore.getState().updateShortcut(0, shortcut);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("loads shortcuts and fills missing defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve([{ key: " ", action: "toggleClock", description: "Toggle Clock" } satisfies KeyboardShortcut]),
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

  it("resets shortcuts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    useStore.setState({ user: mockUser as any });

    await useStore.getState().resetShortcuts();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/shortcuts"), expect.objectContaining({ method: "POST" }));
  });

  it("performs full cleanup on logout, including the undo stack", async () => {
    const { useStore } = await import("../store");
    useStore.setState({ socket: socketMock as any, user: mockUser as any, undoStack: [{ homeTeam: baseState.homeTeam }] });

    await useStore.getState().logout();
    expect(socketMock.disconnect).toHaveBeenCalled();
    expect(useStore.getState().user).toBeNull();
    expect(useStore.getState().gameState).toBeNull();
    // A leftover undo entry from the previous operator's session must not be able to
    // splice their data into whichever account signs in next on the same machine.
    expect(useStore.getState().undoStack).toEqual([]);
  });

  it("clears the undo stack when loading a saved game", async () => {
    const savedGameState = { ...baseState, homeTeam: { ...baseState.homeTeam, score: 9 } };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ state: JSON.stringify(savedGameState) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");
    useStore.setState({
      socket: socketMock as any,
      user: mockUser as any,
      gameState: baseState,
      // Stale undo entry from the previously loaded/edited game.
      undoStack: [{ homeTeam: baseState.homeTeam }],
    });

    await useStore.getState().loadGame("game-1");

    // The stale entry must not survive — undoing right after a load must not splice
    // an unrelated game's team/event data back into the just-loaded game.
    expect(useStore.getState().undoStack).toEqual([]);
    expect(useStore.getState().gameState?.homeTeam.score).toBe(9);
  });
});
