import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useSharedActions } from "../../hooks/useSharedActions";
import { useStore, GameState } from "../../store";

const baseState: GameState = {
  homeTeam: {
    name: "Home",
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
    name: "Away",
    abbreviation: "AWY",
    score: 0,
    shots: 0,
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
  jumbotronGradientsEnabled: true,
  lowerThird: { active: false, title: "", subtitle: "" },
  jumbotronGoalHighlight: null,
};

describe("useSharedActions", () => {
  beforeEach(() => {
    useStore.setState({
      gameState: { ...baseState },
      socket: { emit: vi.fn() } as any,
      startClock: vi.fn(),
      stopClock: vi.fn(),
      clockIncrease: vi.fn(),
      clockDecrease: vi.fn(),
      updateState: (updates) => {
        const current = useStore.getState().gameState;
        if (current) {
          useStore.setState({ gameState: { ...current, ...updates } });
        }
      },
    });
  });

  it("increments home score", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeScoreUp");
    });
    expect(useStore.getState().gameState?.homeTeam.score).toBe(1);
  });

  it("increments away score", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("awayScoreUp");
    });
    expect(useStore.getState().gameState?.awayTeam.score).toBe(1);
  });

  it("increments home shots and adds event", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeShotsUp");
    });
    expect(useStore.getState().gameState?.homeTeam.shots).toBe(1);
    expect(useStore.getState().gameState?.eventLog.length).toBe(1);
    expect(useStore.getState().gameState?.eventLog[0].type).toBe("shot_on_goal");
  });

  it("toggles clock from stopped to running", () => {
    const startClock = vi.fn();
    useStore.setState({ startClock });
    
    const { result } = renderHook(() => useSharedActions());

    act(() => {
      result.current.handleAction("toggleClock");
    });
    expect(startClock).toHaveBeenCalled();
  });

  it("toggles clock from running to stopped", () => {
    const stopClock = vi.fn();
    useStore.setState({ 
      stopClock,
      gameState: {
        ...baseState,
        clock: { ...baseState.clock, isRunning: true }
      }
    });
    
    const { result } = renderHook(() => useSharedActions());

    act(() => {
      result.current.handleAction("toggleClock");
    });
    expect(stopClock).toHaveBeenCalled();
  });

  it("adds home penalty", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homePenaltyAdd");
    });
    expect(useStore.getState().gameState?.homeTeam.penalties.length).toBe(1);
  });
});
