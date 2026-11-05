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

function matchesRevokedGoal(goal: GameEvent, revoked: GameEvent) {
  const norm = (v: string | undefined) => (v ?? "").trim();
  return (
    norm(goal.period) === norm(revoked.period) &&
    norm(goal.clockTime) === norm(revoked.clockTime) &&
    norm(goal.scorer) === norm(revoked.scorer) &&
    norm(goal.assist1) === norm(revoked.assist1) &&
    norm(goal.assist2) === norm(revoked.assist2)
  );
}

/** The goals still standing, in the order they were logged. */
export function getLiveGoals(eventLog: GameEvent[]): GameEvent[] {
  const sorted = eventLog.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const goals: GameEvent[] = [];

  for (const e of sorted) {
    if (e.type === "goal") {
      goals.push(e);
      continue;
    }
    if (e.type === "goal_revoked") {
      // A revoke carries the clock from when it happened, which rarely equals the goal's, so
      // it only names a goal when everything matches. Otherwise it takes the team's latest goal.
      let latest = -1;
      let matching = -1;
      for (let i = goals.length - 1; i >= 0 && matching < 0; i -= 1) {
        if (goals[i].team !== e.team) continue;
        if (latest < 0) latest = i;
        if (matchesRevokedGoal(goals[i], e)) matching = i;
      }
      const index = matching >= 0 ? matching : latest;
      if (index >= 0) goals.splice(index, 1);
    }
  }
  return goals;
}
