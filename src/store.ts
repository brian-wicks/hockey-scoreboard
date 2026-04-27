import { create } from "zustand";
import { io, Socket } from "socket.io-client";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");
// @ts-ignore
const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
const BASE_URL = normalizeBaseUrl(baseUrl);

export interface Penalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
  infraction: string;
}

export type EventType =
  | "goal"
  | "goal_revoked"
  | "penalty_added"
  | "penalty_over_notice"
  | "shot_on_goal"
  | "goalie_change"
  | "period_end";

export interface GameEvent {
  id: string;
  type: EventType;
  team: "home" | "away";
  penaltyId?: string;
  penaltyDurationMs?: number;
  period: string;
  clockTime: string;
  endClockTime?: string;
  playerNumber?: string;
  infraction?: string;
  scorer?: string;
  assist1?: string;
  assist2?: string;
  goalie?: string;
  shotDelta?: number;
  removalReason?: "manual" | "expired";
  note?: string;
  readOnly?: boolean;
  createdAt: number;
}

export interface TeamState {
  name: string;
  abbreviation: string;
  score: number;
  shots: number;
  timeouts: number;
  logo: string;
  color: string;
  penalties: Penalty[];
  players: TeamPlayer[];
}

export type PlayerPosition = "" | "C" | "A" | "NM";

export interface TeamPlayer {
  id: string;
  jerseyNumber: string;
  name: string;
  position: PlayerPosition;
}

export interface ClockState {
  timeRemaining: number;
  isRunning: boolean;
  lastUpdate: number;
}

export interface GameState {
  homeTeam: TeamState;
  awayTeam: TeamState;
  clock: ClockState;
  period: string;
  eventLog: GameEvent[];
  overlayVisible: boolean;
  overlayLayout: "main";
  overlayCorner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  jumbotronGradientsEnabled: boolean;
  lowerThird?: {
    active: boolean;
    title: string;
    subtitle?: string;
  };
  jumbotronGoalHighlight?: {
    team: "home" | "away";
    scorer: string;
    assist1?: string;
    assist2?: string;
    expiresAt: number;
  } | null;
  serverTime?: number;
}

export type ShortcutAction =
  | "toggleClock"
  | "clockIncrease"
  | "clockDecrease"
  | "homeScoreUp"
  | "awayScoreUp"
  | "homeShotsUp"
  | "awayShotsUp"
  | "homeScoreDown"
  | "awayScoreDown"
  | "homeShotsDown"
  | "awayShotsDown"
  | "homePenaltyAdd"
  | "awayPenaltyAdd"
  | "homePenaltyRemoveEarliest"
  | "awayPenaltyRemoveEarliest"
  | "nextPeriod"
  | "prevPeriod";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: ShortcutAction;
  description: string;
}

export interface StreamDeckButton {
  id: string;
  label: string;
  action: ShortcutAction | "none";
  backgroundColor: string;
  textColor: string;
  icon?: string;
  image?: string;
}

export interface StreamDeckConfig {
  buttons: StreamDeckButton[];
}

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  isConnected: boolean;
  serverTimeOffsetMs: number;
  keyboardShortcuts: KeyboardShortcut[];
  streamDeckConfig: StreamDeckConfig;
  undoState: GameState | null;
  connect: () => void;
  ensureInitialized: () => void;
  updateState: (updates: Partial<GameState>) => void;
  undoLastUpdate: () => void;
  startClock: () => void;
  stopClock: () => void;
  clockIncrease: () => void;
  clockDecrease: () => void;
  setClock: (timeMs: number) => void;
  updateShortcut: (index: number, shortcut: KeyboardShortcut) => void;
  resetShortcuts: () => void;
  loadShortcuts: () => Promise<void>;
  updateStreamDeckButton: (index: number, button: StreamDeckButton) => void;
  loadStreamDeckConfig: () => Promise<void>;
}

