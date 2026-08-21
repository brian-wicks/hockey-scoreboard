import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PresetsPanel from "../../components/control-panel/PresetsPanel";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

const baseGameState = {
  homeTeam: { name: "Current Home", abbreviation: "HOM", score: 0, shots: 0, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [] },
  awayTeam: { name: "Current Away", abbreviation: "AWY", score: 0, shots: 0, timeouts: 1, logo: "", color: "#ffffff", penalties: [], players: [] },
};

describe("PresetsPanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const flushMicrotasks = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const mockPresets = [
    { name: "Game 1", team: { name: "Home Team", abbreviation: "HOM", logo: "", color: "#000", players: [] }, updatedAt: 1 },
    { name: "Game 2", team: { name: "Away Team", abbreviation: "AWY", logo: "", color: "#fff", players: [] }, updatedAt: 2 },
  ];

  it("renders the presets and handles deletion", async () => {
    const deleteTeamFromLibrary = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStore).mockReturnValue({
      user: { getIdToken: vi.fn().mockResolvedValue("test-token") },
      teamLibrary: mockPresets,
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      saveTeamToLibrary: vi.fn().mockResolvedValue(undefined),
      deleteTeamFromLibrary,
    } as any);

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);

    // Cards show the team's display name, not the preset name.
    expect(await screen.findByText("Home Team")).toBeInTheDocument();
    expect(screen.getByText("Away Team")).toBeInTheDocument();

    const deleteButton = screen.getByLabelText(/Delete preset Game 1/i);
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    const confirmDelete = screen.getByRole("button", { name: /^Delete$/ });
    await act(async () => {
      fireEvent.click(confirmDelete);
    });

    await waitFor(() => {
      expect(deleteTeamFromLibrary).toHaveBeenCalledWith("Game 1");
    });
  });

  it("saves the current home team to the library (moved from Settings)", async () => {
    const saveTeamToLibrary = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStore).mockReturnValue({
      user: { getIdToken: vi.fn().mockResolvedValue("test-token") },
      teamLibrary: [],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      saveTeamToLibrary,
      deleteTeamFromLibrary: vi.fn().mockResolvedValue(undefined),
    } as any);

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);

    fireEvent.click(screen.getByText("Save Home"));

    await waitFor(() => {
      expect(saveTeamToLibrary).toHaveBeenCalledWith(
        "Current Home",
        expect.objectContaining({ name: "Current Home" }),
      );
    });
  });

  it("asks to confirm before overwriting an existing preset name", async () => {
    const existingPreset = { name: "Current Home", team: { name: "Current Home", abbreviation: "HOM", logo: "", color: "#000", players: [] }, updatedAt: 1 };
    const saveTeamToLibrary = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useStore).mockReturnValue({
      user: { getIdToken: vi.fn().mockResolvedValue("test-token") },
      teamLibrary: [existingPreset],
      loadTeamLibrary: vi.fn().mockResolvedValue(undefined),
      saveTeamToLibrary,
      deleteTeamFromLibrary: vi.fn().mockResolvedValue(undefined),
    } as any);

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);
    await screen.findAllByText("Current Home");

    fireEvent.click(screen.getByText("Save Home"));

    expect(await screen.findByText("Team Name Already Exists")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overwrite"));
    await waitFor(() => {
      expect(saveTeamToLibrary).toHaveBeenCalledWith(
        "Current Home",
        expect.objectContaining({ name: "Current Home" }),
      );
    });
  });
});
