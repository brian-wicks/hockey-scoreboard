import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

const SHORTCUTS_FILE = join(__dirname, "shortcuts.json");
const TEAM_DEFAULTS_FILE = join(__dirname, "team-defaults.json");
const TEAM_PRESETS_FILE = join(__dirname, "team-presets.json");
const TEAM_LIBRARY_FILE = join(__dirname, "team-library.json");

interface Penalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
  infraction: string;
}

type EventType = "goal" | "goal_revoked" | "penalty_added" | "penalty_over_notice";

interface GameEvent {
  id: string;
  type: EventType;
  team: "home" | "away";
  penaltyId?: string;
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
  overlayLayout: "main" | "corner";
  overlayCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  overlayTheme: "dark" | "light";
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
      id: String(raw.id ?? Math.random().toString(36).slice(2, 11) ?? `p-${Date.now()}-${index}`),
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
function readTeamDefaultsFromDisk(): TeamDefaults | null {
  try {
    if (!existsSync(TEAM_DEFAULTS_FILE)) return null;
    const data = JSON.parse(readFileSync(TEAM_DEFAULTS_FILE, "utf-8"));
    if (!data?.homeTeam || !data?.awayTeam) return null;
    return {
      homeTeam: normalizePresetTeam(data.homeTeam),
      awayTeam: normalizePresetTeam(data.awayTeam),
    } as TeamDefaults;
  } catch (error) {
    console.error("Error reading team defaults:", error);
    return null;
  }
}

function writeTeamDefaultsToDisk(defaults: TeamDefaults) {
  try {
    writeFileSync(TEAM_DEFAULTS_FILE, JSON.stringify(defaults, null, 2));
  } catch (error) {
    console.error("Error saving team defaults:", error);
  }
}

function readTeamPresetsFromDisk(): TeamPreset[] {
  try {
    if (!existsSync(TEAM_PRESETS_FILE)) return [];
    const data = JSON.parse(readFileSync(TEAM_PRESETS_FILE, "utf-8"));
    if (!Array.isArray(data)) return [];
    return data
      .map((preset) => {
        const raw = (preset ?? {}) as Partial<TeamPreset>;
        const name = String(raw.name ?? "").trim();
        if (!name) return null;

        return {
          name,
          homeTeam: normalizePresetTeam(raw.homeTeam),
          awayTeam: normalizePresetTeam(raw.awayTeam),
          updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
        } as TeamPreset;
      })
      .filter((preset): preset is TeamPreset => Boolean(preset));
  } catch (error) {
    console.error("Error reading team presets:", error);
    return [];
  }
}

function writeTeamPresetsToDisk(presets: TeamPreset[]) {
  try {
    writeFileSync(TEAM_PRESETS_FILE, JSON.stringify(presets, null, 2));
  } catch (error) {
    console.error("Error saving team presets:", error);
  }
}

function readTeamLibraryFromDisk(): SavedTeam[] {
  try {
    if (!existsSync(TEAM_LIBRARY_FILE)) return [];
    const data = JSON.parse(readFileSync(TEAM_LIBRARY_FILE, "utf-8"));
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) => {
        const raw = (entry ?? {}) as Partial<SavedTeam>;
        const name = String(raw.name ?? "").trim();
        if (!name) return null;
        return {
          name,
          team: normalizePresetTeam(raw.team),
          updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
        } as SavedTeam;
      })
      .filter((entry): entry is SavedTeam => Boolean(entry));
  } catch (error) {
    console.error("Error reading team library:", error);
    return [];
  }
}

function writeTeamLibraryToDisk(teams: SavedTeam[]) {
  try {
    writeFileSync(TEAM_LIBRARY_FILE, JSON.stringify(teams, null, 2));
  } catch (error) {
    console.error("Error saving team library:", error);
  }
}

const persistedDefaults = readTeamDefaultsFromDisk();

let gameState: GameState = {
  homeTeam: persistedDefaults ? { ...baseHomeTeam, ...persistedDefaults.homeTeam, players: persistedDefaults.homeTeam.players } : baseHomeTeam,
  awayTeam: persistedDefaults ? { ...baseAwayTeam, ...persistedDefaults.awayTeam, players: persistedDefaults.awayTeam.players } : baseAwayTeam,
  clock: {
    timeRemaining: 20 * 60 * 1000,
    isRunning: false,
    lastUpdate: Date.now(),
  },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  overlayCorner: "top-left",
  overlayTheme: "light",
};

let clockInterval: NodeJS.Timeout | null = null;

