import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Overlay from "../../components/Overlay";
import { useStore } from "../../store";

const baseGameState = {
  homeTeam: {
    name: "Home",
    abbreviation: "HOM",
    score: 2,
    shots: 5,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
  },
  awayTeam: {
    name: "Away",
    abbreviation: "AWY",
    score: 3,
    shots: 7,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
  },
  clock: { timeRemaining: 120000, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  jumbotronGradientsEnabled: true,
};

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("Overlay Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("counts penalties down with a running clock between updates", () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    vi.mocked(useStore).mockReturnValue({
      gameState: {
        ...baseGameState,
        clock: { timeRemaining: 120000, isRunning: true, lastUpdate: 0 },
        homeTeam: {
          ...baseGameState.homeTeam,
          penalties: [{ id: "p1", playerNumber: "12", timeRemaining: 60000, duration: 120000, infraction: "Hooking" }],
        },
      },
      ensureInitialized: vi.fn(),
      updateState: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    render(<Overlay />);

    // Five seconds since the last update, so the penalty shows 0:55 rather than 1:00.
    expect(screen.getByText("12 - 0:55")).toBeInTheDocument();
  });

  it("renders the scoreboard with team abbreviations and scores", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: baseGameState,
      ensureInitialized: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    render(<Overlay />);

    expect(screen.getByText("HOM")).toBeInTheDocument();
    expect(screen.getByText("AWY")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("shows penalties when they exist", () => {
    const stateWithPenalties = {
      ...baseGameState,
      homeTeam: {
        ...baseGameState.homeTeam,
        penalties: [{ id: "1", number: "10", duration: 120000, startTime: Date.now() }],
      },
    };

    vi.mocked(useStore).mockReturnValue({
      gameState: stateWithPenalties,
      ensureInitialized: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    render(<Overlay />);

    expect(screen.getByText("2:00")).toBeInTheDocument();
  });

  it("renders nothing when overlayVisible is false", () => {
    const hiddenState = { ...baseGameState, overlayVisible: false };
    vi.mocked(useStore).mockReturnValue({
      gameState: hiddenState,
      ensureInitialized: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    render(<Overlay />);
    expect(screen.queryByText("HOM")).not.toBeInTheDocument();
  });

  it("triggers goal sting when score increases", async () => {
    const { rerender } = render(<Overlay />);

    const goalState = {
      ...baseGameState,
      homeTeam: { ...baseGameState.homeTeam, score: baseGameState.homeTeam.score + 1 },
    };

    vi.mocked(useStore).mockReturnValue({
      gameState: goalState,
      ensureInitialized: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    rerender(<Overlay />);

    // Should show GOAL! text
    expect(await screen.findByText("GOAL!")).toBeInTheDocument();
  });

  it("renders penalties when present", () => {
    const penaltyState = {
      ...baseGameState,
      homeTeam: {
        ...baseGameState.homeTeam,
        penalties: [{ id: "p1", playerNumber: "10", timeRemaining: 120000, duration: 120000 }],
      },
    };

    vi.mocked(useStore).mockReturnValue({
      gameState: penaltyState,
      ensureInitialized: vi.fn(),
      serverTimeOffsetMs: 0,
    } as any);

    render(<Overlay />);

    expect(screen.getByText("10 - 2:00")).toBeInTheDocument();
  });
  });
