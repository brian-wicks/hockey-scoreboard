import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { User, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./lib/firebase";
import { getBaseUrl, isLocalMode } from "./lib/localMode";
import { OPERATOR_SESSION_ENDED_ERROR } from "./lib/operatorAccess";
import { applyGamePatch, createDeleteEventPatch, createGamePatch, invertGamePatch, isUndoable, type GamePatch } from "./utils/gamePatch";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");
const BASE_URL = normalizeBaseUrl(getBaseUrl());

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
  | "period_start"
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
  /** The patch that caused the server to log this event, so that undoing the patch can remove it. */
  opId?: string;
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

export interface TeamIdentity {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

export interface TeamPresetTeam extends TeamIdentity {
  players: TeamPlayer[];
}

export interface SavedTeam {
  name: string;
  team: TeamPresetTeam;
  updatedAt: number;
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

export type OperatorAuth =
  | { status: "needs-pin"; sessionEnded?: boolean }
  | { status: "submitting" }
  | { status: "wrong-pin"; attemptsLeft: number }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "not-found" }
  | { status: "no-pin" }
  | { status: "error" }
  | { status: "connecting" }
  | { status: "connected" };

interface StoreState {
  socket: Socket | null;
  gameState: GameState | null;
  isConnected: boolean;
  serverTimeOffsetMs: number;
  keyboardShortcuts: KeyboardShortcut[];
  streamDeckConfig: StreamDeckConfig;
  /** The patch that reverses each undoable action, oldest first. */
  undoStack: GamePatch[];
  /** Changes sent to the server and not yet confirmed. */
  pendingPatches: { patch: GamePatch; sentAt: number }[];

  // Auth State
  user: User | null;
  authLoading: boolean;
  authError: string | null;
  shareId: string | null;
  isViewer: boolean;
  isOperator: boolean;
  operatorId: string | null;
  operatorAuth: OperatorAuth;
  savedGames: { id: string; name: string; createdAt: number; updatedAt: number }[];
  teamLibrary: SavedTeam[];
  // undefined = not yet known (still connecting); null = known to have no game open.
  activeGameId: string | null | undefined;

  connect: () => void;
  connectViewer: (shareId: string) => void;
  connectOperator: (operatorId: string, token: string) => void;
  submitOperatorPin: (pin: string) => Promise<void>;
  ensureInitialized: () => void;
  setAuthError: (error: string | null) => void;
  updateState: (updates: Partial<GameState>) => void;
  deleteEvent: (eventId: string) => void;
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
  openGame: (id: string) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  startNewGame: (teams?: { homeTeam: TeamState; awayTeam: TeamState }) => Promise<void>;

  // Team Library Actions
  loadTeamLibrary: () => Promise<void>;
  saveTeamToLibrary: (name: string, team: TeamPresetTeam) => Promise<void>;
  deleteTeamFromLibrary: (name: string) => Promise<void>;

  // Auth Actions
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultShortcuts: KeyboardShortcut[] = [
  { key: " ", action: "toggleClock", description: "Toggle clock" },
  { key: "ArrowUp", action: "clockIncrease", description: "Increase clock" },
  { key: "ArrowDown", action: "clockDecrease", description: "Decrease clock" },
  { key: "ArrowLeft", action: "homeScoreUp", description: "Home score +1" },
  { key: "ArrowRight", action: "awayScoreUp", description: "Away score +1" },
  { key: "ArrowLeft", ctrl: true, action: "homeShotsUp", description: "Home shots +1" },
  { key: "ArrowRight", ctrl: true, action: "awayShotsUp", description: "Away shots +1" },
  { key: "ArrowLeft", shift: true, action: "homeScoreDown", description: "Home score -1" },
  { key: "ArrowRight", shift: true, action: "awayScoreDown", description: "Away score -1" },
  { key: "ArrowLeft", ctrl: true, shift: true, action: "homeShotsDown", description: "Home shots -1" },
  { key: "ArrowRight", ctrl: true, shift: true, action: "awayShotsDown", description: "Away shots -1" },
  { key: "ArrowLeft", alt: true, action: "homePenaltyAdd", description: "Add home penalty" },
  { key: "ArrowRight", alt: true, action: "awayPenaltyAdd", description: "Add away penalty" },
  {
    key: "ArrowLeft",
    shift: true,
    alt: true,
    action: "homePenaltyRemoveEarliest",
    description: "Remove earliest home penalty",
  },
  {
    key: "ArrowRight",
    shift: true,
    alt: true,
    action: "awayPenaltyRemoveEarliest",
    description: "Remove earliest away penalty",
  },
  { key: "[", action: "prevPeriod", description: "Previous period" },
  { key: "]", action: "nextPeriod", description: "Next period" },
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
export const MAX_UNDO_STEPS = 20;

// Long enough for a very slow connection, short enough that a change the server never
// confirmed doesn't sit on top of its state for long.
const PENDING_PATCH_MAX_AGE_MS = 15_000;

const sendPatch = (
  socket: Socket,
  patch: GamePatch,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) => {
  const { activeGameId } = get();
  const stamped: GamePatch = typeof activeGameId === "string" ? { ...patch, gameId: activeGameId } : patch;
  const newState = applyGamePatch(get().gameState!, stamped);
  set({
    gameState: newState,
    pendingPatches: [...get().pendingPatches, { patch: stamped, sentAt: Date.now() }],
  });
  cacheGameState(get, newState);
  socket.emit("applyGamePatch", stamped, () => {
    set({ pendingPatches: get().pendingPatches.filter((pending) => pending.patch.opId !== stamped.opId) });
  });
};

// The trailing argument on a clock event, naming the game it was made for.
const clockScope = (state: StoreState): [{ gameId: string }] | [] =>
  typeof state.activeGameId === "string" ? [{ gameId: state.activeGameId }] : [];

const receiveActiveGame = (
  gameId: string | null,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) => {
  const previous = get().activeGameId;
  if (previous !== undefined && previous !== gameId) {
    // These were worked out against the old game, and undoing or replaying them would change the new one.
    set({ activeGameId: gameId, undoStack: [], pendingPatches: [] });
    return;
  }
  set({ activeGameId: gameId });
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

// A second operator may be on the owner's computer, so their session leaves the cached game alone.
const cacheGameState = (get: () => StoreState, state: GameState) => {
  if (!get().isOperator) saveCachedState(state);
};

const receiveGameState = (
  state: GameState,
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
) => {
  const serverTime = typeof state.serverTime === "number" ? state.serverTime : null;
  const serverTimeOffsetMs = serverTime === null ? get().serverTimeOffsetMs : serverTime - Date.now();
  // Clock ticks arrive up to 10 times a second, and can be from before the server saw
  // the operator's latest change. Keep that change on top until the server confirms it.
  const oldestPending = Date.now() - PENDING_PATCH_MAX_AGE_MS;
  const pendingPatches = get().pendingPatches.filter((pending) => pending.sentAt >= oldestPending);
  const gameState = pendingPatches.reduce((next, pending) => applyGamePatch(next, pending.patch), state);
  set({ gameState, serverTimeOffsetMs, pendingPatches });
  cacheGameState(get, gameState);
};

const withMissingDefaultShortcuts = (shortcuts: KeyboardShortcut[]): KeyboardShortcut[] => {
  const existingActions = new Set(shortcuts.map((shortcut) => shortcut.action));
  return [...shortcuts, ...defaultShortcuts.filter((shortcut) => !existingActions.has(shortcut.action))];
};

const operatorTokenKey = (operatorId: string) => `scoreboard:operatorToken:${operatorId}`;

const loadOperatorToken = (operatorId: string): string | null => {
  try {
    return sessionStorage.getItem(operatorTokenKey(operatorId));
  } catch {
    return null;
  }
};

const saveOperatorToken = (operatorId: string, token: string) => {
  try {
    sessionStorage.setItem(operatorTokenKey(operatorId), token);
  } catch {
    // The session still works until the page is reloaded.
  }
};

const clearOperatorToken = (operatorId: string) => {
  try {
    sessionStorage.removeItem(operatorTokenKey(operatorId));
  } catch {
    // ignore storage failures
  }
};

const OPERATOR_HANDSHAKE_RETRY_MS = 2000;

export const useStore = create<StoreState>((set, get) => ({
  socket: null,
  gameState: null,
  isConnected: false,
  serverTimeOffsetMs: 0,
  keyboardShortcuts: [...defaultShortcuts],
  streamDeckConfig: defaultStreamDeckConfig,
  undoStack: [],
  pendingPatches: [],
  user: null,
  authLoading: true,
  authError: null,
  shareId: null,
  isViewer: false,
  isOperator: false,
  operatorId: null,
  operatorAuth: { status: "needs-pin" },
  savedGames: [],
  teamLibrary: [],
  activeGameId: undefined,

  setUser: (user) => set((state) => ({ 
    user, 
    authError: state.isViewer ? state.authError : null 
  })),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setAuthError: (authError) => set({ authError, authLoading: false }),

  login: async () => {
    // Local mode is already "signed in" as the local operator (see App.tsx).
    if (isLocalMode() || !auth || !googleProvider) return;
    try {
      set({ authError: null });
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      set({ authError: "Login failed. Please try again." });
    }
  },

  logout: async () => {
    // Signing out of local mode would strand the operator on a sign-in screen
    // that cannot complete without internet.
    if (isLocalMode()) return;
    try {
      const { socket } = get();
      if (socket) {
        socket.disconnect();
      }
      if (auth) await signOut(auth);
      hasInitialized = false;
      set({ user: null, gameState: null, socket: null, isViewer: false, shareId: null, authError: null, savedGames: [], teamLibrary: [], undoStack: [], pendingPatches: [], activeGameId: undefined });
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

  openGame: async (id: string) => {
    const { socket } = get();
    if (!socket) return;
    set({ pendingPatches: [] });
    await new Promise<void>((resolve) => {
      socket.emit("openGame", id, (result: { ok: boolean; error?: string }) => {
        if (!result?.ok) {
          console.error(`Failed to open game ${id}:`, result?.error);
        } else {
          set({ undoStack: [] });
        }
        resolve();
      });
    });
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

  startNewGame: async (teams?: { homeTeam: TeamState; awayTeam: TeamState }) => {
    const { socket } = get();
    if (!socket) return;
    await new Promise<void>((resolve) => {
      // The server creates and saves the new game, then acks — team sanitization
      // and persistence happen atomically server-side, rather than this racing a
      // separate updateState call against a clock tick from the outgoing game.
      set({ pendingPatches: [] });
      socket.emit("startNewGame", teams, () => {
        set({ undoStack: [] });
        resolve();
      });
    });
  },

  loadTeamLibrary: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/teams`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        console.error(`Failed to load team library: ${response.status} ${response.statusText}`);
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        set({ teamLibrary: data });
      }
    } catch (error) {
      console.error("Failed to load team library:", error);
    }
  },

  saveTeamToLibrary: async (name: string, team: TeamPresetTeam) => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, team }),
      });
      if (!response.ok) {
        throw new Error(`Failed to save team: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (Array.isArray(data?.teams)) {
        set({ teamLibrary: data.teams });
      }
    } catch (error) {
      console.error("Failed to save team to library:", error);
      throw error;
    }
  },

  deleteTeamFromLibrary: async (name: string) => {
    const { user } = get();
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/teams/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to delete team: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (Array.isArray(data?.teams)) {
        set({ teamLibrary: data.teams });
      }
    } catch (error) {
      console.error("Failed to delete team from library:", error);
      throw error;
    }
  },

  connectOperator: (operatorId: string, token: string) => {
    get().socket?.disconnect();
    set({ operatorAuth: { status: "connecting" } });

    const socketUrl = BASE_URL === window.location.origin ? undefined : BASE_URL;
    const socket = io(socketUrl, {
      auth: { operatorId, operatorToken: token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    const endSession = () => {
      clearOperatorToken(operatorId);
      socket.disconnect();
      set({
        socket: null,
        isConnected: false,
        gameState: null,
        activeGameId: undefined,
        undoStack: [],
        pendingPatches: [],
        operatorAuth: { status: "needs-pin", sessionEnded: true },
      });
    };

    socket.on("connect", () => {
      set({ isConnected: true, operatorAuth: { status: "connected" } });
    });

    socket.on("disconnect", (reason: string) => {
      // Socket.IO won't reconnect by itself after this reason, and the owner only
      // disconnects a second operator when signing them out.
      if (reason === "io server disconnect") {
        endSession();
        return;
      }
      set({ isConnected: false, pendingPatches: [] });
    });

    socket.on("connect_error", (error: Error) => {
      if (error.message === OPERATOR_SESSION_ENDED_ERROR) {
        endSession();
        return;
      }
      set({ isConnected: false });
      // An error from server middleware stops Socket.IO retrying, and a database fault
      // during the handshake shouldn't leave the second operator stuck.
      if (!socket.active) {
        setTimeout(() => {
          if (get().socket === socket) socket.connect();
        }, OPERATOR_HANDSHAKE_RETRY_MS);
      }
    });

    socket.on("gameState", (state: GameState) => {
      receiveGameState(state, get, set);
    });

    socket.on("activeGame", (gameId: string | null) => {
      receiveActiveGame(gameId, get, set);
    });

    socket.on("operatorConfig", (config: { streamDeck: StreamDeckConfig | null; shortcuts: KeyboardShortcut[] | null }) => {
      if (config.streamDeck?.buttons) set({ streamDeckConfig: config.streamDeck });
      if (Array.isArray(config.shortcuts)) set({ keyboardShortcuts: withMissingDefaultShortcuts(config.shortcuts) });
    });

    set({ socket, isConnected: socket.connected });
  },

  submitOperatorPin: async (pin: string) => {
    const { operatorId } = get();
    if (!operatorId) return;
    set({ operatorAuth: { status: "submitting" } });
    try {
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;
      const response = await fetch(`${apiUrl}/api/operator/${encodeURIComponent(operatorId)}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.token === "string") {
        saveOperatorToken(operatorId, data.token);
        get().connectOperator(operatorId, data.token);
      } else if (response.status === 401) {
        set({ operatorAuth: { status: "wrong-pin", attemptsLeft: data.attemptsLeft } });
      } else if (response.status === 429) {
        set({ operatorAuth: { status: "locked", retryAfterSeconds: data.retryAfterSeconds } });
      } else if (response.status === 404) {
        set({ operatorAuth: { status: "not-found" } });
      } else if (response.status === 409) {
        set({ operatorAuth: { status: "no-pin" } });
      } else {
        set({ operatorAuth: { status: "error" } });
      }
    } catch (error) {
      console.error("Failed to check operator PIN:", error);
      set({ operatorAuth: { status: "error" } });
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
        // Share links often drive an unattended overlay or jumbotron, so keep trying for as
        // long as the page is open rather than freezing after a short outage.
        reconnectionAttempts: Infinity,
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

      // Disconnect existing socket if any
      if (get().socket) {
        get().socket?.disconnect();
      }

      // Use relative URL if the base URL matches the current origin or if no base URL is provided
      const socketUrl = BASE_URL === window.location.origin ? undefined : BASE_URL;

      const socket = io(socketUrl, {
        // A function (rather than a static token) is re-invoked on every reconnection
        // attempt, not just the initial connect — without this, a socket that drops
        // after the ~1hr Firebase ID token lifetime would retry forever with the same
        // stale token and never reconnect.
        auth: (cb) => {
          user.getIdToken().then((token) => cb({ token })).catch(() => cb({ token: null }));
        },
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
        // Anything sent before the drop will never be confirmed. It either reached the server
        // and is in the state it sends on reconnect, or it's gone. Changes made while offline
        // are queued by the socket and added after this.
        set({ isConnected: false, pendingPatches: [] });
      });

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error.message);
        set({ isConnected: false, authError: `Connection error: ${error.message}`, authLoading: false });
      });

      socket.on("gameState", (state: GameState) => {
        receiveGameState(state, get, set);
      });

      socket.on("activeGame", (gameId: string | null) => {
        receiveActiveGame(gameId, get, set);
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
    // Checked before the signed-in user, so this route never uses the owner's account.
    if (pathParts[1] === "operate" && pathParts[2]) {
      const operatorId = pathParts[2];
      hasInitialized = true;
      set({ isOperator: true, operatorId, authLoading: false });
      const token = loadOperatorToken(operatorId);
      if (token) get().connectOperator(operatorId, token);
      return;
    }

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
    void get().loadTeamLibrary();
  },

  updateState: (updates: Partial<GameState>) => {
    const { socket, gameState, undoStack } = get();
    if (socket && gameState) {
      const patch = createGamePatch(gameState, updates);
      if (!patch) return;
      if (isUndoable(patch)) {
        set({ undoStack: [...undoStack, invertGamePatch(patch, gameState)].slice(-MAX_UNDO_STEPS) });
      }
      sendPatch(socket, patch, get, set);
    }
  },

  deleteEvent: (eventId: string) => {
    const { socket, gameState, undoStack } = get();
    if (!socket || !gameState) return;
    const patch = createDeleteEventPatch(gameState, eventId);
    if (!patch) return;
    set({ undoStack: [...undoStack, invertGamePatch(patch, gameState)].slice(-MAX_UNDO_STEPS) });
    sendPatch(socket, patch, get, set);
  },

  undoLastUpdate: () => {
    const { socket, undoStack, gameState } = get();
    if (!socket || !gameState || undoStack.length === 0) return;
    set({ undoStack: undoStack.slice(0, -1) });
    sendPatch(socket, undoStack[undoStack.length - 1], get, set);
  },

  startClock: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("startClock", ...clockScope(get()));
    }
  },

  stopClock: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("stopClock", ...clockScope(get()));
    }
  },

  setClock: (timeMs: number) => {
    const { socket } = get();
    if (socket) {
      socket.emit("setClock", timeMs, ...clockScope(get()));
    }
  },

  clockIncrease: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("clockIncrease", ...clockScope(get()));
    }
  },

  clockDecrease: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("clockDecrease", ...clockScope(get()));
    }
  },

  updateShortcut: async (index: number, shortcut: KeyboardShortcut) => {
    const { user } = get();
    if (!user) return;

    const previousShortcuts = get().keyboardShortcuts;
    const shortcuts = [...previousShortcuts];
    shortcuts[index] = shortcut;
    set({ keyboardShortcuts: shortcuts });

    try {
      const token = await user.getIdToken();
      // Use relative path if BASE_URL matches origin
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      const response = await fetch(`${apiUrl}/api/shortcuts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(shortcuts),
      });
      if (!response.ok) {
        throw new Error(`Failed to save shortcuts: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Roll back the optimistic update so the UI doesn't keep showing a change
      // that never actually made it to the server — otherwise it would silently
      // revert only on the next reload, with no indication anything went wrong.
      console.error("Failed to save shortcuts:", error);
      set({ keyboardShortcuts: previousShortcuts });
    }
  },

  resetShortcuts: async () => {
    const { user } = get();
    if (!user) return;

    const previousShortcuts = get().keyboardShortcuts;
    set({ keyboardShortcuts: [...defaultShortcuts] });

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      const response = await fetch(`${apiUrl}/api/shortcuts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(defaultShortcuts),
      });
      if (!response.ok) {
        throw new Error(`Failed to reset shortcuts: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to reset shortcuts:", error);
      set({ keyboardShortcuts: previousShortcuts });
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
        set({ keyboardShortcuts: withMissingDefaultShortcuts(data) });
      }
    } catch (error) {
      console.error("Failed to load shortcuts from server:", error);
    }
  },

  updateStreamDeckButton: async (index: number, button: StreamDeckButton) => {
    const { user } = get();
    if (!user) return;

    const previousConfig = get().streamDeckConfig;
    const config = { ...previousConfig };
    config.buttons = [...config.buttons];
    config.buttons[index] = button;
    set({ streamDeckConfig: config });

    try {
      const token = await user.getIdToken();
      const apiUrl = BASE_URL === window.location.origin ? "" : BASE_URL;

      // Save to server
      const response = await fetch(`${apiUrl}/api/streamdeck`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        throw new Error(`Failed to save Stream Deck config: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to save Stream Deck config:", error);
      set({ streamDeckConfig: previousConfig });
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
