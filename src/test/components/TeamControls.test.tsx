import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeamControls from "../../components/control-panel/TeamControls";

const mockUpdateState = vi.fn();

const baseState = {
  homeTeam: {
    name: "Home",
    abbreviation: "HOM",
    score: 2,
    shots: 5,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [{ id: "1", jerseyNumber: "10", name: "Player 1", position: "" }],
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
    players: [],
  },
  clock: { timeRemaining: 0, isRunning: false, lastUpdate: 0 },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main" as const,
  jumbotronGradientsEnabled: true,
};

describe("TeamControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments and decrements score", () => {
    render(
      <TeamControls
        team="home"
        state={baseState.homeTeam as any}
        gameState={baseState as any}
        eventLog={[]}
        updateState={mockUpdateState}
      />
    );

    const plusButton = screen.getAllByRole("button").find(b => b.querySelector("svg.lucide-plus"));
    const minusButton = screen.getAllByRole("button").find(b => b.querySelector("svg.lucide-minus"));

    fireEvent.click(plusButton!);
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ score: 3 })
    }));

    fireEvent.click(minusButton!);
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ score: 1 })
    }));
  });

  it("adds a penalty and handles automatic focus", () => {
    render(
      <TeamControls
        team="home"
        state={baseState.homeTeam as any}
        gameState={baseState as any}
        eventLog={[]}
        updateState={mockUpdateState}
      />
    );

    const addButton = screen.getByText(/Add/i);
    fireEvent.click(addButton);

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({
        penalties: expect.arrayContaining([expect.objectContaining({ duration: 120000 })])
      })
    }));
  });

  it("logs a goalie change", () => {
    render(
      <TeamControls
        team="home"
        state={baseState.homeTeam as any}
        gameState={baseState as any}
        eventLog={[]}
        updateState={mockUpdateState}
      />
    );

    const input = screen.getByPlaceholderText(/Goalie #/i);
    fireEvent.change(input, { target: { value: "31" } });
    fireEvent.blur(input);
    
    const setButton = screen.getByText(/Set/i);
    fireEvent.click(setButton);

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      eventLog: expect.arrayContaining([expect.objectContaining({ type: "goalie_change", goalie: "31" })])
    }));
  });

  it("increments and decrements shots", () => {
    render(
      <TeamControls
        team="home"
        state={baseState.homeTeam as any}
        gameState={baseState as any}
        eventLog={[]}
        updateState={mockUpdateState}
      />
    );

    // Find shot controls by finding the "Shots" label and then the buttons in its container
    const shotsLabel = screen.getByText("Shots");
    const container = shotsLabel.parentElement;
    const plusButton = container?.querySelector("svg.lucide-plus")?.parentElement;
    const minusButton = container?.querySelector("svg.lucide-minus")?.parentElement;

    fireEvent.click(plusButton!);
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ shots: 6 })
    }));

    fireEvent.click(minusButton!);
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ shots: 4 })
    }));
  });

  it("handles penalty item changes and removal", () => {
    const stateWithPenalty = {
      ...baseState.homeTeam,
      penalties: [{ id: "p1", playerNumber: "10", timeRemaining: 120000, duration: 120000, infraction: "" }],
    };

    render(
      <TeamControls
        team="home"
        state={stateWithPenalty as any}
        gameState={baseState as any}
        eventLog={[]}
        updateState={mockUpdateState}
      />
    );

    // Test removal
    // The minus button in PenaltyItem
    const penaltyItem = screen.getByDisplayValue("10").closest("div.flex");
    const removeButton = penaltyItem?.querySelector("svg.lucide-minus")?.parentElement;
    fireEvent.click(removeButton!);

    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({
      homeTeam: expect.objectContaining({ penalties: [] })
    }));
  });
});
