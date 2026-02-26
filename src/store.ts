import { create } from "zustand";
import { io, Socket } from "socket.io-client";

export interface Penalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
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
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: "toggleClock" | "homeScoreUp" | "awayScoreUp" | "homeShotsUp" | "awayShotsUp" | "homeScoreDown" | "awayScoreDown" | "homeShotsDown" | "awayShotsDown";
  description: string;
}

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  keyboardShortcuts: KeyboardShortcut[];
  connect: () => void;
  updateState: (updates: Partial<GameState>) => void;
  startClock: () => void;
  stopClock: () => void;
  setClock: (timeMs: number) => void;
  updateShortcut: (index: number, shortcut: KeyboardShortcut) => void;
  resetShortcuts: () => void;
  loadShortcuts: () => Promise<void>;
}

const defaultShortcuts: KeyboardShortcut[] = [
  { key: " ", action: "toggleClock", description: "Toggle Clock" },
  { key: "h", action: "homeScoreUp", description: "Home Score +1" },
  { key: "a", action: "awayScoreUp", description: "Away Score +1" },
  { key: "s", action: "homeShotsUp", description: "Home Shots +1" },
  { key: "d", action: "awayShotsUp", description: "Away Shots +1" },
  { key: "h", shift: true, action: "homeScoreDown", description: "Home Score -1" },
  { key: "a", shift: true, action: "awayScoreDown", description: "Away Score -1" },
  { key: "s", shift: true, action: "homeShotsDown", description: "Home Shots -1" },
  { key: "d", shift: true, action: "awayShotsDown", description: "Away Shots -1" },
];

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  keyboardShortcuts: [...defaultShortcuts],

  connect: () => {
    const socket = io("http://localhost:3000");

    socket.on("connect", () => {
      console.log("Connected to server");
    });

    socket.on("gameState", (state: GameState) => {
      set({ gameState: state });
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

  updateShortcut: (index: number, shortcut: KeyboardShortcut) => {
    const shortcuts = [...get().keyboardShortcuts];
    shortcuts[index] = shortcut;
    set({ keyboardShortcuts: shortcuts });

    // Save to server
    fetch("http://localhost:3000/api/shortcuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shortcuts),
    }).catch((error) => console.error("Failed to save shortcuts:", error));
  },

  resetShortcuts: () => {
    set({ keyboardShortcuts: [...defaultShortcuts] });

    // Save to server
    fetch("http://localhost:3000/api/shortcuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(defaultShortcuts),
    }).catch((error) => console.error("Failed to save shortcuts:", error));
  },

  loadShortcuts: async () => {
    try {
      const response = await fetch("http://localhost:3000/api/shortcuts");
      const data = await response.json();
      if (data && Array.isArray(data)) {
        set({ keyboardShortcuts: data });
      }
    } catch (error) {
      console.error("Failed to load shortcuts from server:", error);
    }
  },
}));
