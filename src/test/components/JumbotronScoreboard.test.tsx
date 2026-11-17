import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const connect = vi.fn();
const ensureInitialized = vi.fn();
const updateState = vi.fn();

const baseState = {
  homeTeam: {
    name: "Ice Bears",
    abbreviation: "",
    score: 2,
    shots: 5,
    timeouts: 1,
    logo: "",
    color: "#123456",
    penalties: [
      { id: "p1", playerNumber: "12", timeRemaining: 60000, duration: 120000, infraction: "Hooking" },
      { id: "p2", playerNumber: "7", timeRemaining: 30000, duration: 120000, infraction: "Tripping" },
    ],
    players: [],
  },
  awayTeam: {
    name: "Storm",
    abbreviation: "STM",
    score: 3,
    shots: 7,
    timeouts: 1,
    logo: "",
    color: "#654321",
    penalties: [{ id: "p3", playerNumber: "9", timeRemaining: 45000, duration: 120000, infraction: "Slashing" }],
    players: [],
  },
  clock: { timeRemaining: 60000, isRunning: false, lastUpdate: 0 },
  period: "2nd",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main" as const,
  overlayCorner: "top-left" as const,
  jumbotronGradientsEnabled: true,
  lowerThird: { active: false, title: "", subtitle: "" },
  jumbotronGoalHighlight: null,
};

let currentState = baseState;

vi.mock("../../store", () => ({
  useStore: () => ({
    gameState: currentState,
    connect,
    ensureInitialized,
    serverTimeOffsetMs: 0,
    updateState,
  }),
}));

import JumbotronScoreboard from "../../components/JumbotronScoreboard";

describe("JumbotronScoreboard", () => {
  afterEach(() => {
    currentState = baseState;
    vi.restoreAllMocks();
  });

  it("renders period label and team labels", () => {
    render(<JumbotronScoreboard />);
    expect(screen.getByText("2ND PERIOD")).toBeInTheDocument();
    expect(screen.getByText("ICE")).toBeInTheDocument();
    expect(screen.getByText("STM")).toBeInTheDocument();
  });

  it("sorts penalties by remaining time", () => {
    render(<JumbotronScoreboard />);
    const rows = screen.getAllByText(/Hooking|Tripping/);
    expect(rows[0]).toHaveTextContent("Tripping");
    expect(rows[1]).toHaveTextContent("Hooking");
  });

  it("counts penalties down with a running clock between updates", () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    currentState = { ...baseState, clock: { timeRemaining: 60000, isRunning: true, lastUpdate: 0 } } as typeof baseState;

    render(<JumbotronScoreboard />);

    expect(screen.getByText("0:55")).toBeInTheDocument();
    expect(screen.getByText("0:25")).toBeInTheDocument();
    expect(screen.getByText("0:40")).toBeInTheDocument();
  });
});
