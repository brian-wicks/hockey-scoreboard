import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { User, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";

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
  colorSource?: "custom" | "home" | "away";
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
  undoState: Partial<GameState> | null;

  // Auth State
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  shareId: string | null;
  isViewer: boolean;
  savedGames: { id: string; name: string; createdAt: number }[];

  connect: () => void;
  connectViewer: (shareId: string) => void;
  ensureInitialized: () => void;
  setAuthError: (error: string | null) => void;
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

  // Game Management Actions
  loadSavedGames: () => Promise<void>;
  saveGame: (name: string) => Promise<void>;
  loadGame: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  resetGame: () => void;

  // Auth Actions
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
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
    {
      "id": "btn-0",
      "label": "HOME GOAL",
      "action": "homeScoreUp",
      "backgroundColor": "#1e3a8a",
      "textColor": "#ffffff",
      "icon": "Goal",
      "colorSource": "home"
    },
    {
      "id": "btn-1",
      "label": "HOME SHOT",
      "action": "homeShotsUp",
      "backgroundColor": "#1e40af",
      "textColor": "#ffffff",
      "icon": "Puck",
      "colorSource": "home"
    },
    {
      "id": "btn-2",
      "label": "Start/Stop",
      "action": "toggleClock",
      "backgroundColor": "#065f46",
      "textColor": "#ffffff",
      "icon": "Timer"
    },
    {
      "id": "btn-3",
      "label": "AWAY SHOT",
      "action": "awayShotsUp",
      "backgroundColor": "#991b1b",
      "textColor": "#ffffff",
      "icon": "Puck",
      "colorSource": "away"
    },
    {
      "id": "btn-4",
      "label": "AWAY GOAL",
      "action": "awayScoreUp",
      "backgroundColor": "#7f1d1d",
      "textColor": "#ffffff",
      "icon": "Goal",
      "colorSource": "away"
    },
    {
      "id": "btn-5",
      "label": "Home -1",
      "action": "homeScoreDown",
      "backgroundColor": "#1e3a8a",
      "textColor": "#ffffff",
      "icon": "ChevronDown",
      "colorSource": "home"
    },
    {
      "id": "btn-6",
      "label": "H. Shots -1",
      "action": "homeShotsDown",
      "backgroundColor": "#1e40af",
      "textColor": "#ffffff",
      "icon": "ChevronDown",
      "colorSource": "home"
    },
    {
      "id": "btn-7",
      "label": "Next Period",
      "action": "nextPeriod",
      "backgroundColor": "#3f3f46",
      "textColor": "#ffffff",
      "icon": "ArrowRight"
    },
    {
      "id": "btn-8",
      "label": "A. Shots -1",
      "action": "awayShotsDown",
      "backgroundColor": "#991b1b",
      "textColor": "#ffffff",
      "icon": "ChevronDown",
      "colorSource": "away"
    },
    {
      "id": "btn-9",
      "label": "Away -1",
      "action": "awayScoreDown",
      "backgroundColor": "#7f1d1d",
      "textColor": "#ffffff",
      "icon": "ChevronDown",
      "colorSource": "away"
    },
    {
      "id": "btn-10",
      "label": "H. Penalty",
      "action": "homePenaltyAdd",
      "backgroundColor": "#1e3a8a",
      "textColor": "#ffffff",
      "icon": "Whistle",
      "colorSource": "home"
    },
    {
      "id": "btn-11",
      "label": "Remove Penalty",
      "action": "homePenaltyRemoveEarliest",
      "backgroundColor": "#1e40af",
      "textColor": "#ffffff",
      "icon": "RotateCcw",
      "colorSource": "home"
    },
    {
      "id": "btn-12",
      "label": "Previous Period",
      "action": "prevPeriod",
      "backgroundColor": "#3f3f46",
      "textColor": "#ffffff",
      "icon": "ArrowLeft"
    },
    {
      "id": "btn-13",
      "label": "Remove Penalty",
      "action": "awayPenaltyRemoveEarliest",
      "backgroundColor": "#991b1b",
      "textColor": "#ffffff",
      "icon": "RotateCcw",
      "colorSource": "away"
    },
    {
      "id": "btn-14",
      "label": "A. Penalty",
      "action": "awayPenaltyAdd",
      "backgroundColor": "#7f1d1d",
      "textColor": "#ffffff",
      "icon": "Whistle",
      "colorSource": "away"
    }
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
  user: null,
  authLoading: true,
  authError: null,
  shareId: null,
  isViewer: false,
  savedGames: [],

  setUser: (user) => set((state) => ({ 
    user, 
    authError: state.isViewer ? state.authError : null 
  })),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setAuthError: (authError) => set({ authError, authLoading: false }),

  login: async () => {
    try {
      set({ authError: null });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      set({ authError: "Login failed. Please try again." });
    }
  },

  logout: async () => {
    try {
      const { socket } = get();
      if (socket) {
        socket.disconnect();
      }
      await signOut(auth);
      hasInitialized = false;
      set({ user: null, gameState: null, socket: null, isViewer: false, shareId: null, authError: null, savedGames: [] });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  loadSavedGames: async () => {
    const { user } = get();
    if (!user) {
      console.warn("loadSavedGames called but no user is logged in");
      return;
    }
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      console.log(`Loading saved games from ${apiUrl}/api/games`);
      const response = await fetch(`${apiUrl}/api/games`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to load saved games: ${response.status} ${response.statusText}`, errorText);
        return;
      }
      const data = await response.json();
      console.log(`Loaded ${Array.isArray(data) ? data.length : 0} saved games`);
      if (Array.isArray(data)) {
        set({ savedGames: data });
      } else {
        console.error("Received non-array response for saved games:", data);
      }
    } catch (error) {
      console.error("Failed to load saved games:", error);
    }
  },

  saveGame: async (name: string) => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      console.log(`Saving game "${name}" to ${apiUrl}/api/games`);
      const response = await fetch(`${apiUrl}/api/games`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        console.log("Game saved successfully");
        await get().loadSavedGames();
      } else {
        const errorText = await response.text();
        console.error(`Failed to save game: ${response.status} ${response.statusText}`, errorText);
      }
    } catch (error) {
      console.error("Failed to save game:", error);
    }
  },

  loadGame: async (id: string) => {
    const { user, socket } = get();
    if (!user || !socket) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      console.log(`Loading game ${id} from ${apiUrl}/api/games/${id}`);
      const response = await fetch(`${apiUrl}/api/games/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const game = await response.json();
        const gameState = JSON.parse(game.state);
        set({ gameState });
        saveCachedState(gameState);
        socket.emit("updateGameState", gameState);
        console.log("Game loaded and socket updated");
      } else {
        const errorText = await response.text();
        console.error(`Failed to load game: ${response.status} ${response.statusText}`, errorText);
      }
    } catch (error) {
      console.error("Failed to load game:", error);
    }
  },

  deleteGame: async (id: string) => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      console.log(`Deleting game ${id} via ${apiUrl}/api/games/${id}`);
      const response = await fetch(`${apiUrl}/api/games/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        console.log("Game deleted successfully");
        await get().loadSavedGames();
      } else {
        const errorText = await response.text();
        console.error(`Failed to delete game: ${response.status} ${response.statusText}`, errorText);
      }
    } catch (error) {
      console.error("Failed to delete game:", error);
    }
  },

  resetGame: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("resetGame");
      set({ undoState: null });
    }
  },

  connectViewer: async (shareId: string) => {
    try {
      set({ shareId, isViewer: true, authLoading: true, authError: null });
      
      // Disconnect existing socket if any
      if (get().socket) {
        get().socket?.disconnect();
      }

      const socketUrl = BASE_URL === window.location.origin ? undefined : BASE_URL;
      const socket = io(socketUrl, {
        auth: { shareId },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        console.log("Viewer connected to server for share:", shareId);
        set({ isConnected: true, authLoading: false, authError: null });
      });

      socket.on("disconnect", () => {
        set({ isConnected: false });
      });

      socket.on("connect_error", (error) => {
        console.error("Viewer connection error:", error.message);
        set({ isConnected: false, authError: error.message, authLoading: false });
      });

      socket.on("gameState", (state: GameState) => {
        const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
        const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
        set({ gameState: state, serverTimeOffsetMs, authLoading: false, authError: null });
      });

      set({ socket, isConnected: socket.connected });

      // Load initial state via API as well to be fast
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/share/${shareId}/state`);
      if (response.ok) {
        const state = await response.json();
        const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
        const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
        set({ gameState: state, serverTimeOffsetMs, authLoading: false, authError: null });
      } else {
        const data = await response.json().catch(() => ({}));
        set({ 
          authError: data.error || "Invalid or expired share link", 
          authLoading: false
        });
        socket.disconnect();
      }
    } catch (error) {
      console.error("Failed to connect viewer:", error);
      set({ 
        authError: "Failed to connect to the shared scoreboard", 
        authLoading: false
      });
    }
  },

  connect: async () => {
    const { user } = get();
    if (!user) return;

    try {
      set({ authError: null });
      const token = await user.getIdToken();
      
      // Disconnect existing socket if any
      if (get().socket) {
        get().socket?.disconnect();
      }

      // Use relative URL if the base URL matches the current origin or if no base URL is provided
      const socketUrl = BASE_URL === window.location.origin ? undefined : BASE_URL;

      const socket = io(socketUrl, {
        auth: { token },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        console.log("Connected to server");
        set({ isConnected: true, authError: null, authLoading: false });
      });

      socket.on("disconnect", () => {
        set({ isConnected: false });
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error.message);
        set({ isConnected: false, authError: `Connection error: ${error.message}`, authLoading: false });
      });

      socket.on("gameState", (state: GameState) => {
        const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
        const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
        set({ gameState: state, serverTimeOffsetMs });
        saveCachedState(state);
      });

      set({ socket, isConnected: socket.connected });
    } catch (error) {
      console.error("Failed to connect to socket:", error);
      set({ authLoading: false, authError: "Failed to connect to server" });
    }
  },

  ensureInitialized: () => {
    if (hasInitialized) return;
    
    // Check for share ID in URL
    const pathParts = window.location.pathname.split("/");
    const shareIndex = pathParts.indexOf("share");
    if (shareIndex !== -1 && pathParts[shareIndex + 1]) {
      const shareId = pathParts[shareIndex + 1];
      hasInitialized = true;
      get().connectViewer(shareId);
      return;
    }

    const { user } = get();
    if (!user) return; // Wait for user to be available
    
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
    void get().loadSavedGames();
  },

  updateState: (updates: Partial<GameState>) => {
    const { socket, gameState } = get();
    if (socket && gameState) {
      if (shouldSnapshotForUndo(updates)) {
        const snapshot: Partial<GameState> = {};
        if (updates.homeTeam) snapshot.homeTeam = gameState.homeTeam;
        if (updates.awayTeam) snapshot.awayTeam = gameState.awayTeam;
        set({ undoState: snapshot });
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
    const newState = { ...gameState, ...undoState };
    set({ gameState: newState, undoState: null });
    saveCachedState(newState);
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

  updateShortcut: async (index: number, shortcut: KeyboardShortcut) => {
    const { user } = get();
    if (!user) return;
    
    const shortcuts = [...get().keyboardShortcuts];
    shortcuts[index] = shortcut;
    set({ keyboardShortcuts: shortcuts });

    try {
      const token = await user.getIdToken();
      // Use relative path if BASE_URL matches origin
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      fetch(`${apiUrl}/api/shortcuts`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(shortcuts),
      }).catch((error) => console.error("Failed to save shortcuts:", error));
    } catch (error) {
      console.error("Failed to get token for shortcut update:", error);
    }
  },

  resetShortcuts: async () => {
    const { user } = get();
    if (!user) return;

    set({ keyboardShortcuts: [...defaultShortcuts] });

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      fetch(`${apiUrl}/api/shortcuts`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(defaultShortcuts),
      }).catch((error) => console.error("Failed to save shortcuts:", error));
    } catch (error) {
      console.error("Failed to get token for shortcut reset:", error);
    }
  },

  loadShortcuts: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/shortcuts`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
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

  updateStreamDeckButton: async (index: number, button: StreamDeckButton) => {
    const { user } = get();
    if (!user) return;

    const config = { ...get().streamDeckConfig };
    config.buttons = [...config.buttons];
    config.buttons[index] = button;
    set({ streamDeckConfig: config });

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      fetch(`${apiUrl}/api/streamdeck`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(config),
      }).catch((error) => console.error("Failed to save Stream Deck config:", error));
    } catch (error) {
      console.error("Failed to get token for Stream Deck update:", error);
    }
  },

  loadStreamDeckConfig: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/streamdeck`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (data && data.buttons) {
        set({ streamDeckConfig: data });
      }
    } catch (error) {
      console.error("Failed to load Stream Deck config from server:", error);
    }
  },
}));