const defaultShortcuts: KeyboardShortcut[] = [
  { key: " ", action: "toggleClock", description: "Toggle Clock" },
  { key: "ArrowUp", action: "clockIncrease", description: "Increase Clock" },
  { key: "ArrowDown", action: "clockDecrease", description: "Decrease Clock" },
  { key: "ArrowLeft", action: "homeScoreUp", description: "Home Score +1" },
  { key: "ArrowRight", action: "awayScoreUp", description: "Away Score +1" },
  { key: "ArrowLeft", ctrl: true, action: "homeShotsUp", description: "Home Shots +1" },
  { key: "ArrowRight", ctrl: true, action: "awayShotsUp", description: "Away Shots +1" },
  { key: "ArrowLeft", shift: true, action: "homeScoreDown", description: "Home Score -1" },
  { key: "ArrowRight", shift: true, action: "awayScoreDown", description: "Away Score -1" },
  { key: "ArrowLeft", ctrl: true, shift: true, action: "homeShotsDown", description: "Home Shots -1" },
  { key: "ArrowRight", ctrl: true, shift: true, action: "awayShotsDown", description: "Away Shots -1" },
  { key: "ArrowLeft", alt: true, action: "homePenaltyAdd", description: "Add Home Penalty" },
  { key: "ArrowRight", alt: true, action: "awayPenaltyAdd", description: "Add Away Penalty" },
  {
    key: "ArrowLeft",
    shift: true,
    alt: true,
    action: "homePenaltyRemoveEarliest",
    description: "Remove Earliest Home Penalty",
  },
  {
    key: "ArrowRight",
    shift: true,
    alt: true,
    action: "awayPenaltyRemoveEarliest",
    description: "Remove Earliest Away Penalty",
  },
  { key: "[", action: "prevPeriod", description: "Previous Period" },
  { key: "]", action: "nextPeriod", description: "Next Period" },
];

const defaultStreamDeckConfig: StreamDeckConfig = {
  buttons: [
    // Row 1: Home Score +1 | Home Shots +1 | Toggle Clock | Away Shots +1 | Away Score +1
    { id: "btn-0", label: "Home +1", action: "homeScoreUp", backgroundColor: "#1e3a8a", textColor: "#ffffff", icon: "Trophy" },
    { id: "btn-1", label: "H. Shots", action: "homeShotsUp", backgroundColor: "#1e40af", textColor: "#ffffff", icon: "Activity" },
    { id: "btn-2", label: "Start/Stop", action: "toggleClock", backgroundColor: "#065f46", textColor: "#ffffff", icon: "Timer" },
    { id: "btn-3", label: "A. Shots", action: "awayShotsUp", backgroundColor: "#991b1b", textColor: "#ffffff", icon: "Activity" },
    { id: "btn-4", label: "Away +1", action: "awayScoreUp", backgroundColor: "#7f1d1d", textColor: "#ffffff", icon: "Trophy" },

    // Row 2: Home Score -1 | Home Shots -1 | Clock +1s | Away Shots -1 | Away Score -1
    { id: "btn-5", label: "Home -1", action: "homeScoreDown", backgroundColor: "#1e3a8a", textColor: "#ffffff", icon: "Minus" },
    { id: "btn-6", label: "H. Shots -1", action: "homeShotsDown", backgroundColor: "#1e40af", textColor: "#ffffff", icon: "Minus" },
    { id: "btn-7", label: "Clock +1s", action: "clockIncrease", backgroundColor: "#3f3f46", textColor: "#ffffff", icon: "ChevronUp" },
    { id: "btn-8", label: "A. Shots -1", action: "awayShotsDown", backgroundColor: "#991b1b", textColor: "#ffffff", icon: "Minus" },
    { id: "btn-9", label: "Away -1", action: "awayScoreDown", backgroundColor: "#7f1d1d", textColor: "#ffffff", icon: "Minus" },

    // Row 3: Home Penalty | Home Pen Rem | Clock -1s | Away Pen Rem | Away Penalty
    { id: "btn-10", label: "H. Penalty", action: "homePenaltyAdd", backgroundColor: "#1e3a8a", textColor: "#ffffff", icon: "AlertCircle" },
    { id: "btn-11", label: "H. Pen Rem", action: "homePenaltyRemoveEarliest", backgroundColor: "#1e40af", textColor: "#ffffff", icon: "RotateCcw" },
    { id: "btn-12", label: "Clock -1s", action: "clockDecrease", backgroundColor: "#3f3f46", textColor: "#ffffff", icon: "ChevronDown" },
    { id: "btn-13", label: "A. Pen Rem", action: "awayPenaltyRemoveEarliest", backgroundColor: "#991b1b", textColor: "#ffffff", icon: "RotateCcw" },
    { id: "btn-14", label: "A. Penalty", action: "awayPenaltyAdd", backgroundColor: "#7f1d1d", textColor: "#ffffff", icon: "AlertCircle" },
  ],
};

let hasInitialized = false;
const STATE_CACHE_KEY = "scoreboard:gameStateCache:v1";

