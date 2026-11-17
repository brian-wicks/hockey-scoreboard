import { useEffect, useRef, useState } from "react";
import { useStore, type ClockState } from "../store";
import { formatClockDisplay, liveClockMs, livePenaltyMs } from "../utils/clock";

// The clock is shown to a tenth of a second, so a finer step only adds renders.
const DISPLAY_STEP_MS = 100;
// Smaller than the one second an operator adds with the clock buttons.
const BACKWARD_JITTER_MS = 500;

/** The clock's time, counted down on this screen between updates from the server. */
export function useLiveClockMs(clock: ClockState | null, serverTimeOffsetMs?: number): number | null {
  const [displayMs, setDisplayMs] = useState<number | null>(clock ? clock.timeRemaining : null);
  const lastShownRef = useRef<number | null>(null);

  useEffect(() => {
    if (!clock) {
      lastShownRef.current = null;
      setDisplayMs(null);
      return;
    }
    let animationFrameId: number;

    const updateDisplay = () => {
      const serverNow = Date.now() + (serverTimeOffsetMs ?? 0);
      let next = Math.floor(liveClockMs(clock, serverNow) / DISPLAY_STEP_MS) * DISPLAY_STEP_MS;
      // An update that took longer to arrive can put a running clock a little behind what this
      // screen already showed. Hold the shown time until the count catches up rather than go back.
      const lastShown = lastShownRef.current;
      if (clock.isRunning && lastShown !== null && next > lastShown && next - lastShown < BACKWARD_JITTER_MS) {
        next = lastShown;
      }
      lastShownRef.current = next;
      setDisplayMs(next);

      if (clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [clock?.isRunning, clock?.timeRemaining, clock?.lastUpdate, serverTimeOffsetMs]);

  return clock ? displayMs : null;
}

export function useClockDisplay(clock: ClockState | null, serverTimeOffsetMs?: number, fallback = "20:00") {
  const displayMs = useLiveClockMs(clock, serverTimeOffsetMs);
  return displayMs === null ? fallback : formatClockDisplay(displayMs);
}

/** A penalty's time, counted down on this screen along with the game clock. */
export function useLivePenaltyMs(penaltyMs: number): number {
  const { gameState, serverTimeOffsetMs } = useStore();
  const clock = gameState?.clock ?? null;
  const clockMs = useLiveClockMs(clock, serverTimeOffsetMs);
  return clock && clockMs !== null ? livePenaltyMs(penaltyMs, clock, clockMs) : penaltyMs;
}
