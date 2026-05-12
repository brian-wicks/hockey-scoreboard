import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ResultsPage from "../../components/ResultsPage";
import { useStore } from "../../store";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../store", () => ({
  useStore: vi.fn(),
}));

describe("ResultsPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGameState = {
    homeTeam: { name: "Ice Bears", abbreviation: "IB", score: 5, logo: "home-logo" },
    awayTeam: { name: "Wolves", abbreviation: "WOL", score: 2, logo: "away-logo" },
    eventLog: [
      { id: "1", type: "goal", team: "home", time: "10:00", period: "1st", scorer: "10", assists: [] },
    ],
  };

  it("renders the final score and team names", () => {
    vi.mocked(useStore).mockReturnValue({
      gameState: mockGameState,
      ensureInitialized: vi.fn(),
      connect: vi.fn(),
    } as any);

    render(
      <MemoryRouter>
        <ResultsPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Ice Bears")).toBeInTheDocument();
    expect(screen.getByText("Wolves")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(1);
    expect(screen.getAllByText("2")).toHaveLength(1);
  });
});
