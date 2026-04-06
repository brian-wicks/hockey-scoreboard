import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, KeyboardShortcut } from "../../store";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

const startClock = vi.fn();
const stopClock = vi.fn();
const clockIncrease = vi.fn();
const clockDecrease = vi.fn();
const setClock = vi.fn();
const updateState = vi.fn();
let currentState: GameState;
let currentShortcuts: KeyboardShortcut[] = [];

const baseState: GameState = {
  homeTeam: {
    name: "Home",
    abbreviation: "HOM",
    score: 1,
    shots: 2,
    timeouts: 1,
    logo: "",
    color: "#000000",
    penalties: [],
    players: [],
  },
  awayTeam: {
    name: "Away",
    abbreviation: "AWY",
    score: 3,
    shots: 4,
    timeouts: 1,
    logo: "",
    color: "#ffffff",
    penalties: [],
    players: [],
  },
  clock: {
    timeRemaining: 60000,
    isRunning: false,
    lastUpdate: 0,
  },
  period: "1st",
  eventLog: [],
  overlayVisible: true,
  overlayLayout: "main",
  overlayCorner: "top-left",
  jumbotronGradientsEnabled: true,
  jumbotronGoalHighlight: null,
};

vi.mock("../../store", () => ({
  useStore: () => ({
    gameState: currentState,
    startClock,
    stopClock,
    clockIncrease,
    clockDecrease,
    setClock,
    updateState,
    keyboardShortcuts: currentShortcuts,
  }),
}));

function ShortcutHost({ active }: { active: boolean }) {
  useKeyboardShortcuts(active);
  return null;
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentState = structuredClone(baseState);
    currentShortcuts = [
      { key: " ", action: "toggleClock", description: "Toggle Clock" },
      { key: "ArrowUp", action: "clockIncrease", description: "Increase Clock" },
      { key: "ArrowDown", action: "clockDecrease", description: "Decrease Clock" },
      { key: "ArrowLeft", action: "homeScoreUp", description: "Home Score +1" },
      { key: "ArrowRight", action: "awayScoreUp", description: "Away Score +1" },
      { key: "ArrowLeft", ctrl: true, action: "homeShotsUp", description: "Home Shots +1" },
      { key: "ArrowRight", ctrl: true, action: "awayShotsUp", description: "Away Shots +1" },
      { key: "ArrowLeft", shift: true, action: "homeScoreDown", description: "Home Score -1" },
      { key: "ArrowRight", shift: true, action: "awayScoreDown", description: "Away Score -1" },
      { key: "ArrowLeft", ctrl: true, shift: true, action: "homeShotsDown", description: "Home Shots -1" },
      { key: "ArrowRight", ctrl: true, shift: true, action: "awayShotsDown", description: "Away Shots -1" },
      { key: "ArrowLeft", alt: true, action: "homePenaltyAdd", description: "Add Home Penalty" },
      { key: "ArrowRight", alt: true, action: "awayPenaltyAdd", description: "Add Away Penalty" },
      {
        key: "ArrowLeft",
        shift: true,
        alt: true,
        action: "homePenaltyRemoveEarliest",
        description: "Remove Earliest Home Penalty",
      },
      {
        key: "ArrowRight",
        shift: true,
        alt: true,
        action: "awayPenaltyRemoveEarliest",
        description: "Remove Earliest Away Penalty",
      },
    ];
  });
  it("does nothing when inactive", () => {
    render(<ShortcutHost active={false} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(startClock).not.toHaveBeenCalled();
    expect(stopClock).not.toHaveBeenCalled();
  });

  it("toggles clock based on running state", () => {
    render(<ShortcutHost active />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    });
    expect(startClock).toHaveBeenCalledTimes(1);
  });

  it("calls clock controls for increase/decrease", () => {
    render(<ShortcutHost active />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    expect(clockIncrease).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    });
    expect(clockDecrease).toHaveBeenCalledTimes(1);
  });

  it("updates state for score and shot shortcuts", () => {
    render(<ShortcutHost active />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });
    expect(updateState).toHaveBeenCalledWith({
      homeTeam: { ...baseState.homeTeam, score: baseState.homeTeam.score + 1 },
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", ctrlKey: true }));
    });

    const lastCall = updateState.mock.calls[updateState.mock.calls.length - 1][0] as Partial<GameState>;
    expect(lastCall.awayTeam?.shots).toBe(baseState.awayTeam.shots + 1);
    expect(lastCall.eventLog?.[0]?.type).toBe("shot_on_goal");
  });

  it("clamps score and shots when decrementing", () => {
    currentState.homeTeam.score = 0;
    currentState.homeTeam.shots = 0;
    render(<ShortcutHost active />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true }));
    });
    expect(updateState).toHaveBeenCalledWith({
      homeTeam: { ...currentState.homeTeam, score: 0 },
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true, shiftKey: true }));
    });
    const lastCall = updateState.mock.calls[updateState.mock.calls.length - 1][0] as Partial<GameState>;
    expect(lastCall.homeTeam?.shots).toBe(0);
    expect(lastCall.eventLog).toBeUndefined();
  });

  it("adds and removes penalties", () => {
    currentState.homeTeam.penalties = [
      { id: "p1", playerNumber: "12", timeRemaining: 120000, duration: 120000, infraction: "" },
    ];
    render(<ShortcutHost active />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true }));
    });
    const addCall = updateState.mock.calls[updateState.mock.calls.length - 1][0] as Partial<GameState>;
    expect(addCall.homeTeam?.penalties?.length).toBe(2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, shiftKey: true }));
    });
    const removeCall = updateState.mock.calls[updateState.mock.calls.length - 1][0] as Partial<GameState>;
    expect(removeCall.homeTeam?.penalties?.length).toBe(0);
  });

  it("ignores shortcuts when typing in inputs", () => {
    render(
      <div>
        <ShortcutHost active />
        <input data-testid="field" />
      </div>,
    );
    const input = document.querySelector("input") as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });
    expect(updateState).not.toHaveBeenCalled();
  });
});
