import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import GameActionsPanel from "../../components/control-panel/GameActionsPanel";
import { useStore } from "../../store";

describe("GameActionsPanel Component", () => {
  const mockUpdateState = vi.fn();
  const mockSetClock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseGameState = {
    clock: { timeRemaining: 1200000 },
    eventLog: [],
  };

  it("renders all period buttons", () => {
    render(
      <GameActionsPanel
        period="1st"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    expect(screen.getByText("1st Period")).toBeInTheDocument();
    expect(screen.getByText("2nd Period")).toBeInTheDocument();
    expect(screen.getByText("3rd Period")).toBeInTheDocument();
    expect(screen.getByText("Overtime")).toBeInTheDocument();
  });

  it("updates period and sets clock when a button is clicked", () => {
    // GameActionsPanel reads gameState from the store directly (not as a prop) —
    // see the comment in GameActionsPanel.tsx for why.
    useStore.setState({ gameState: baseGameState as any });
    render(
      <GameActionsPanel
        period="1st"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    fireEvent.click(screen.getByText("2nd Period"));

    // Should call updateState with next period and period end event
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "2nd",
        eventLog: expect.arrayContaining([
          expect.objectContaining({ type: "period_end", period: "1st" }),
          expect.objectContaining({ type: "period_start", period: "2nd" }),
        ]),
      })
    );

    // Should call setClock with 20 minutes (1200000ms)
    expect(mockSetClock).toHaveBeenCalledWith(1200000);
  });

  it("logs only the new period's start if the clock is already at 0", () => {
    const finishedGameState = {
      ...baseGameState,
      clock: { timeRemaining: 0 },
    };

    useStore.setState({ gameState: finishedGameState as any });
    render(
      <GameActionsPanel
        period="1st"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    fireEvent.click(screen.getByText("2nd Period"));

    expect(mockUpdateState).toHaveBeenCalledWith({
      period: "2nd",
      eventLog: [expect.objectContaining({ type: "period_start", period: "2nd", clockTime: "20:00" })],
    });
  });

  it("logs only the new period's start if the end was already added", () => {
    const stateWithEndEvent = {
      ...baseGameState,
      eventLog: [{ type: "period_end", period: "1st" }],
    };

    useStore.setState({ gameState: stateWithEndEvent as any });
    render(
      <GameActionsPanel
        period="1st"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    fireEvent.click(screen.getByText("2nd Period"));

    expect(mockUpdateState).toHaveBeenCalledWith({
      period: "2nd",
      eventLog: [
        { type: "period_end", period: "1st" },
        expect.objectContaining({ type: "period_start", period: "2nd" }),
      ],
    });
  });

  it("highlights the current period", () => {
    const { rerender } = render(
      <GameActionsPanel
        period="1st"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    expect(screen.getByText("1st Period")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("2nd Period")).toHaveAttribute("aria-pressed", "false");

    rerender(
      <GameActionsPanel
        period="2nd"
        updateState={mockUpdateState}
        setClock={mockSetClock}
      />
    );

    expect(screen.getByText("2nd Period")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1st Period")).toHaveAttribute("aria-pressed", "false");
  });
});
