import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useClockDisplay } from "../../hooks/useClockDisplay";
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
});
