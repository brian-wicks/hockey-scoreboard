import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import NewGameWizard from "../../components/new-game/NewGameWizard";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

const libraryEntry = {
  name: "Boston Bruins",
  team: { name: "Boston Bruins", abbreviation: "BOS", logo: "", color: "#ffb81c", players: [] },
  updatedAt: Date.now(),
};

describe("NewGameWizard", () => {
  const startNewGame = vi.fn().mockResolvedValue(undefined);
  const saveTeamToLibrary = vi.fn().mockResolvedValue(undefined);
  const onStarted = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    startNewGame.mockResolvedValue(undefined);
    vi.mocked(useStore).mockReturnValue({
      startNewGame,
      saveTeamToLibrary,
      teamLibrary: [libraryEntry],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      deleteTeamFromLibrary: vi.fn(),
    } as any);
  });

  it("always goes straight to Home team selection — nothing is ever unsaved", () => {
    render(<NewGameWizard isOpen onClose={onClose} onStarted={onStarted} />);
    expect(screen.getByText("Home Team")).toBeInTheDocument();
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
    expect(startNewGame).toHaveBeenCalledWith({
      homeTeam: expect.objectContaining({ name: "Ice Wolves", score: 0, shots: 0, timeouts: 1, penalties: [] }),
      awayTeam: expect.objectContaining({ name: "Boston Bruins" }),
    });
    await waitFor(() => {
      expect(onStarted).toHaveBeenCalled();
    });
  });
});
