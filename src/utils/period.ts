import type { GameState } from "../store";
import { buildPeriodEndEvent } from "./eventLog";

export const PERIOD_CLOCKS_MS: Record<string, number> = {
  "1st": 20 * 60 * 1000,
  "2nd": 20 * 60 * 1000,
  "3rd": 20 * 60 * 1000,
  OT: 5 * 60 * 1000,
};

// Transitions the game to nextPeriod: logs a period_end event for the period
// being left (unless it already ended — clock at 0, or the last event already
// recorded that period's end), then resets the clock to nextPeriod's length.
export function transitionToPeriod(
  gameState: GameState,
  currentPeriod: string,
  nextPeriod: string,
  updateState: (updates: Partial<GameState>) => void,
  setClock: (timeMs: number) => void,
) {
  if (currentPeriod && currentPeriod !== nextPeriod) {
    const lastEvent = gameState.eventLog[gameState.eventLog.length - 1];
    const alreadyEnded =
      (gameState.clock.timeRemaining ?? 0) <= 0 ||
      (lastEvent?.type === "period_end" && lastEvent.period === currentPeriod);

    if (alreadyEnded) {
      updateState({ period: nextPeriod });
    } else {
      const endEvent = buildPeriodEndEvent(gameState, currentPeriod);
      updateState({ period: nextPeriod, eventLog: [...gameState.eventLog, endEvent] });
    }
  } else {
    updateState({ period: nextPeriod });
  }

  const nextClock = PERIOD_CLOCKS_MS[nextPeriod];
  if (typeof nextClock === "number") {
    setClock(nextClock);
  }
}
