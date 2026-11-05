import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ClockControl from "../../components/control-panel/ClockControl";
import { useStore } from "../../store";

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

const baseClock = { timeRemaining: 1200000, isRunning: false, lastUpdate: 0 };

describe("ClockControl Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the time and handles start/stop", () => {
    render(
      <ClockControl 
        clock={baseClock} 
        period="1st" 
        startClock={mockStart} 
        stopClock={mockStop} 
        setClock={mockSet}
        updateState={mockUpdate} 
        serverTimeOffsetMs={0} 
      />
    );

    expect(screen.getByText("20:00")).toBeInTheDocument();
    
    const startButton = screen.getByText(/START/i);
    fireEvent.click(startButton);

    expect(mockStart).toHaveBeenCalled();
  });

  it("handles resetting the clock", () => {
    const runningClock = { ...baseClock, isRunning: true };
    render(
      <ClockControl 
        clock={runningClock} 
        period="1st" 
        startClock={mockStart} 
        stopClock={mockStop} 
        setClock={mockSet}
        updateState={mockUpdate} 
        serverTimeOffsetMs={0} 
      />
    );

    const stopButton = screen.getByText(/STOP/i);
    fireEvent.click(stopButton);

    expect(mockStop).toHaveBeenCalled();
  });

  it("handles clock reset buttons", () => {
    render(
        <ClockControl 
          clock={baseClock} 
          period="1st" 
          startClock={mockStart} 
          stopClock={mockStop} 
          setClock={mockSet}
          updateState={mockUpdate} 
          serverTimeOffsetMs={0} 
        />
      );
  
      const reset5 = screen.getByText(/Reset 5:00/i);
      fireEvent.click(reset5);
  
      expect(mockSet).toHaveBeenCalledWith(5 * 60 * 1000);
  });

  it("allows editing the clock manually", () => {
    render(
      <ClockControl 
        clock={baseClock} 
        period="1st" 
        startClock={mockStart} 
        stopClock={mockStop} 
        setClock={mockSet}
        updateState={mockUpdate} 
        serverTimeOffsetMs={0} 
      />
    );

    // Click on the clock display to start editing
    fireEvent.click(screen.getByText("20:00"));

    const input = screen.getByDisplayValue("20:00");
    fireEvent.change(input, { target: { value: "15:30" } });

    // Component handles onBlur or Enter to save
    fireEvent.blur(input);

    expect(mockSet).toHaveBeenCalledWith((15 * 60 + 30) * 1000);
  });

  it("handles clock edit on Enter key", () => {
    render(
      <ClockControl 
        clock={baseClock} 
        period="1st" 
        startClock={mockStart} 
        stopClock={mockStop} 
        setClock={mockSet}
        updateState={mockUpdate} 
        serverTimeOffsetMs={0} 
      />
    );

    fireEvent.click(screen.getByText("20:00"));
    const input = screen.getByDisplayValue("20:00");
    fireEvent.change(input, { target: { value: "10:00" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSet).toHaveBeenCalledWith(10 * 60 * 1000);
  });

  it("cancels the pending animation frame loop on unmount", () => {
    const cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const runningClock = { ...baseClock, isRunning: true };
    const { unmount } = render(
      <ClockControl
        clock={runningClock}
        period="1st"
        startClock={mockStart}
        stopClock={mockStop}
        setClock={mockSet}
        updateState={mockUpdate}
        serverTimeOffsetMs={0}
      />
    );

    // Operators switch tabs away from the clock while it's still running;
    // the display-ticking loop must stop rather than leak forever.
    unmount();

    expect(cafSpy).toHaveBeenCalled();
    cafSpy.mockRestore();
  });

  describe("when the clock reaches zero", () => {
    const zeroClock = { ...baseClock, timeRemaining: 0 };
    const renderClock = (clock: typeof baseClock, period = "1st") => (
      <ClockControl
        clock={clock}
        period={period}
        startClock={mockStart}
        stopClock={mockStop}
        setClock={mockSet}
        updateState={mockUpdate}
        serverTimeOffsetMs={0}
      />
    );

    beforeEach(() => {
      useStore.setState({ gameState: { clock: zeroClock, eventLog: [] } as any });
    });

    it.each([
      ["1st", "Go to 2nd period", "2nd", 20 * 60 * 1000],
      ["2nd", "Go to 3rd period", "3rd", 20 * 60 * 1000],
      ["3rd", "Go to overtime", "OT", 5 * 60 * 1000],
    ])("moves on from the %s period", (period, label, next, nextClock) => {
      render(renderClock(zeroClock, period));

      expect(screen.queryByRole("button", { name: /^Start/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: label }));

      expect(mockUpdate).toHaveBeenCalledWith({
        period: next,
        eventLog: [expect.objectContaining({ type: "period_start", period: next })],
      });
      expect(mockSet).toHaveBeenCalledWith(nextClock);
      expect(mockStart).not.toHaveBeenCalled();
    });

    it("keeps a disabled Start button after overtime, with no period to move on to", () => {
      render(renderClock(zeroClock, "OT"));

      expect(screen.getByRole("button", { name: /Start/ })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /^Go to/ })).not.toBeInTheDocument();
    });

    it("ignores clicks just after the clock runs out, so a late Stop can't skip the period", () => {
      vi.useFakeTimers();
      try {
        const { rerender } = render(renderClock({ ...baseClock, isRunning: true, timeRemaining: 500 }));
        rerender(renderClock(zeroClock));

        const next = screen.getByRole("button", { name: "Go to 2nd period" });
        expect(next).toBeDisabled();

        act(() => {
          vi.advanceTimersByTime(1500);
        });
        expect(next).toBeEnabled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
