import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
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

interface Penalty {
  id: string;
  playerNumber: string;
  timeRemaining: number;
  duration: number;
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
}

interface TeamIdentity {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

interface TeamDefaults {
  homeTeam: TeamIdentity;
  awayTeam: TeamIdentity;
}

interface TeamPreset extends TeamDefaults {
  name: string;
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
};

function extractTeamIdentity(team: TeamState): TeamIdentity {
  return {
    name: team.name,
    abbreviation: team.abbreviation,
    logo: team.logo,
    color: team.color,
  };
}

function applyTeamIdentity(team: TeamState, updates?: Partial<TeamIdentity>): TeamState {
  if (!updates) return team;
  return {
    ...team,
    name: updates.name ?? team.name,
    abbreviation: updates.abbreviation ?? team.abbreviation,
    logo: updates.logo ?? team.logo,
    color: updates.color ?? team.color,
  };
}

function readTeamDefaultsFromDisk(): TeamDefaults | null {
  try {
    if (!existsSync(TEAM_DEFAULTS_FILE)) return null;
    const data = JSON.parse(readFileSync(TEAM_DEFAULTS_FILE, "utf-8"));
    if (!data?.homeTeam || !data?.awayTeam) return null;
    return data as TeamDefaults;
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
    return Array.isArray(data) ? data : [];
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

const persistedDefaults = readTeamDefaultsFromDisk();

let gameState: GameState = {
  homeTeam: applyTeamIdentity(baseHomeTeam, persistedDefaults?.homeTeam),
  awayTeam: applyTeamIdentity(baseAwayTeam, persistedDefaults?.awayTeam),
  clock: {
    timeRemaining: 20 * 60 * 1000,
    isRunning: false,
    lastUpdate: Date.now(),
  },
  period: "1st",
};

let clockInterval: NodeJS.Timeout | null = null;

function persistCurrentTeamDefaults() {
  writeTeamDefaultsToDisk({
    homeTeam: extractTeamIdentity(gameState.homeTeam),
    awayTeam: extractTeamIdentity(gameState.awayTeam),
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

      // Update penalties (timeRemaining is in milliseconds)
      [gameState.homeTeam, gameState.awayTeam].forEach((team) => {
        team.penalties = team.penalties
          .map((p) => ({
            ...p,
            timeRemaining: Math.max(0, p.timeRemaining - elapsed),
          }))
          .filter((p) => p.timeRemaining > 100); // Keep penalties with more than 0.1s remaining
      });

      io.emit("gameState", gameState);

      if (gameState.clock.timeRemaining <= 0) {
        gameState.clock.isRunning = false;
        if (clockInterval) {
          clearInterval(clockInterval);
          clockInterval = null;
        }
      }
    }
  }, 100);
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send current game state to new client
  socket.emit("gameState", gameState);

  socket.on("updateGameState", (updates: Partial<GameState>) => {
    gameState = { ...gameState, ...updates };
    if (updates.homeTeam || updates.awayTeam) {
      persistCurrentTeamDefaults();
    }
    io.emit("gameState", gameState);
  });

  socket.on("startClock", () => {
    if (!gameState.clock.isRunning) {
      gameState.clock.isRunning = true;
      gameState.clock.lastUpdate = Date.now();
      io.emit("gameState", gameState);
      startClockInterval();
    }
  });

  socket.on("stopClock", () => {
    if (gameState.clock.isRunning) {
      const now = Date.now();
      const elapsed = now - gameState.clock.lastUpdate;
      gameState.clock.timeRemaining = Math.max(0, gameState.clock.timeRemaining - elapsed);
      [gameState.homeTeam, gameState.awayTeam].forEach((team) => {
        team.penalties = team.penalties
          .map((p) => ({
            ...p,
            timeRemaining: Math.max(0, p.timeRemaining - elapsed),
          }))
          .filter((p) => p.timeRemaining > 100);
      });
      gameState.clock.isRunning = false;
      gameState.clock.lastUpdate = now;
      io.emit("gameState", gameState);
    }
  });

  socket.on("setClock", (timeMs: number) => {
    gameState.clock.timeRemaining = timeMs;
    gameState.clock.lastUpdate = Date.now();
    io.emit("gameState", gameState);
  });

  socket.on("clockIncrease", () => {
    gameState.clock.timeRemaining += 1000;
    io.emit("gameState", gameState);
  });

  socket.on("clockDecrease", () => {
    gameState.clock.timeRemaining -= 1000;
    io.emit("gameState", gameState);
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
    homeTeam: extractTeamIdentity(gameState.homeTeam),
    awayTeam: extractTeamIdentity(gameState.awayTeam),
  });
});

app.post("/api/team-defaults", (req, res) => {
  try {
    const updates = req.body as Partial<TeamDefaults>;
    gameState.homeTeam = applyTeamIdentity(gameState.homeTeam, updates.homeTeam);
    gameState.awayTeam = applyTeamIdentity(gameState.awayTeam, updates.awayTeam);
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

    const homeTeam = payload.homeTeam ?? extractTeamIdentity(gameState.homeTeam);
    const awayTeam = payload.awayTeam ?? extractTeamIdentity(gameState.awayTeam);

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

app.use(express.static(join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3696;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
