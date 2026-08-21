import { GameState } from "../store";

const FULL_PERIOD_MS = 20 * 60 * 1000;

/** True if the live game looks like it's actually being played, not just sitting at
 * factory defaults — used to decide whether "New Game" needs a data-loss confirmation. */
export function isGameInProgress(gameState: GameState): boolean {
  return (
    gameState.eventLog.length > 0 ||
    gameState.homeTeam.score > 0 ||
    gameState.awayTeam.score > 0 ||
    gameState.clock.isRunning ||
    gameState.clock.timeRemaining < FULL_PERIOD_MS
  );
}
