import { useEffect, useState } from "react";
import type { ClockState } from "../store";
import { formatClockDisplay } from "../utils/clock";

export function useClockDisplay(clock: ClockState | null, serverTimeOffsetMs?: number, fallback = "20:00") {
  const [displayTime, setDisplayTime] = useState(fallback);

  useEffect(() => {
    if (!clock) return;
    let animationFrameId: number;

    const updateDisplay = () => {
      let currentRemaining = clock.timeRemaining;
      if (clock.isRunning) {
        const now = Date.now() + (serverTimeOffsetMs ?? 0);
        const elapsed = now - clock.lastUpdate;
        currentRemaining = Math.max(0, clock.timeRemaining - elapsed);
      }

      setDisplayTime(formatClockDisplay(currentRemaining));

      if (clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [clock?.isRunning, clock?.timeRemaining, clock?.lastUpdate, serverTimeOffsetMs]);

  return displayTime;
}
