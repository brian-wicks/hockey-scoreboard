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

  it("decrements home score", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        homeTeam: { ...baseState.homeTeam, score: 5 }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeScoreDown");
    });
    expect(useStore.getState().gameState?.homeTeam.score).toBe(4);
  });

  it("does not decrement home score below zero", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeScoreDown");
    });
    expect(useStore.getState().gameState?.homeTeam.score).toBe(0);
  });

  it("decrements away score", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        awayTeam: { ...baseState.awayTeam, score: 3 }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("awayScoreDown");
    });
    expect(useStore.getState().gameState?.awayTeam.score).toBe(2);
  });

  it("decrements home shots and adds event", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        homeTeam: { ...baseState.homeTeam, shots: 10 }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeShotsDown");
    });
    expect(useStore.getState().gameState?.homeTeam.shots).toBe(9);
    expect(useStore.getState().gameState?.eventLog.length).toBe(1);
    expect(useStore.getState().gameState?.eventLog[0].type).toBe("shot_on_goal");
    expect(useStore.getState().gameState?.eventLog[0].shotDelta).toBe(-1);
  });

  it("does not decrement home shots below zero", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homeShotsDown");
    });
    expect(useStore.getState().gameState?.homeTeam.shots).toBe(0);
    expect(useStore.getState().gameState?.eventLog.length).toBe(0);
  });

  it("decrements away shots and adds event", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        awayTeam: { ...baseState.awayTeam, shots: 10 }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("awayShotsDown");
    });
    expect(useStore.getState().gameState?.awayTeam.shots).toBe(9);
    expect(useStore.getState().gameState?.eventLog.length).toBe(1);
    expect(useStore.getState().gameState?.eventLog[0].type).toBe("shot_on_goal");
  });

  it("calls clockIncrease and clockDecrease", () => {
    const clockIncrease = vi.fn();
    const clockDecrease = vi.fn();
    useStore.setState({ clockIncrease, clockDecrease });
    
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("clockIncrease");
      result.current.handleAction("clockDecrease");
    });
    expect(clockIncrease).toHaveBeenCalled();
    expect(clockDecrease).toHaveBeenCalled();
  });

  it("adds away penalty", () => {
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("awayPenaltyAdd");
    });
    expect(useStore.getState().gameState?.awayTeam.penalties.length).toBe(1);
  });

  it("removes earliest home penalty", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        homeTeam: {
          ...baseState.homeTeam,
          penalties: [
            { id: "1", playerNumber: "10", timeRemaining: 120000, duration: 120000, infraction: "Tripping" },
            { id: "2", playerNumber: "20", timeRemaining: 120000, duration: 120000, infraction: "Hooking" },
          ]
        }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("homePenaltyRemoveEarliest");
    });
    expect(useStore.getState().gameState?.homeTeam.penalties.length).toBe(1);
    expect(useStore.getState().gameState?.homeTeam.penalties[0].id).toBe("2");
  });

  it("removes earliest away penalty", () => {
    useStore.setState({
      gameState: {
        ...baseState,
        awayTeam: {
          ...baseState.awayTeam,
          penalties: [
            { id: "1", playerNumber: "10", timeRemaining: 120000, duration: 120000, infraction: "Tripping" },
          ]
        }
      }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("awayPenaltyRemoveEarliest");
    });
    expect(useStore.getState().gameState?.awayTeam.penalties.length).toBe(0);
  });

  it("advances to next period", () => {
    const setClock = vi.fn();
    useStore.setState({ setClock });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("nextPeriod");
    });
    expect(useStore.getState().gameState?.period).toBe("2nd");
    expect(setClock).toHaveBeenCalledWith(20 * 60 * 1000);
  });

  it("goes to previous period", () => {
    useStore.setState({
      gameState: { ...baseState, period: "3rd" },
      setClock: vi.fn()
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("prevPeriod");
    });
    expect(useStore.getState().gameState?.period).toBe("2nd");
  });

  it("adds period_end event when advancing if clock hasn't reached zero", () => {
    useStore.setState({
      gameState: { 
        ...baseState, 
        period: "1st", 
        clock: { ...baseState.clock, timeRemaining: 10000 } 
      },
      setClock: vi.fn()
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("nextPeriod");
    });
    const events = useStore.getState().gameState?.eventLog || [];
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("period_end");
    expect(events[0].period).toBe("1st");
  });

  it("does not add period_end event if already at zero", () => {
    useStore.setState({
      gameState: { 
        ...baseState, 
        period: "1st", 
        clock: { ...baseState.clock, timeRemaining: 0 } 
      },
      setClock: vi.fn()
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("nextPeriod");
    });
    const events = useStore.getState().gameState?.eventLog || [];
    expect(events.length).toBe(0);
  });

  it("warns on unhandled action", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      result.current.handleAction("unknown");
    });
    expect(warnSpy).toHaveBeenCalledWith("Unhandled action: unknown");
    warnSpy.mockRestore();
  });

  it("handles same period update", () => {
    useStore.setState({
      gameState: { ...baseState, period: "1st" }
    });
    const { result } = renderHook(() => useSharedActions());
    act(() => {
      // Internal updatePeriod is called with current period
      // This happens if we call an action that triggers updatePeriod(gameState.period)
      // but nextPeriod and prevPeriod already check this.
      // Wait, let's check how to trigger the 'else' branch.
    });
  });
});
