import type { GameState } from "../store";
import { buildPeriodEndEvent, buildPeriodStartEvent } from "./eventLog";

export const PERIOD_CLOCKS_MS: Record<string, number> = {
  "1st": 20 * 60 * 1000,
  "2nd": 20 * 60 * 1000,
  "3rd": 20 * 60 * 1000,
  OT: 5 * 60 * 1000,
};

export const PERIOD_ORDER = ["1st", "2nd", "3rd", "OT"];

// The period after this one, or null once overtime is over.
export function getNextPeriod(period: string): string | null {
  const index = PERIOD_ORDER.indexOf(period);
  return index >= 0 && index < PERIOD_ORDER.length - 1 ? PERIOD_ORDER[index + 1] : null;
}

// Transitions the game to nextPeriod: logs a period_end event for the period
// being left (unless it already ended — clock at 0, or the last event already
// recorded that period's end) and a period_start event for the new one, then resets
// the clock to nextPeriod's length.
export function transitionToPeriod(
  gameState: GameState,
  currentPeriod: string,
  nextPeriod: string,
  updateState: (updates: Partial<GameState>) => void,
  setClock: (timeMs: number) => void,
) {
  const nextClock = PERIOD_CLOCKS_MS[nextPeriod];

  if (currentPeriod && currentPeriod !== nextPeriod) {
    const lastEvent = gameState.eventLog[gameState.eventLog.length - 1];
    const alreadyEnded =
      (gameState.clock.timeRemaining ?? 0) <= 0 ||
      (lastEvent?.type === "period_end" && lastEvent.period === currentPeriod);
    const startEvent = buildPeriodStartEvent(nextPeriod, nextClock ?? gameState.clock.timeRemaining);

    updateState({
      period: nextPeriod,
      eventLog: [
        ...gameState.eventLog,
        ...(alreadyEnded ? [] : [buildPeriodEndEvent(gameState, currentPeriod)]),
        startEvent,
      ],
    });
  } else {
    updateState({ period: nextPeriod });
  }

  if (typeof nextClock === "number") {
    setClock(nextClock);
  }
}
