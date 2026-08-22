import { GameState } from "../store";

const FULL_PERIOD_MS = 20 * 60 * 1000;
// Mirrors PERIOD_CLOCKS_MS in useSharedActions.ts / GameActionsPanel.tsx — OT runs a
// shorter clock than regulation periods, so a fresh, untouched OT period must be
// compared against its own 5-minute length, not the 20-minute regulation length.
const PERIOD_LENGTHS_MS: Record<string, number> = {
  "1st": FULL_PERIOD_MS,
  "2nd": FULL_PERIOD_MS,
  "3rd": FULL_PERIOD_MS,
  OT: 5 * 60 * 1000,
};

/** True if the live game looks like it's actually being played, not just sitting at
 * factory defaults — used to decide whether "New Game" needs a data-loss confirmation. */
export function isGameInProgress(gameState: GameState): boolean {
  const periodLengthMs = PERIOD_LENGTHS_MS[gameState.period] ?? FULL_PERIOD_MS;
  return (
    gameState.eventLog.length > 0 ||
    gameState.homeTeam.score > 0 ||
    gameState.awayTeam.score > 0 ||
    gameState.clock.isRunning ||
    gameState.clock.timeRemaining < periodLengthMs
  );
}
