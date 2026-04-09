import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, KeyboardShortcut } from "../store";

const listeners = new Map<string, (payload: any) => void>();
const socketMock = {
  on: vi.fn((event: string, handler: (payload: any) => void) => {
    listeners.set(event, handler);
  }),
  emit: vi.fn(),
};
const ioMock = vi.fn(() => socketMock);

vi.mock("socket.io-client", () => ({
  io: ioMock,
}));

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

    useStore.getState().connect();
    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(socketMock.on).toHaveBeenCalled();

    const handler = listeners.get("gameState");
    expect(handler).toBeDefined();
    handler?.({ ...baseState, serverTime: 1500 });

    expect(useStore.getState().gameState?.period).toBe("1st");
    expect(useStore.getState().serverTimeOffsetMs).toBe(500);
    nowSpy.mockRestore();
  });

  it("tracks socket connection state", async () => {
    const { useStore } = await import("../store");

    useStore.getState().connect();

    listeners.get("connect")?.(undefined);
    expect(useStore.getState().isConnected).toBe(true);

    listeners.get("disconnect")?.(undefined);
    expect(useStore.getState().isConnected).toBe(false);

    listeners.get("connect_error")?.(undefined);
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

    expect(useStore.getState().undoState?.homeTeam.score).toBe(baseState.homeTeam.score);
    useStore.getState().undoLastUpdate();

    expect(socketMock.emit).toHaveBeenCalledWith("updateGameState", baseState);
    expect(useStore.getState().gameState?.homeTeam.score).toBe(baseState.homeTeam.score);
  });

  it("hydrates from cached state before socket updates arrive", async () => {
    localStorage.setItem("scoreboard:gameStateCache:v1", JSON.stringify({ ...baseState, period: "cached" }));
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    useStore.getState().ensureInitialized();

    expect(useStore.getState().gameState?.period).toBe("cached");
  });

  it("posts shortcut updates to the server", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    const shortcut: KeyboardShortcut = { key: "A", action: "toggleClock", description: "Toggle Clock" };
    useStore.getState().updateShortcut(0, shortcut);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("loads shortcuts and fills missing defaults", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve([{ key: " ", action: "toggleClock", description: "Toggle Clock" } satisfies KeyboardShortcut]),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { useStore } = await import("../store");

    await useStore.getState().loadShortcuts();
    const shortcuts = useStore.getState().keyboardShortcuts;
    expect(shortcuts.length).toBeGreaterThan(1);
    expect(shortcuts.some((shortcut) => shortcut.action === "clockIncrease")).toBe(true);
  });
});
