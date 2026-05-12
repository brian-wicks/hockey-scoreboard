import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ClockControl from "../../components/control-panel/ClockControl";

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockSet = vi.fn();

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
        serverTimeOffsetMs={0} 
      />
    );

    fireEvent.click(screen.getByText("20:00"));
    const input = screen.getByDisplayValue("20:00");
    fireEvent.change(input, { target: { value: "10:00" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockSet).toHaveBeenCalledWith(10 * 60 * 1000);
  });
});
