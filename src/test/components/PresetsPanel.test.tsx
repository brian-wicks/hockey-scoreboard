import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import PresetsPanel from "../../components/control-panel/PresetsPanel";
import { useStore } from "../../store";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

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
    const mockDelete = vi.fn();
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

    render(<PresetsPanel gameState={{} as any} updateState={vi.fn()} />);
    await act(flushMicrotasks);

    // Wait for presets to render
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
});
