import { describe, expect, it } from "vitest";
import { isGameInProgress } from "../../utils/gameProgress";
import { GameState } from "../../store";

const freshGameState = (): GameState => ({
  homeTeam: { name: "Team A", abbreviation: "TMA", score: 0, shots: 0, timeouts: 1, logo: "", color: "#3b82f6", penalties: [], players: [] },
  awayTeam: { name: "Team B", abbreviation: "TMB", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ef4444", penalties: [], players: [] },
  clock: { timeRemaining: 20 * 60 * 1000, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  jumbotronGradientsEnabled: true,
});

describe("isGameInProgress", () => {
  it("is false for a fresh, untouched game", () => {
    expect(isGameInProgress(freshGameState())).toBe(false);
  });

  it("is true once a goal has been scored", () => {
    const state = freshGameState();
    state.homeTeam.score = 1;
    expect(isGameInProgress(state)).toBe(true);
  });

  it("is true once the clock is running", () => {
    const state = freshGameState();
    state.clock.isRunning = true;
    expect(isGameInProgress(state)).toBe(true);
  });

  it("is true once the clock has ticked down from a full period", () => {
    const state = freshGameState();
    state.clock.timeRemaining = 19 * 60 * 1000;
    expect(isGameInProgress(state)).toBe(true);
  });

  it("is true once anything has been logged to the event log", () => {
    const state = freshGameState();
    state.eventLog = [
      { id: "1", type: "goalie_change", team: "home", period: "1st", clockTime: "20:00", createdAt: 0 },
    ];
    expect(isGameInProgress(state)).toBe(true);
  });
});
