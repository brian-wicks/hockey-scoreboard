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
  overlayLayout: "main" | "corner";
  overlayCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  overlayTheme: "dark" | "light";
  serverTime?: number;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action:
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
    | "awayPenaltyRemoveEarliest";
  description: string;
}

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  serverTimeOffsetMs: number;
  keyboardShortcuts: KeyboardShortcut[];
  connect: () => void;
  updateState: (updates: Partial<GameState>) => void;
  startClock: () => void;
  stopClock: () => void;
  clockIncrease: () => void;
  clockDecrease: () => void;
  setClock: (timeMs: number) => void;
  updateShortcut: (index: number, shortcut: KeyboardShortcut) => void;
  resetShortcuts: () => void;
  loadShortcuts: () => Promise<void>;
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
];

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  serverTimeOffsetMs: 0,
  keyboardShortcuts: [...defaultShortcuts],

  connect: () => {
    const socket = io(BASE_URL);

    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("gameState", (state: GameState) => {
      const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
      const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
      set({ gameState: state, serverTimeOffsetMs });
    });

    set({ socket });
  },

  updateState: (updates: Partial<GameState>) => {
    const { socket, gameState } = get();
    if (socket && gameState) {
      const newState = { ...gameState, ...updates };
      set({ gameState: newState });
      socket.emit("updateGameState", updates);
    }
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
}));
