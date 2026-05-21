import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPanel from "../../components/control-panel/SettingsPanel";
import { useStore } from "../../store";

const mockUpdateState = vi.fn();

const flushMicrotasks = async () => {
  // SettingsPanel does async work on mount; flush microtasks so React state settles.
  await Promise.resolve();
  await Promise.resolve();
};

const baseGameState = {
  homeTeam: {
    name: "Home Team",
    abbreviation: "HOM",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [],
  },
  awayTeam: {
    name: "Away Team",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  },
  clock: { timeRemaining: 0, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main" as const,
  jumbotronGradientsEnabled: true,
};

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStore).mockReturnValue({
      user: { uid: "test-user", getIdToken: vi.fn().mockResolvedValue("token") },
      keyboardShortcuts: [],
      updateShortcut: vi.fn(),
      resetShortcuts: vi.fn(),
    } as any);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    }));
  });

  it("renders team names and allows editing", async () => {
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    const homeNameInput = screen.getByDisplayValue("Home Team");
    await act(async () => {
      fireEvent.change(homeNameInput, { target: { value: "New Home" } });
      fireEvent.blur(homeNameInput);
    });
    
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ name: "New Home" })
    }));
  });

  it("handles team color changes", async () => {
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    const colorInputs = document.querySelectorAll('input[type="color"]');
    await act(async () => {
      fireEvent.change(colorInputs[0], { target: { value: "#ff0000" } });
    });
    
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ color: "#ff0000" })
    }));
  });

  it("handles saving a team to the library", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);
    
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    
    const saveButtons = screen.getAllByLabelText(/Save.*preset/i);
    fireEvent.click(saveButtons[0]);
    
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/teams"), expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"name":"Home Team"')
      }));
    });
  });

  it("allows adding players and updating details", async () => {
    const { unmount } = render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    
    // Expand roster
    await act(async () => {
      const expandButtons = screen.getAllByLabelText(/Expand.*roster/i);
      fireEvent.click(expandButtons[0]);
    });
    
    await act(async () => {
      const addButton = screen.getAllByText(/Add Player/i)[0];
      fireEvent.click(addButton);
    });
    
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({
        players: expect.arrayContaining([expect.objectContaining({ jerseyNumber: "" })])
      })
    }));

    unmount();

    // Test editing and removal with pre-existing player
    const stateWithPlayer = {
      ...baseGameState,
      homeTeam: {
        ...baseGameState.homeTeam,
        players: [{ id: "p1", jerseyNumber: "10", name: "Player 1", position: "F" }]
      }
    };

    render(<SettingsPanel gameState={stateWithPlayer as any} updateState={mockUpdateState} />);
    
    await act(async () => {
      const expandButtons = screen.getAllByLabelText(/Expand.*roster/i);
      fireEvent.click(expandButtons[0]);
    });

    const jerseyInputs = screen.getAllByDisplayValue("10");
    await act(async () => {
      fireEvent.change(jerseyInputs[0], { target: { value: "11" } });
      fireEvent.blur(jerseyInputs[0]);
    });

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({
        players: expect.arrayContaining([expect.objectContaining({ jerseyNumber: "11" })])
      })
    }));

    const removeButton = screen.getByTitle(/Remove player/i);
    await act(async () => {
      fireEvent.click(removeButton);
    });

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({
        players: []
      })
    }));
  });

  it("handles resetting shortcuts", async () => {
    const mockResetShortcuts = vi.fn();
    vi.mocked(useStore).mockReturnValue({
      user: { uid: "test-user", getIdToken: vi.fn().mockResolvedValue("token") },
      keyboardShortcuts: [{ key: "g", action: "homeScoreIncrease", description: "Goal Home" }],
      updateShortcut: vi.fn(),
      resetShortcuts: mockResetShortcuts,
    } as any);

    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    const resetButton = screen.getByText(/Reset to Defaults/i);
    await act(async () => {
      fireEvent.click(resetButton);
    });
    
    expect(mockResetShortcuts).toHaveBeenCalled();
  });

  it("handles logo URL change", async () => {
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    const logoInputs = screen.getAllByPlaceholderText(/example.com\/logo.png/i);
    await act(async () => {
      fireEvent.change(logoInputs[0], { target: { value: "https://newlogo.png" } });
      fireEvent.blur(logoInputs[0]);
    });
    
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ logo: "https://newlogo.png" })
    }));
  });

  it("handles team abbreviation changes", async () => {
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    const abbrInput = screen.getByDisplayValue("HOM");
    fireEvent.change(abbrInput, { target: { value: "NEW" } });
    fireEvent.blur(abbrInput);
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ abbreviation: "NEW" })
    }));
  });

  it("handles overlay settings", async () => {
    render(<SettingsPanel gameState={baseGameState as any} updateState={mockUpdateState} />);
    await act(flushMicrotasks);
    
    // Test Corner change
    const buttons = screen.getAllByRole("button");
    const trButton = buttons.find(b => b.textContent?.trim() === "TR");
    if (trButton) {
      fireEvent.click(trButton);
      expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ overlayCorner: "top-right" }));
    }
  });
});
