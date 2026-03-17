import { GameEvent, GameState } from "../store";
function formatEventClock(currentRemainingMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, currentRemainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildBaseEvent(gameState: GameState, team: "home" | "away") {
  return {
    id: Math.random().toString(36).slice(2, 11),
    team,
    period: gameState.period,
    clockTime: formatEventClock(gameState.clock.timeRemaining),
    createdAt: Date.now(),
  };
}

export function buildShotEvent(gameState: GameState, team: "home" | "away", delta: number): GameEvent {
  return {
    ...buildBaseEvent(gameState, team),
    type: "shot_on_goal",
    shotDelta: delta,
  };
}

export function buildGoalieChangeEvent(gameState: GameState, team: "home" | "away", goalie: string): GameEvent {
  return {
    ...buildBaseEvent(gameState, team),
    type: "goalie_change",
    goalie,
  };
}

export function buildPeriodEndEvent(gameState: GameState, period: string): GameEvent {
  return {
    id: Math.random().toString(36).slice(2, 11),
    type: "period_end",
    team: "home",
    period,
    clockTime: "0:00",
    createdAt: Date.now(),
    readOnly: true,
    note: "End of period",
  };
}