const shouldSnapshotForUndo = (updates: Partial<GameState>) => {
  const home = updates.homeTeam;
  const away = updates.awayTeam;
  return (
    (home && (typeof home.score === "number" || typeof home.shots === "number" || Array.isArray(home.penalties))) ||
    (away && (typeof away.score === "number" || typeof away.shots === "number" || Array.isArray(away.penalties)))
  );
};

const loadCachedState = (): GameState | null => {
  try {
    const raw = localStorage.getItem(STATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveCachedState = (state: GameState) => {
  try {
    localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(state));
  } catch {
    // ignore cache failures
  }
};

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  isConnected: false,
  serverTimeOffsetMs: 0,
  keyboardShortcuts: [...defaultShortcuts],
  streamDeckConfig: defaultStreamDeckConfig,
  undoState: null,

  connect: () => {
    const socket = io(BASE_URL);

    socket.on("connect", () => {
      console.log("Connected to server");
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      set({ isConnected: false });
    });

    socket.on("connect_error", () => {
      set({ isConnected: false });
    });

    socket.on("gameState", (state: GameState) => {
      const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
      const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
      set({ gameState: state, serverTimeOffsetMs });
      saveCachedState(state);
    });

    set({ socket, isConnected: socket.connected });
  },

  ensureInitialized: () => {
    if (hasInitialized) return;
    hasInitialized = true;
    if (!get().gameState) {
      const cached = loadCachedState();
      if (cached) {
        set({ gameState: cached });
      }
    }
    get().connect();
    void get().loadShortcuts();
    void get().loadStreamDeckConfig();
  },

  updateState: (updates: Partial<GameState>) => {
    const { socket, gameState } = get();
    if (socket && gameState) {
      if (shouldSnapshotForUndo(updates)) {
        set({ undoState: gameState });
      }
      const newState = { ...gameState, ...updates };
      set({ gameState: newState });
      saveCachedState(newState);
      socket.emit("updateGameState", updates);
    }
  },

  undoLastUpdate: () => {
    const { socket, undoState, gameState } = get();
    if (!socket || !undoState || !gameState) return;
    set({ gameState: undoState, undoState: null });
    saveCachedState(undoState);
    socket.emit("updateGameState", undoState);
  },

  startClock: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("startClock");
    }
  },

  stopClock: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("stopClock");
    }
  },

  setClock: (timeMs: number) => {
    const { socket } = get();
    if (socket) {
      socket.emit("setClock", timeMs);
    }
  },

  clockIncrease: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("clockIncrease");
    }
  },

  clockDecrease: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("clockDecrease");
    }
  },

  updateShortcut: (index: number, shortcut: KeyboardShortcut) => {
    const shortcuts = [...get().keyboardShortcuts];
    shortcuts[index] = shortcut;
    set({ keyboardShortcuts: shortcuts });

    // Save to server
    fetch(`${BASE_URL}/api/shortcuts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shortcuts),
    }).catch((error) => console.error("Failed to save shortcuts:", error));
  },

  resetShortcuts: () => {
    set({ keyboardShortcuts: [...defaultShortcuts] });

    // Save to server
    fetch(`${BASE_URL}/api/shortcuts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultShortcuts),
    }).catch((error) => console.error("Failed to save shortcuts:", error));
  },

  loadShortcuts: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/shortcuts`);
      const data = await response.json();
      if (data && Array.isArray(data)) {
        const existingActions = new Set(data.map((shortcut: KeyboardShortcut) => shortcut.action));
        const missingDefaults = defaultShortcuts.filter((shortcut) => !existingActions.has(shortcut.action));
        set({ keyboardShortcuts: [...data, ...missingDefaults] });
      }
    } catch (error) {
      console.error("Failed to load shortcuts from server:", error);
    }
  },

  updateStreamDeckButton: (index: number, button: StreamDeckButton) => {
    const config = { ...get().streamDeckConfig };
    config.buttons = [...config.buttons];
    config.buttons[index] = button;
    set({ streamDeckConfig: config });

    // Save to server
    fetch(`${BASE_URL}/api/streamdeck`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).catch((error) => console.error("Failed to save Stream Deck config:", error));
  },

  loadStreamDeckConfig: async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/streamdeck`);
      const data = await response.json();
      if (data && data.buttons) {
        set({ streamDeckConfig: data });
      }
    } catch (error) {
      console.error("Failed to load Stream Deck config from server:", error);
    }
  },
}));
