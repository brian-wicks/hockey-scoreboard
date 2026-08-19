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
    { id: "1", name: "Game 1", team: { name: "Home Team", abbreviation: "HOM", logo: "" } },
    { id: "2", name: "Game 2", team: { name: "Away Team", abbreviation: "AWY", logo: "" } },
  ];

  it("renders the presets and handles deletion", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    };

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
    } as any);

    // Mock fetch
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/teams") && init?.method === "DELETE") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ teams: [mockPresets[1]] }),
        });
      }
      if (url.includes("/api/teams")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPresets),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);

    // Wait for presets to render (cards show the team's display name, not the preset name).
    expect(await screen.findByText("Home Team")).toBeInTheDocument();
    expect(screen.getByText("Away Team")).toBeInTheDocument();

    const deleteButton = screen.getByLabelText(/Delete preset Game 1/i);
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    // Confirm deletion in modal
    const confirmDelete = screen.getByRole("button", { name: /^Delete$/ });
    await act(async () => {
      fireEvent.click(confirmDelete);
    });

    // Should call fetch with DELETE
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/teams/Game%201"),
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("saves the current home team to the library (moved from Settings)", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    };

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
    } as any);

    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/teams") && init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ teams: mockPresets }),
        });
      }
      if (url.includes("/api/teams")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);

    fireEvent.click(screen.getByText("Save Home"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/teams"), expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"name":"Current Home"'),
      }));
    });
  });

  it("asks to confirm before overwriting an existing preset name", async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue("test-token"),
    };

    vi.mocked(useStore).mockReturnValue({
      user: mockUser,
    } as any);

    const existingPreset = { name: "Current Home", team: { name: "Current Home", abbreviation: "HOM", logo: "" } };
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/teams") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ teams: [existingPreset] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([existingPreset]) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PresetsPanel gameState={baseGameState as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);
    // Wait for the existing "Current Home" preset to load so the name-conflict check has data.
    await screen.findAllByText("Current Home");

    fireEvent.click(screen.getByText("Save Home"));

    expect(await screen.findByText("Team Name Already Exists")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overwrite"));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/teams"), expect.objectContaining({
        method: "POST",
      }));
    });
  });
});
