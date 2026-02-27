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

let gameState: GameState = {
  homeTeam: {
    name: "Home Team",
    abbreviation: "HOM",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#3b82f6",
    penalties: [],
  },
  awayTeam: {
    name: "Away Team",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#ef4444",
    penalties: [],
  },
  clock: {
    timeRemaining: 20 * 60 * 1000,
    isRunning: false,
    lastUpdate: Date.now(),
  },
  period: "1st",
};

let clockInterval: NodeJS.Timeout | null = null;

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

app.use(express.static(join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