function formatClockTime(timeRemainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, timeRemainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createBaseEvent(type: EventType, team: "home" | "away"): Omit<GameEvent, "id" | "createdAt"> {
  return {
    type,
    team,
    period: gameState.period,
    clockTime: formatClockTime(gameState.clock.timeRemaining),
  };
}

function appendEvent(event: Omit<GameEvent, "id" | "createdAt">) {
  gameState.eventLog = [
    ...gameState.eventLog,
    {
      id: Math.random().toString(36).slice(2, 11),
      createdAt: Date.now(),
      ...event,
    },
  ];
}

function getMostRecentGoalDetails(team: "home" | "away"): Pick<GameEvent, "scorer" | "assist1" | "assist2"> {
  const latestGoal = [...gameState.eventLog]
    .reverse()
    .find((event) => event.type === "goal" && event.team === team);
  return {
    scorer: latestGoal?.scorer ?? "",
    assist1: latestGoal?.assist1 ?? "",
    assist2: latestGoal?.assist2 ?? "",
  };
}

function getPenaltyDiff(previous: Penalty[], next: Penalty[]) {
  const prevById = new Map(previous.map((penalty) => [penalty.id, penalty]));
  const nextById = new Map(next.map((penalty) => [penalty.id, penalty]));
  const added = next.filter((penalty) => !prevById.has(penalty.id));
  const removed = previous.filter((penalty) => !nextById.has(penalty.id));
  return { added, removed };
}

function logScoreAndPenaltyChanges(previousState: GameState, nextState: GameState) {
  const homeGoalDelta = nextState.homeTeam.score - previousState.homeTeam.score;
  const awayGoalDelta = nextState.awayTeam.score - previousState.awayTeam.score;

  if (homeGoalDelta > 0) {
    for (let i = 0; i < homeGoalDelta; i += 1) {
      appendEvent(createBaseEvent("goal", "home"));
    }
  } else if (homeGoalDelta < 0) {
    for (let i = 0; i < Math.abs(homeGoalDelta); i += 1) {
      appendEvent({
        ...createBaseEvent("goal_revoked", "home"),
        ...getMostRecentGoalDetails("home"),
      });
    }
  }

  if (awayGoalDelta > 0) {
    for (let i = 0; i < awayGoalDelta; i += 1) {
      appendEvent(createBaseEvent("goal", "away"));
    }
  } else if (awayGoalDelta < 0) {
    for (let i = 0; i < Math.abs(awayGoalDelta); i += 1) {
      appendEvent({
        ...createBaseEvent("goal_revoked", "away"),
        ...getMostRecentGoalDetails("away"),
      });
    }
  }

  const homePenaltyDiff = getPenaltyDiff(previousState.homeTeam.penalties, nextState.homeTeam.penalties);
  homePenaltyDiff.added.forEach((penalty) =>
    appendEvent({
      ...createBaseEvent("penalty_added", "home"),
      penaltyId: penalty.id,
      playerNumber: penalty.playerNumber,
      infraction: penalty.infraction,
    }),
  );
  homePenaltyDiff.removed.forEach((penalty) => closePenaltyEvent("home", penalty, "manual"));

  const awayPenaltyDiff = getPenaltyDiff(previousState.awayTeam.penalties, nextState.awayTeam.penalties);
  awayPenaltyDiff.added.forEach((penalty) =>
    appendEvent({
      ...createBaseEvent("penalty_added", "away"),
      penaltyId: penalty.id,
      playerNumber: penalty.playerNumber,
      infraction: penalty.infraction,
    }),
  );
  awayPenaltyDiff.removed.forEach((penalty) => closePenaltyEvent("away", penalty, "manual"));
}

function syncActivePenaltyEventDetails(state: GameState) {
  const activePenalties = new Map<string, Penalty>();
  state.homeTeam.penalties.forEach((penalty) => activePenalties.set(`home:${penalty.id}`, penalty));
  state.awayTeam.penalties.forEach((penalty) => activePenalties.set(`away:${penalty.id}`, penalty));

  state.eventLog = state.eventLog.map((event) => {
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

    const nextPenalties = state[teamKey].penalties.map((penalty) => {
      const sourceEvent = activeEventsByPenaltyId.get(penalty.id);
      if (!sourceEvent) return penalty;

      const nextPlayerNumber = (sourceEvent.playerNumber ?? penalty.playerNumber).replace(/\D/g, "").slice(0, 2);
      const nextInfraction = sourceEvent.infraction ?? penalty.infraction;

      if (nextPlayerNumber === penalty.playerNumber && nextInfraction === penalty.infraction) {
        return penalty;
      }

      return {
        ...penalty,
        playerNumber: nextPlayerNumber,
        infraction: nextInfraction,
      };
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

function tickTeamPenalties(team: TeamState, side: "home" | "away", elapsedMs: number): Penalty[] {
  const nextPenalties: Penalty[] = [];

  team.penalties.forEach((penalty) => {
    const nextRemaining = Math.max(0, penalty.timeRemaining - elapsedMs);
    if (nextRemaining > 100) {
      nextPenalties.push({ ...penalty, timeRemaining: nextRemaining });
      return;
    }

    closePenaltyEvent(side, penalty, "expired");
  });

  return nextPenalties;
}

function closePenaltyEvent(side: "home" | "away", penalty: Penalty, reason: "manual" | "expired") {
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

  appendEvent({
    ...createBaseEvent("penalty_over_notice", side),
    penaltyId: penalty.id,
    playerNumber: penalty.playerNumber,
    infraction: penalty.infraction,
    removalReason: reason,
    note: "Penalty is over",
    readOnly: true,
  });
}

function buildGameStatePayload() {
  return { ...gameState, serverTime: Date.now() };
}

function emitGameState() {
  io.emit("gameState", buildGameStatePayload());
}

function emitGameStateTo(socket: Socket) {
  socket.emit("gameState", buildGameStatePayload());
}

function persistCurrentTeamDefaults() {
  writeTeamDefaultsToDisk({
    homeTeam: extractPresetTeam(gameState.homeTeam),
    awayTeam: extractPresetTeam(gameState.awayTeam),
  });
}

function startClockInterval() {
  if (clockInterval) {
    clearInterval(clockInterval);
  }

  clockInterval = setInterval(() => {
    if (gameState.clock.isRunning) {
      const now = Date.now();
      const elapsed = now - gameState.clock.lastUpdate;
      gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      gameState.clock.lastUpdate = now;

      gameState.homeTeam.penalties = tickTeamPenalties(gameState.homeTeam, "home", elapsed);
      gameState.awayTeam.penalties = tickTeamPenalties(gameState.awayTeam, "away", elapsed);

      if (gameState.clock.timeRemaining <= 0) {
        gameState.clock.timeRemaining = 0;
        gameState.clock.isRunning = false;
        if (clockInterval) {
          clearInterval(clockInterval);
          clockInterval = null;
        }
      }

      emitGameState();
    }
  }, 100);
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current game state to new client
  emitGameStateTo(socket);

  socket.on("updateGameState", (updates: Partial<GameState>) => {
    const previousState = gameState;
    let nextState: GameState = { ...gameState, ...updates };

    if (updates.eventLog) {
      nextState = syncActivePenaltyStateFromEventLog(nextState);
    }

    gameState = nextState;
    logScoreAndPenaltyChanges(previousState, nextState);
    syncActivePenaltyEventDetails(gameState);
    emitGameState();
  });

  socket.on("startClock", () => {
    if (!gameState.clock.isRunning && gameState.clock.timeRemaining > 0) {
      gameState.clock.isRunning = true;
      gameState.clock.lastUpdate = Date.now();
      emitGameState();
      startClockInterval();
    }
  });

  socket.on("stopClock", () => {
    if (gameState.clock.isRunning) {
      const now = Date.now();
      const elapsed = now - gameState.clock.lastUpdate;
      gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      gameState.homeTeam.penalties = tickTeamPenalties(gameState.homeTeam, "home", elapsed);
      gameState.awayTeam.penalties = tickTeamPenalties(gameState.awayTeam, "away", elapsed);
      gameState.clock.isRunning = false;
      gameState.clock.lastUpdate = now;
      emitGameState();
    }
  });

  socket.on("setClock", (timeMs: number) => {
    gameState.clock.timeRemaining = timeMs;
    gameState.clock.lastUpdate = Date.now();
    emitGameState();
  });

  socket.on("clockIncrease", () => {
    gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining + 1000);
    emitGameState();
  });

  socket.on("clockDecrease", () => {
    gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - 1000);
    emitGameState();
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// API endpoints for keyboard shortcuts
app.get("/api/shortcuts", (req, res) => {
  try {
    if (existsSync(SHORTCUTS_FILE)) {
      const data = readFileSync(SHORTCUTS_FILE, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error("Error reading shortcuts:", error);
    res.json(null);
  }
});

app.post("/api/shortcuts", (req, res) => {
  try {
    writeFileSync(SHORTCUTS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving shortcuts:", error);
    res.status(500).json({ success: false, error: "Failed to save shortcuts" });
  }
});

app.get("/api/team-defaults", (req, res) => {
  res.json({
    homeTeam: extractPresetTeam(gameState.homeTeam),
    awayTeam: extractPresetTeam(gameState.awayTeam),
  });
});

app.post("/api/team-defaults", (req, res) => {
  try {
    const updates = req.body as Partial<TeamDefaults>;
    if (updates.homeTeam) {
      const preset = normalizePresetTeam(updates.homeTeam);
      gameState.homeTeam = {
        ...gameState.homeTeam,
        name: preset.name || gameState.homeTeam.name,
        abbreviation: preset.abbreviation || gameState.homeTeam.abbreviation,
        logo: preset.logo ?? gameState.homeTeam.logo,
        color: preset.color || gameState.homeTeam.color,
        players: preset.players ?? gameState.homeTeam.players,
      };
    }
    if (updates.awayTeam) {
      const preset = normalizePresetTeam(updates.awayTeam);
      gameState.awayTeam = {
        ...gameState.awayTeam,
        name: preset.name || gameState.awayTeam.name,
        abbreviation: preset.abbreviation || gameState.awayTeam.abbreviation,
        logo: preset.logo ?? gameState.awayTeam.logo,
        color: preset.color || gameState.awayTeam.color,
        players: preset.players ?? gameState.awayTeam.players,
      };
    }
    persistCurrentTeamDefaults();
    io.emit("gameState", gameState);
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving team defaults:", error);
    res.status(500).json({ success: false, error: "Failed to save team defaults" });
  }
});

app.get("/api/team-presets", (req, res) => {
  res.json(readTeamPresetsFromDisk());
});

app.post("/api/team-presets", (req, res) => {
  try {
    const payload = req.body as Partial<TeamPreset>;
    const name = String(payload.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Preset name is required" });
    }

    const homeTeam = payload.homeTeam ? normalizePresetTeam(payload.homeTeam) : extractPresetTeam(gameState.homeTeam);
    const awayTeam = payload.awayTeam ? normalizePresetTeam(payload.awayTeam) : extractPresetTeam(gameState.awayTeam);

    const presets = readTeamPresetsFromDisk();
    const existingIndex = presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
    const nextPreset: TeamPreset = {
      name,
      homeTeam,
      awayTeam,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      presets[existingIndex] = nextPreset;
    } else {
      presets.push(nextPreset);
    }

    writeTeamPresetsToDisk(presets);
    res.json({ success: true, presets });
  } catch (error) {
    console.error("Error saving team preset:", error);
    res.status(500).json({ success: false, error: "Failed to save team preset" });
  }
});

app.delete("/api/team-presets/:name", (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const presets = readTeamPresetsFromDisk();
    const filtered = presets.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase());
    writeTeamPresetsToDisk(filtered);
    res.json({ success: true, presets: filtered });
  } catch (error) {
    console.error("Error deleting team preset:", error);
    res.status(500).json({ success: false, error: "Failed to delete team preset" });
  }
});

app.get("/api/teams", (req, res) => {
  res.json(readTeamLibraryFromDisk());
});

app.post("/api/teams", (req, res) => {
  try {
    const payload = req.body as Partial<SavedTeam>;
    const name = String(payload.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Team name is required" });
    }

    const team = payload.team ? normalizePresetTeam(payload.team) : extractPresetTeam(gameState.homeTeam);
    const teams = readTeamLibraryFromDisk();
    const existingIndex = teams.findIndex((entry) => entry.name.toLowerCase() === name.toLowerCase());
    const nextEntry: SavedTeam = {
      name,
      team,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      teams[existingIndex] = nextEntry;
    } else {
      teams.push(nextEntry);
    }

    writeTeamLibraryToDisk(teams);
    res.json({ success: true, teams });
  } catch (error) {
    console.error("Error saving team entry:", error);
    res.status(500).json({ success: false, error: "Failed to save team entry" });
  }
});

app.delete("/api/teams/:name", (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const teams = readTeamLibraryFromDisk();
    const filtered = teams.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase());
    writeTeamLibraryToDisk(filtered);
    res.json({ success: true, teams: filtered });
  } catch (error) {
    console.error("Error deleting team entry:", error);
    res.status(500).json({ success: false, error: "Failed to delete team entry" });
  }
});

app.use(express.static(join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3696;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
