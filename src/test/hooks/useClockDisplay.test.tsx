import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClockDisplay, useLiveClockMs } from "../../hooks/useClockDisplay";
import type { ClockState } from "../../store";

function ClockDisplay({ clock, offset }: { clock: ClockState | null; offset?: number }) {
  const display = useClockDisplay(clock, offset, "20:00");
  return <div data-testid="clock">{display}</div>;
}

describe("useClockDisplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("shows fallback when no clock", () => {
    render(<ClockDisplay clock={null} />);
    expect(screen.getByTestId("clock")).toHaveTextContent("20:00");
  });

  it("shows static formatted time when not running", () => {
    render(
      <ClockDisplay
        clock={{
          timeRemaining: 90500,
          isRunning: false,
          lastUpdate: 1000,
        }}
      />,
    );
    expect(screen.getByTestId("clock")).toHaveTextContent("1:30");
  });

  it("updates time when running with server offset", () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(100000);

    render(
      <ClockDisplay
        clock={{
          timeRemaining: 60000,
          isRunning: true,
          lastUpdate: 100000,
        }}
        offset={1000}
      />,
    );

    act(() => {
      nowSpy.mockReturnValue(100500);
      vi.advanceTimersByTime(16);
    });

    expect(screen.getByTestId("clock").textContent).toMatch(/^\d{1,2}\.\d$|^\d+:\d{2}$/);
    nowSpy.mockRestore();
  });

  describe("a running clock that gets a late update", () => {
    function LiveClock({ clock, offset }: { clock: ClockState; offset?: number }) {
      return <div data-testid="ms">{useLiveClockMs(clock, offset)}</div>;
    }
    const running = (timeRemaining: number, lastUpdate: number): ClockState => ({ timeRemaining, isRunning: true, lastUpdate });

    it("holds the time shown instead of counting back up", () => {
      vi.useFakeTimers();
      const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
      const { rerender } = render(<LiveClock clock={running(60_000, 9_000)} />);
      expect(screen.getByTestId("ms")).toHaveTextContent("59000");

      // Says the clock was at 59.3 seconds just now.
      rerender(<LiveClock clock={running(59_300, 10_000)} />);
      expect(screen.getByTestId("ms")).toHaveTextContent("59000");

      act(() => {
        nowSpy.mockReturnValue(10_500);
        vi.advanceTimersByTime(16);
      });
      expect(screen.getByTestId("ms")).toHaveTextContent("58800");
    });

    it("still shows a second added by the operator", () => {
      vi.useFakeTimers();
      vi.spyOn(Date, "now").mockReturnValue(10_000);
      const { rerender } = render(<LiveClock clock={running(60_000, 10_000)} />);

      rerender(<LiveClock clock={running(61_000, 10_000)} />);

      expect(screen.getByTestId("ms")).toHaveTextContent("61000");
    });
  });
});
