import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import admin from "firebase-admin";
import cors from "cors";
import { 
  getUserConfig, 
  setUserConfig, 
  getGameState, 
  saveGameState,
  getShareUserId,
  getUserIdShare,
  setUserIdShare
} from "./src/db/database.ts";

// Initialize Firebase Admin
let serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
  : null;

if (serviceAccount && serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT not found in environment variables. Authentication will fail.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Penalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
  infraction: string;
}

type EventType = "goal" | "goal_revoked" | "penalty_added" | "penalty_over_notice" | "period_end";

interface GameEvent {
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
  removalReason?: "manual" | "expired";
  note?: string;
  readOnly?: boolean;
  createdAt: number;
}

interface TeamState {
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

type PlayerPosition = "" | "C" | "A" | "NM";

interface TeamPlayer {
  id: string;
  jerseyNumber: string;
  name: string;
  position: PlayerPosition;
}

interface TeamIdentity {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

interface TeamPresetTeam extends TeamIdentity {
  players: TeamPlayer[];
}

interface TeamDefaults {
  homeTeam: TeamPresetTeam;
  awayTeam: TeamPresetTeam;
}

interface TeamPreset extends TeamDefaults {
  homeTeam: TeamPresetTeam;
  awayTeam: TeamPresetTeam;
  name: string;
  updatedAt: number;
}

interface SavedTeam {
  name: string;
  team: TeamPresetTeam;
  updatedAt: number;
}

interface ClockState {
  timeRemaining: number;
  isRunning: boolean;
  lastUpdate: number;
}

interface GameState {
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
}

export interface ScoreboardServerOptions {
  dataDir?: string;
  now?: () => number;
  randomId?: () => string;
}

export function createScoreboardServer(options: ScoreboardServerOptions = {}) {
  const dataDir = options.dataDir ?? __dirname;
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? (() => Math.random().toString(36).slice(2, 11));

  const SHORTCUTS_FILE = join(dataDir, "shortcuts.json");
  const STREAMDECK_FILE = join(dataDir, "streamdeck.json");
  const TEAM_DEFAULTS_FILE = join(dataDir, "team-defaults.json");
  const TEAM_PRESETS_FILE = join(dataDir, "team-presets.json");
  const TEAM_LIBRARY_FILE = join(dataDir, "team-library.json");
  const PDF_LAYOUT_FILE = join(dataDir, "gamesheet-layout.json");

  const app = express();
  
  // Simple request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins in development for debugging
      callback(null, true);
    },
    credentials: true
  }));
  app.use(express.json());

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
      credentials: true
    },
    allowEIO3: true
  });

  // Per-user contexts
  interface UserContext {
    gameState: GameState;
    clockInterval: NodeJS.Timeout | null;
  }
  const userContexts = new Map<string, UserContext>();

  function getInitialGameState(userId: string): GameState {
    const savedState = getGameState(userId);
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error(`Error parsing saved game state for user ${userId}:`, e);
      }
    }

    const persistedDefaults = readTeamDefaults(userId);
    return {
      homeTeam: persistedDefaults ? { ...baseHomeTeam, ...persistedDefaults.homeTeam } : baseHomeTeam,
      awayTeam: persistedDefaults ? { ...baseAwayTeam, ...persistedDefaults.awayTeam } : baseAwayTeam,
      clock: {
        timeRemaining: 20 * 60 * 1000,
        isRunning: false,
        lastUpdate: now(),
      },
      period: "1st",
      eventLog: [],
      overlayVisible: true,
      overlayLayout: "main",
      jumbotronGradientsEnabled: true,
      lowerThird: { active: false, title: "", subtitle: "" },
      jumbotronGoalHighlight: null,
    };
  }

  function getUserContext(userId: string): UserContext {
    let context = userContexts.get(userId);
    if (!context) {
      context = {
        gameState: getInitialGameState(userId),
        clockInterval: null,
      };
      userContexts.set(userId, context);
    }
    return context;
  }

  const baseHomeTeam: TeamState = {
    name: "Home Team",
    abbreviation: "HOM",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#3b82f6",
    penalties: [],
    players: [],
  };

  const baseAwayTeam: TeamState = {
    name: "Away Team",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#ef4444",
    penalties: [],
    players: [],
  };

  function extractTeamIdentity(team: TeamState): TeamIdentity {
    return {
      name: team.name,
      abbreviation: team.abbreviation,
      logo: team.logo,
      color: team.color,
    };
  }

  function normalizeTeamPlayers(players: unknown): TeamPlayer[] {
    if (!Array.isArray(players)) return [];
    return players.map((player, index) => {
      const raw = (player ?? {}) as Partial<TeamPlayer>;
      const rawPosition = String(raw.position ?? "").toUpperCase();
      const position: PlayerPosition = rawPosition === "C" || rawPosition === "A" || rawPosition === "NM" ? rawPosition : "";
      return {
        id: String(raw.id ?? randomId() ?? `p-${now()}-${index}`),
        jerseyNumber: String(raw.jerseyNumber ?? "")
          .replace(/\D/g, "")
          .slice(0, 2),
        name: String(raw.name ?? "").trim(),
        position,
      };
    });
  }

  function extractPresetTeam(team: TeamState): TeamPresetTeam {
    return {
      ...extractTeamIdentity(team),
      players: normalizeTeamPlayers(team.players),
    };
  }

  function normalizePresetTeam(data: unknown): TeamPresetTeam {
    const raw = (data ?? {}) as Partial<TeamPresetTeam>;
    return {
      name: String(raw.name ?? "").trim(),
      abbreviation: String(raw.abbreviation ?? "").trim(),
      logo: String(raw.logo ?? "").trim(),
      color: String(raw.color ?? "").trim(),
      players: normalizeTeamPlayers(raw.players),
    };
  }

  function readTeamDefaults(userId: string): TeamDefaults | null {
    try {
      const dataStr = getUserConfig(userId, "team-defaults");
      const data = dataStr ? JSON.parse(dataStr) : null;
      if (!data) {
        // Fallback to global file for initial default if it exists
        if (existsSync(TEAM_DEFAULTS_FILE)) {
          const fileData = JSON.parse(readFileSync(TEAM_DEFAULTS_FILE, "utf-8"));
          return {
            homeTeam: normalizePresetTeam(fileData.homeTeam),
            awayTeam: normalizePresetTeam(fileData.awayTeam),
          } as TeamDefaults;
        }
        return null;
      }
      return {
        homeTeam: normalizePresetTeam(data.homeTeam),
        awayTeam: normalizePresetTeam(data.awayTeam),
      } as TeamDefaults;
    } catch (error) {
      console.error("Error reading team defaults:", error);
      return null;
    }
  }

  function writeTeamDefaults(userId: string, defaults: TeamDefaults) {
    setUserConfig(userId, "team-defaults", JSON.stringify(defaults));
  }

  function readPdfLayout(userId: string): unknown | null {
    try {
      const dataStr = getUserConfig(userId, "pdf-layout");
      if (dataStr) return JSON.parse(dataStr);
      
      if (existsSync(PDF_LAYOUT_FILE)) {
        return JSON.parse(readFileSync(PDF_LAYOUT_FILE, "utf-8"));
      }
      return null;
    } catch (error) {
      console.error("Error reading PDF layout:", error);
      return null;
    }
  }

  function writePdfLayout(userId: string, layout: unknown) {
    setUserConfig(userId, "pdf-layout", JSON.stringify(layout));
  }

  function readTeamPresets(userId: string): TeamPreset[] {
    try {
      const dataStr = getUserConfig(userId, "team-presets");
      const data = dataStr ? JSON.parse(dataStr) : null;
      if (!Array.isArray(data)) {
        if (existsSync(TEAM_PRESETS_FILE)) {
          return JSON.parse(readFileSync(TEAM_PRESETS_FILE, "utf-8"));
        }
        return [];
      }
      return data
        .map((preset) => {
          const raw = (preset ?? {}) as Partial<TeamPreset>;
          const name = String(raw.name ?? "").trim();
          if (!name) return null;

          return {
            name,
            homeTeam: normalizePresetTeam(raw.homeTeam),
            awayTeam: normalizePresetTeam(raw.awayTeam),
            updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now(),
          } as TeamPreset;
        })
        .filter((preset): preset is TeamPreset => Boolean(preset));
    } catch (error) {
      console.error("Error reading team presets:", error);
      return [];
    }
  }

  function writeTeamPresets(userId: string, presets: TeamPreset[]) {
    setUserConfig(userId, "team-presets", JSON.stringify(presets));
  }

  function readTeamLibrary(userId: string): SavedTeam[] {
    try {
      const dataStr = getUserConfig(userId, "team-library");
      const data = dataStr ? JSON.parse(dataStr) : null;
      if (!Array.isArray(data)) {
        if (existsSync(TEAM_LIBRARY_FILE)) {
          return JSON.parse(readFileSync(TEAM_LIBRARY_FILE, "utf-8"));
        }
        return [];
      }
      return data
        .map((entry) => {
          const raw = (entry ?? {}) as Partial<SavedTeam>;
          const name = String(raw.name ?? "").trim();
          if (!name) return null;
          return {
            name,
            team: normalizePresetTeam(raw.team),
            updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now(),
          } as SavedTeam;
        })
        .filter((entry): entry is SavedTeam => Boolean(entry));
    } catch (error) {
      console.error("Error reading team library:", error);
      return [];
    }
  }

  function writeTeamLibrary(userId: string, teams: SavedTeam[]) {
    setUserConfig(userId, "team-library", JSON.stringify(teams));
  }

  function formatClockTime(timeRemainingMs: number): string {
    const totalSeconds = Math.ceil(Math.max(0, timeRemainingMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  function createBaseEvent(gameState: GameState, type: EventType, team: "home" | "away"): Omit<GameEvent, "id" | "createdAt"> {
    return {
      type,
      team,
      period: gameState.period,
      clockTime: formatClockTime(gameState.clock.timeRemaining),
    };
  }

  function createPeriodEndEvent(gameState: GameState): Omit<GameEvent, "id" | "createdAt"> {
    return {
      type: "period_end",
      team: "home",
      period: gameState.period,
      clockTime: "0:00",
      readOnly: true,
      note: "End of period",
    };
  }

  function appendEvent(gameState: GameState, event: Omit<GameEvent, "id" | "createdAt">) {
    gameState.eventLog = [
      ...gameState.eventLog,
      {
        id: randomId(),
        createdAt: now(),
        ...event,
      },
    ];
  }

  function getMostRecentGoalDetails(gameState: GameState, team: "home" | "away"): Pick<GameEvent, "scorer" | "assist1" | "assist2"> {
    const latestGoal = [...gameState.eventLog]
      .reverse()
      .find((event) => event.type === "goal" && event.team === team);
    return {
      scorer: latestGoal?.scorer ?? "",
      assist1: latestGoal?.assist1 ?? "",
      assist2: latestGoal?.assist2 ?? "",
    };
  }

  function getPenaltyDiff(previous: Penalty[] = [], next: Penalty[] = []) {
    const prevById = new Map((previous || []).map((penalty) => [penalty.id, penalty]));
    const nextById = new Map((next || []).map((penalty) => [penalty.id, penalty]));
    const added = (next || []).filter((penalty) => !prevById.has(penalty.id));
    const removed = (previous || []).filter((penalty) => !nextById.has(penalty.id));
    return { added, removed };
  }

  function logScoreAndPenaltyChanges(userId: string, gameState: GameState, previousState: GameState, nextState: GameState) {
    const homeGoalDelta = nextState.homeTeam.score - previousState.homeTeam.score;
    const awayGoalDelta = nextState.awayTeam.score - previousState.awayTeam.score;

    if (homeGoalDelta > 0) {
      for (let i = 0; i < homeGoalDelta; i += 1) {
        appendEvent(gameState, createBaseEvent(gameState, "goal", "home"));
      }
    } else if (homeGoalDelta < 0) {
      for (let i = 0; i < Math.abs(homeGoalDelta); i += 1) {
        appendEvent(gameState, {
          ...createBaseEvent(gameState, "goal_revoked", "home"),
          ...getMostRecentGoalDetails(gameState, "home"),
        });
      }
    }

    if (awayGoalDelta > 0) {
      for (let i = 0; i < awayGoalDelta; i += 1) {
        appendEvent(gameState, createBaseEvent(gameState, "goal", "away"));
      }
    } else if (awayGoalDelta < 0) {
      for (let i = 0; i < Math.abs(awayGoalDelta); i += 1) {
        appendEvent(gameState, {
          ...createBaseEvent(gameState, "goal_revoked", "away"),
          ...getMostRecentGoalDetails(gameState, "away"),
        });
      }
    }

    const homePenaltyDiff = getPenaltyDiff(previousState.homeTeam.penalties, nextState.homeTeam.penalties);
    homePenaltyDiff.added.forEach((penalty) =>
      appendEvent(gameState, {
        ...createBaseEvent(gameState, "penalty_added", "home"),
        penaltyId: penalty.id,
        penaltyDurationMs: penalty.duration,
        playerNumber: penalty.playerNumber,
        infraction: penalty.infraction,
      }),
    );
    homePenaltyDiff.removed.forEach((penalty) => closePenaltyEvent(gameState, "home", penalty, "manual"));

    const awayPenaltyDiff = getPenaltyDiff(previousState.awayTeam.penalties, nextState.awayTeam.penalties);
    awayPenaltyDiff.added.forEach((penalty) =>
      appendEvent(gameState, {
        ...createBaseEvent(gameState, "penalty_added", "away"),
        penaltyId: penalty.id,
        penaltyDurationMs: penalty.duration,
        playerNumber: penalty.playerNumber,
        infraction: penalty.infraction,
      }),
    );
    awayPenaltyDiff.removed.forEach((penalty) => closePenaltyEvent(gameState, "away", penalty, "manual"));
  }

  function syncActivePenaltyEventDetails(state: GameState) {
    const activePenalties = new Map<string, Penalty>();
    (state.homeTeam.penalties || []).forEach((penalty) => activePenalties.set(`home:${penalty.id}`, penalty));
    (state.awayTeam.penalties || []).forEach((penalty) => activePenalties.set(`away:${penalty.id}`, penalty));

    state.eventLog = (state.eventLog || []).map((event) => {
      if (event.type !== "penalty_added" || !event.penaltyId) {
        return event;
      }
      const activePenalty = activePenalties.get(`${event.team}:${event.penaltyId}`);
      if (!activePenalty) {
        return event;
      }
      return {
        ...event,
        playerNumber: activePenalty.playerNumber,
        infraction: activePenalty.infraction,
        penaltyDurationMs: activePenalty.duration,
      };
    });
  }

  function syncActivePenaltyStateFromEventLog(state: GameState): GameState {
    const applyTeam = (teamKey: "homeTeam" | "awayTeam", side: "home" | "away"): TeamState => {
      const activeEventsByPenaltyId = new Map(
        state.eventLog
          .filter((event) => event.type === "penalty_added" && event.team === side && event.penaltyId && !event.endClockTime)
          .map((event) => [event.penaltyId as string, event]),
      );

      const existingById = new Map<string, Penalty>();
      (state[teamKey].penalties || []).forEach((penalty) => existingById.set(penalty.id, penalty));

      // When the client supplies a full eventLog update, treat it as authoritative for
      // which penalties are currently active (penalty_added without endClockTime).
      const nextPenalties: Penalty[] = [];
      activeEventsByPenaltyId.forEach((sourceEvent, penaltyId) => {
        const existing = existingById.get(penaltyId);
        const duration = sourceEvent.penaltyDurationMs ?? existing?.duration ?? 120000;
        const playerNumber = (sourceEvent.playerNumber ?? existing?.playerNumber ?? "").replace(/\D/g, "").slice(0, 2);
        const infraction = sourceEvent.infraction ?? existing?.infraction ?? "";
        const timeRemaining = existing?.timeRemaining ?? duration;

        nextPenalties.push({
          id: penaltyId,
          duration,
          timeRemaining,
          playerNumber,
          infraction,
        });
      });

      return {
        ...state[teamKey],
        penalties: nextPenalties,
      };
    };

    return {
      ...state,
      homeTeam: applyTeam("homeTeam", "home"),
      awayTeam: applyTeam("awayTeam", "away"),
    };
  }

  function tickTeamPenalties(gameState: GameState, team: TeamState, side: "home" | "away", elapsedMs: number): Penalty[] {
    const nextPenalties: Penalty[] = [];

    team.penalties.forEach((penalty) => {
      const nextRemaining = Math.max(0, penalty.timeRemaining - elapsedMs);
      if (nextRemaining > 100) {
        nextPenalties.push({ ...penalty, timeRemaining: nextRemaining });
        return;
      }

      closePenaltyEvent(gameState, side, penalty, "expired");
    });

    return nextPenalties;
  }

  function closePenaltyEvent(gameState: GameState, side: "home" | "away", penalty: Penalty, reason: "manual" | "expired") {
    const eventIndex = [...gameState.eventLog]
      .map((event, index) => ({ event, index }))
      .reverse()
      .find(({ event }) => event.type === "penalty_added" && event.team === side && event.penaltyId === penalty.id && !event.endClockTime)?.index;

    const endClockTime = formatClockTime(gameState.clock.timeRemaining);

    if (typeof eventIndex === "number") {
      gameState.eventLog = gameState.eventLog.map((event, index) =>
        index === eventIndex
          ? {
              ...event,
              playerNumber: penalty.playerNumber,
              infraction: penalty.infraction,
              endClockTime,
              removalReason: reason,
            }
          : event,
      );
    }

    appendEvent(gameState, {
      ...createBaseEvent(gameState, "penalty_over_notice", side),
      penaltyId: penalty.id,
      playerNumber: penalty.playerNumber,
      infraction: penalty.infraction,
      removalReason: reason,
      note: "Penalty is over",
      readOnly: true,
    });
  }

  function buildGameStatePayload(gameState: GameState) {
    return { ...gameState, serverTime: now() };
  }

  function emitGameState(userId: string) {
    const context = getUserContext(userId);
    io.to(userId).emit("gameState", buildGameStatePayload(context.gameState));
    saveGameState(userId, JSON.stringify(context.gameState));
  }

  function emitGameStateTo(socket: Socket, gameState: GameState) {
    socket.emit("gameState", buildGameStatePayload(gameState));
  }

  function persistCurrentTeamDefaults(userId: string, gameState: GameState) {
    writeTeamDefaults(userId, {
      homeTeam: extractPresetTeam(gameState.homeTeam),
      awayTeam: extractPresetTeam(gameState.awayTeam),
    });
  }

  function startClockInterval(userId: string) {
    const context = getUserContext(userId);
    if (context.clockInterval) {
      clearInterval(context.clockInterval);
    }

    context.clockInterval = setInterval(() => {
      const { gameState } = context;
      if (gameState.clock.isRunning) {
        const currentTime = now();
        const elapsed = currentTime - gameState.clock.lastUpdate;
        gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
        gameState.clock.lastUpdate = currentTime;

        gameState.homeTeam.penalties = tickTeamPenalties(gameState, gameState.homeTeam, "home", elapsed);
        gameState.awayTeam.penalties = tickTeamPenalties(gameState, gameState.awayTeam, "away", elapsed);

        if (gameState.clock.timeRemaining <= 0) {
          gameState.clock.timeRemaining = 0;
          appendEvent(gameState, createPeriodEndEvent(gameState));
          gameState.clock.isRunning = false;
          if (context.clockInterval) {
            clearInterval(context.clockInterval);
            context.clockInterval = null;
          }
        }

        emitGameState(userId);
      }
    }, 100);
  }

  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const shareId = socket.handshake.auth.shareId;

    if (shareId) {
      const userId = getShareUserId(shareId);
      if (userId) {
        socket.data.userId = userId;
        socket.data.isViewer = true;
        console.log(`[Socket] Auth success: Viewer connected for share ${shareId} (User ${userId})`);
        return next();
      }
      console.warn(`[Socket] Auth failed: Invalid shareId ${shareId}`);
      return next(new Error("Authentication error: Invalid share link"));
    }

    if (!token) {
      console.warn(`[Socket] Auth failed: No token provided for socket ${socket.id}`);
      return next(new Error("Authentication error: Token required"));
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      socket.data.userId = decodedToken.uid;
      console.log(`[Socket] Auth success: User ${decodedToken.uid} verified`);
      next();
    } catch (error) {
      console.error(`[Socket] Auth Error for socket ${socket.id}:`, error);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Authentication Middleware for Express
  const authenticateExpress = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn(`[Express] Auth failed: Missing or invalid Authorization header for ${req.method} ${req.url}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      (req as any).user = decodedToken;
      console.log(`[Express] Auth success: User ${decodedToken.uid} verified for ${req.method} ${req.url}`);
      next();
    } catch (error) {
      console.error(`[Express] Auth Error for ${req.method} ${req.url}:`, error);
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    const isViewer = socket.data.isViewer === true;
    console.log(`User ${userId} connected via socket ${socket.id} (Viewer: ${isViewer})`);
    
    // Join a room for this user to enable per-user broadcasts
    socket.join(userId);

    const { gameState } = getUserContext(userId);
    emitGameStateTo(socket, gameState);

    socket.on("updateGameState", (updates: Partial<GameState>) => {
      if (isViewer) {
        console.warn(`[Socket] Unauthorized update attempt from viewer for user ${userId}`);
        return;
      }
      const context = getUserContext(userId);
      const previousState = { ...context.gameState };
      let nextState: GameState = { ...context.gameState, ...updates };
      const hasEventLogUpdate = Array.isArray(updates.eventLog);

      if (hasEventLogUpdate) {
        nextState = syncActivePenaltyStateFromEventLog(nextState);
      }

      context.gameState = nextState;
      if (!hasEventLogUpdate) {
        logScoreAndPenaltyChanges(userId, context.gameState, previousState, nextState);
      }
      syncActivePenaltyEventDetails(context.gameState);
      emitGameState(userId);
    });

    socket.on("startClock", () => {
      const context = getUserContext(userId);
      const { gameState } = context;
      if (!gameState.clock.isRunning && gameState.clock.timeRemaining > 0) {
        gameState.clock.isRunning = true;
        gameState.clock.lastUpdate = now();
        emitGameState(userId);
        startClockInterval(userId);
      }
    });

    socket.on("stopClock", () => {
      const context = getUserContext(userId);
      const { gameState } = context;
      if (gameState.clock.isRunning) {
        const currentTime = now();
        const elapsed = currentTime - gameState.clock.lastUpdate;
        gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
        gameState.homeTeam.penalties = tickTeamPenalties(gameState, gameState.homeTeam, "home", elapsed);
        gameState.awayTeam.penalties = tickTeamPenalties(gameState, gameState.awayTeam, "away", elapsed);
        gameState.clock.isRunning = false;
        gameState.clock.lastUpdate = currentTime;
        emitGameState(userId);
      }
    });

    socket.on("setClock", (timeMs: number) => {
      const context = getUserContext(userId);
      const { gameState } = context;
      gameState.clock.timeRemaining = timeMs;
      gameState.clock.lastUpdate = now();
      emitGameState(userId);
    });

    socket.on("clockIncrease", () => {
      const context = getUserContext(userId);
      const { gameState } = context;
      gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining + 1000);
      emitGameState(userId);
    });

    socket.on("clockDecrease", () => {
      const context = getUserContext(userId);
      const { gameState } = context;
      gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - 1000);
      emitGameState(userId);
    });

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected from socket ${socket.id}`);
    });
  });

  app.get("/api/shortcuts", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const dataStr = getUserConfig(userId, "shortcuts");
      if (dataStr) {
        res.json(JSON.parse(dataStr));
      } else {
        // Fallback to global file
        if (existsSync(SHORTCUTS_FILE)) {
          const data = readFileSync(SHORTCUTS_FILE, "utf-8");
          res.json(JSON.parse(data));
        } else {
          res.json(null);
        }
      }
    } catch (error) {
      console.error("Error reading shortcuts:", error);
      res.json(null);
    }
  });

  app.post("/api/shortcuts", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      setUserConfig(userId, "shortcuts", JSON.stringify(req.body));
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving shortcuts:", error);
      res.status(500).json({ success: false, error: "Failed to save shortcuts" });
    }
  });

  app.get("/api/streamdeck", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const dataStr = getUserConfig(userId, "streamdeck");
      if (dataStr) {
        res.json(JSON.parse(dataStr));
      } else {
        // Fallback to global file
        if (existsSync(STREAMDECK_FILE)) {
          const data = readFileSync(STREAMDECK_FILE, "utf-8");
          res.json(JSON.parse(data));
        } else {
          res.json(null);
        }
      }
    } catch (error) {
      console.error("Error reading Stream Deck config:", error);
      res.json(null);
    }
  });

  app.post("/api/streamdeck", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      setUserConfig(userId, "streamdeck", JSON.stringify(req.body));
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving Stream Deck config:", error);
      res.status(500).json({ success: false, error: "Failed to save Stream Deck config" });
    }
  });

  app.get("/api/pdf-layout", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    const layout = readPdfLayout(userId);
    if (!layout) {
      res.status(404).json({ error: "No saved PDF layout" });
      return;
    }
    res.json(layout);
  });

  app.post("/api/pdf-layout", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const layout = req.body;
      if (!layout || typeof layout !== "object") {
        res.status(400).json({ error: "Invalid layout" });
        return;
      }
      writePdfLayout(userId, layout);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving PDF layout:", error);
      res.status(500).json({ success: false, error: "Failed to save PDF layout" });
    }
  });

  app.get("/api/team-defaults", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    const { gameState } = getUserContext(userId);
    res.json({
      homeTeam: extractPresetTeam(gameState.homeTeam),
      awayTeam: extractPresetTeam(gameState.awayTeam),
    });
  });

  app.post("/api/team-defaults", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const context = getUserContext(userId);
      const updates = req.body as Partial<TeamDefaults>;
      if (updates.homeTeam) {
        const preset = normalizePresetTeam(updates.homeTeam);
        context.gameState.homeTeam = {
          ...context.gameState.homeTeam,
          name: preset.name || context.gameState.homeTeam.name,
          abbreviation: preset.abbreviation || context.gameState.homeTeam.abbreviation,
          logo: preset.logo ?? context.gameState.homeTeam.logo,
          color: preset.color || context.gameState.homeTeam.color,
          players: preset.players ?? context.gameState.homeTeam.players,
        };
      }
      if (updates.awayTeam) {
        const preset = normalizePresetTeam(updates.awayTeam);
        context.gameState.awayTeam = {
          ...context.gameState.awayTeam,
          name: preset.name || context.gameState.awayTeam.name,
          abbreviation: preset.abbreviation || context.gameState.awayTeam.abbreviation,
          logo: preset.logo ?? context.gameState.awayTeam.logo,
          color: preset.color || context.gameState.awayTeam.color,
          players: preset.players ?? context.gameState.awayTeam.players,
        };
      }
      persistCurrentTeamDefaults(userId, context.gameState);
      emitGameState(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving team defaults:", error);
      res.status(500).json({ success: false, error: "Failed to save team defaults" });
    }
  });

  app.get("/api/team-presets", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    res.json(readTeamPresets(userId));
  });

  app.post("/api/team-presets", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const context = getUserContext(userId);
      const payload = req.body as Partial<TeamPreset>;
      const name = String(payload.name ?? "").trim();
      if (!name) {
        return res.status(400).json({ success: false, error: "Preset name is required" });
      }

      const homeTeam = payload.homeTeam ? normalizePresetTeam(payload.homeTeam) : extractPresetTeam(context.gameState.homeTeam);
      const awayTeam = payload.awayTeam ? normalizePresetTeam(payload.awayTeam) : extractPresetTeam(context.gameState.awayTeam);

      const presets = readTeamPresets(userId);
      const existingIndex = presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
      const nextPreset: TeamPreset = {
        name,
        homeTeam,
        awayTeam,
        updatedAt: now(),
      };

      if (existingIndex >= 0) {
        presets[existingIndex] = nextPreset;
      } else {
        presets.push(nextPreset);
      }

      writeTeamPresets(userId, presets);
      res.json({ success: true, presets });
    } catch (error) {
      console.error("Error saving team preset:", error);
      res.status(500).json({ success: false, error: "Failed to save team preset" });
    }
  });

  app.delete("/api/team-presets/:name", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const name = decodeURIComponent(req.params.name);
      const presets = readTeamPresets(userId);
      const filtered = presets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase());
      writeTeamPresets(userId, filtered);
      res.json({ success: true, presets: filtered });
    } catch (error) {
      console.error("Error deleting team preset:", error);
      res.status(500).json({ success: false, error: "Failed to delete team preset" });
    }
  });

  app.get("/api/teams", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    res.json(readTeamLibrary(userId));
  });

  app.post("/api/teams", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const context = getUserContext(userId);
      const payload = req.body as Partial<SavedTeam>;
      const name = String(payload.name ?? "").trim();
      if (!name) {
        return res.status(400).json({ success: false, error: "Team name is required" });
      }

      const team = payload.team ? normalizePresetTeam(payload.team) : extractPresetTeam(context.gameState.homeTeam);
      const teams = readTeamLibrary(userId);
      const existingIndex = teams.findIndex((entry) => entry.name.toLowerCase() === name.toLowerCase());
      const nextEntry: SavedTeam = {
        name,
        team,
        updatedAt: now(),
      };

      if (existingIndex >= 0) {
        teams[existingIndex] = nextEntry;
      } else {
        teams.push(nextEntry);
      }

      writeTeamLibrary(userId, teams);
      res.json({ success: true, teams });
    } catch (error) {
      console.error("Error saving team entry:", error);
      res.status(500).json({ success: false, error: "Failed to save team entry" });
    }
  });

  app.delete("/api/teams/:name", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    try {
      const name = decodeURIComponent(req.params.name);
      const teams = readTeamLibrary(userId);
      const filtered = teams.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
      writeTeamLibrary(userId, filtered);
      res.json({ success: true, teams: filtered });
    } catch (error) {
      console.error("Error deleting team entry:", error);
      res.status(500).json({ success: false, error: "Failed to delete team entry" });
    }
  });

  app.get("/api/share", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    const shareId = getUserIdShare(userId);
    res.json({ shareId });
  });

  app.post("/api/share", authenticateExpress, (req, res) => {
    const userId = (req as any).user.uid;
    const shareId = randomId();
    setUserIdShare(userId, shareId);
    res.json({ shareId });
  });

  app.get("/api/share/:shareId/state", (req, res) => {
    const { shareId } = req.params;
    const userId = getShareUserId(shareId);
    if (!userId) {
      return res.status(404).json({ error: "Invalid share link" });
    }
    const { gameState } = getUserContext(userId);
    res.json(buildGameStatePayload(gameState));
  });

  app.use(express.static(join(__dirname, "dist")));

  app.get("*", (req, res) => {
    res.sendFile(join(__dirname, "dist", "index.html"));
  });

  function start(port: number) {
    return new Promise<number>((resolve) => {
      httpServer.listen(port, "0.0.0.0", () => {
        const address = httpServer.address();
        const selectedPort = typeof address === "object" && address ? address.port : port;
        console.log(`[Server] Listening on 0.0.0.0:${selectedPort}`);
        resolve(selectedPort);
      });
    });
  }

  function stop() {
    return new Promise<void>((resolve, reject) => {
      for (const context of userContexts.values()) {
        if (context.clockInterval) {
          clearInterval(context.clockInterval);
          context.clockInterval = null;
        }
      }
      const finalizeClose = () => {
        if (!httpServer.listening) {
          resolve();
          return;
        }
        httpServer.close((error) => {
          if (error) {
            if (error instanceof Error && error.message.includes("Server is not running")) {
              resolve();
              return;
            }
            reject(error);
            return;
          }
          resolve();
        });
      };
      io.close(() => finalizeClose());
    });
  }

  return {
    app,
    httpServer,
    io,
    start,
    stop,
  };
}
