import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Dashboard from "../../components/Dashboard";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

const gameState = {
  homeTeam: { name: "Home", abbreviation: "HOM", score: 0, shots: 0, timeouts: 1, logo: "", color: "#3b82f6", penalties: [], players: [] },
  awayTeam: { name: "Away", abbreviation: "AWY", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ef4444", penalties: [], players: [] },
  clock: { timeRemaining: 20 * 60 * 1000, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main" as const,
  jumbotronGradientsEnabled: true,
};

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      gameState,
      isViewer: false,
      user: { uid: "123", getIdToken: vi.fn().mockResolvedValue("token") },
      ensureInitialized: vi.fn(),
      activeGameId: "g1",
      savedGames: [{ id: "g1", name: "Saved Game 1", createdAt: Date.now(), updatedAt: Date.now() }],
      teamLibrary: [],
      loadSavedGames: vi.fn().mockResolvedValue(undefined),
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      openGame: vi.fn(),
      deleteGame: vi.fn(),
      startNewGame: vi.fn(),
      saveTeamToLibrary: vi.fn(),
      socket: null,
      isConnected: true,
    } as any);
  });

  it("renders the primary actions and saved games list", async () => {
    render(<Dashboard />, { wrapper: MemoryRouter });

    expect(screen.getByText("New Game")).toBeInTheDocument();
    expect(screen.getByText("Manage Teams")).toBeInTheDocument();
    expect(await screen.findByText("Saved Game 1")).toBeInTheDocument();
  });

  it("returns nothing for a viewer session", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState,
      isViewer: true,
      user: null,
      ensureInitialized: vi.fn(),
      activeGameId: null,
      savedGames: [],
      teamLibrary: [],
    } as any);

    const { container } = render(<Dashboard />, { wrapper: MemoryRouter });
    expect(container).toBeEmptyDOMElement();
  });
});
