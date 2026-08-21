import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NewGameWizard from "../../components/new-game/NewGameWizard";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

const freshGameState = {
  homeTeam: { name: "Team A", abbreviation: "TMA", score: 0, shots: 0, timeouts: 1, logo: "", color: "#3b82f6", penalties: [], players: [] },
  awayTeam: { name: "Team B", abbreviation: "TMB", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ef4444", penalties: [], players: [] },
  clock: { timeRemaining: 20 * 60 * 1000, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main" as const,
  jumbotronGradientsEnabled: true,
};

const libraryEntry = {
  name: "Boston Bruins",
  team: { name: "Boston Bruins", abbreviation: "BOS", logo: "", color: "#ffb81c", players: [] },
  updatedAt: Date.now(),
};

describe("NewGameWizard", () => {
  const startNewGame = vi.fn();
  const resetGame = vi.fn();
  const saveGame = vi.fn();
  const saveTeamToLibrary = vi.fn().mockResolvedValue(undefined);
  const onStarted = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      gameState: freshGameState,
      resetGame,
      startNewGame,
      saveGame,
      saveTeamToLibrary,
      teamLibrary: [libraryEntry],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      deleteTeamFromLibrary: vi.fn(),
    } as any);
  });

  it("skips the safety gate for a fresh game and goes straight to Home team selection", () => {
    render(<NewGameWizard isOpen onClose={onClose} onStarted={onStarted} />);
    expect(screen.getByText("Home Team")).toBeInTheDocument();
    expect(screen.queryByText(/already in progress/i)).not.toBeInTheDocument();
  });

  it("walks through create-new home, library-pick away, review, and starts the game", async () => {
    render(<NewGameWizard isOpen onClose={onClose} onStarted={onStarted} />);

    // Home: create new
    fireEvent.click(screen.getByText("Create new"));
    const nameInput = screen.getAllByDisplayValue("")[0];
    fireEvent.change(nameInput, { target: { value: "Ice Wolves" } });
    fireEvent.blur(nameInput);
    fireEvent.click(screen.getByText("Continue"));

    // Away: pick from library
    expect(await screen.findByText("Away Team")).toBeInTheDocument();
    expect(screen.getByText("Boston Bruins")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Select"));

    // Review
    expect(await screen.findByText("Review & Start")).toBeInTheDocument();
    expect(screen.getByText("Ice Wolves")).toBeInTheDocument();
    expect(screen.getByText("Boston Bruins")).toBeInTheDocument();
    // Only the newly-created home team offers a "save to library" checkbox.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);

    fireEvent.click(screen.getByText("Start Game"));

    await waitFor(() => {
      expect(saveTeamToLibrary).toHaveBeenCalledWith("Ice Wolves", expect.objectContaining({ name: "Ice Wolves" }));
    });
    expect(startNewGame).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Ice Wolves", score: 0, shots: 0, timeouts: 1, penalties: [] }),
      expect.objectContaining({ name: "Boston Bruins" }),
    );
    expect(onStarted).toHaveBeenCalled();
  });

  it("shows the in-progress safety gate when the game has already started", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: { ...freshGameState, homeTeam: { ...freshGameState.homeTeam, score: 1 } },
      resetGame,
      startNewGame,
      saveGame,
      saveTeamToLibrary,
      teamLibrary: [],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      deleteTeamFromLibrary: vi.fn(),
    } as any);

    render(<NewGameWizard isOpen onClose={onClose} onStarted={onStarted} />);
    expect(screen.getByText(/already in progress/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Quick Start/i));
    expect(resetGame).toHaveBeenCalled();
    expect(onStarted).toHaveBeenCalled();
  });
});
