import { describe, expect, it } from "vitest";
import type { GameEvent, GameState, Penalty, TeamState } from "../../store";
import { applyGamePatch, createDeleteEventPatch, createGamePatch, invertGamePatch, isUndoable } from "../../utils/gamePatch";

const penalty = (id: string, overrides: Partial<Penalty> = {}): Penalty => ({
  id,
  playerNumber: "10",
  infraction: "HOOK",
  duration: 120000,
  timeRemaining: 90000,
  ...overrides,
});
const team = (overrides: Partial<TeamState> = {}): TeamState =>
  ({ name: "Home", abbreviation: "HOM", score: 2, shots: 5, timeouts: 1, logo: "", color: "#000000", penalties: [], players: [], ...overrides }) as TeamState;
const event = (id: string, overrides: Partial<GameEvent> = {}): GameEvent =>
  ({ id, type: "goal", team: "home", period: "1st", clockTime: "15:00", createdAt: 1, ...overrides }) as GameEvent;
const state = (overrides: Partial<GameState> = {}): GameState =>
  ({ homeTeam: team(), awayTeam: team({ name: "Away" }), period: "1st", eventLog: [], overlayVisible: true, ...overrides }) as GameState;

describe("createGamePatch", () => {
  it("returns null when nothing changed", () => {
    const current = state({ eventLog: [event("g1")] });
    expect(createGamePatch(current, { homeTeam: { ...current.homeTeam }, eventLog: [...current.eventLog], period: "1st" })).toBeNull();
  });

  it("sends score and shots as changes, not totals", () => {
    const current = state();
    const patch = createGamePatch(current, { homeTeam: { ...current.homeTeam, score: 3, shots: 4 } });
    expect(patch?.home).toEqual({ scoreDelta: 1, shotsDelta: -1 });
  });

  it("leaves the unchanged parts of a team out", () => {
    const current = state({ homeTeam: team({ penalties: [penalty("p1")] }) });
    const patch = createGamePatch(current, { homeTeam: { ...current.homeTeam, score: 3 } });
    expect(patch?.home).toEqual({ scoreDelta: 1 });
  });

  it("sends one event's changed field, not the log", () => {
    const current = state({ eventLog: [event("g1"), event("g2")] });
    const patch = createGamePatch(current, {
      eventLog: current.eventLog.map((e) => (e.id === "g2" ? { ...e, scorer: "10" } : e)),
    });
    expect(patch?.events).toEqual({ updated: [{ id: "g2", changes: { scorer: "10" } }] });
  });

  it("never removes an event just because a list left it out", () => {
    const current = state({ eventLog: [event("g1"), event("g2")] });
    expect(createGamePatch(current, { eventLog: [event("g1")] })).toBeNull();
  });

  it("clears an event field set to undefined", () => {
    const current = state({ eventLog: [event("p1", { removalReason: "manual" })] });
    const patch = createGamePatch(current, { eventLog: [{ ...current.eventLog[0], removalReason: undefined }] });
    expect(patch?.events?.updated?.[0].changes).toEqual({ removalReason: null });
  });

  it("ignores a penalty timer that only differs by a clock tick", () => {
    const current = state({ homeTeam: team({ penalties: [penalty("p1", { timeRemaining: 90000 })] }) });
    const patch = createGamePatch(current, {
      homeTeam: { ...current.homeTeam, penalties: [penalty("p1", { timeRemaining: 90400, infraction: "TRIP" })] },
    });
    expect(patch?.home?.penalties?.updated).toEqual([{ id: "p1", changes: { infraction: "TRIP" } }]);
  });

  it("treats a penalty taken off the list as ended early", () => {
    const current = state({ homeTeam: team({ penalties: [penalty("p1")] }) });
    const patch = createGamePatch(current, { homeTeam: { ...current.homeTeam, penalties: [] } });
    expect(patch?.home?.penalties?.removed).toEqual([{ id: "p1", reason: "manual" }]);
  });

  it("only offers undo for team and event changes", () => {
    const current = state();
    expect(isUndoable(createGamePatch(current, { overlayVisible: false })!)).toBe(false);
    expect(isUndoable(createGamePatch(current, { homeTeam: { ...current.homeTeam, score: 3 } })!)).toBe(true);
  });
});

describe("applyGamePatch", () => {
  it("applies a change on top of newer state", () => {
    const stale = state({ eventLog: [event("g1")] });
    const patch = createGamePatch(stale, { eventLog: [{ ...event("g1"), scorer: "10" }] })!;
    const newer = state({ eventLog: [event("g1"), event("g2")] });
    expect(applyGamePatch(newer, patch).eventLog.map((e) => [e.id, e.scorer])).toEqual([
      ["g1", "10"],
      ["g2", undefined],
    ]);
  });

  it("adds a goal to a newer score", () => {
    const stale = state();
    const patch = createGamePatch(stale, { homeTeam: { ...stale.homeTeam, score: 3 } })!;
    expect(applyGamePatch(state({ homeTeam: team({ score: 7 }) }), patch).homeTeam.score).toBe(8);
  });

  it("keeps a newer penalty timer when another field is edited", () => {
    const stale = state({ homeTeam: team({ penalties: [penalty("p1", { timeRemaining: 90000 })] }) });
    const patch = createGamePatch(stale, {
      homeTeam: { ...stale.homeTeam, penalties: [penalty("p1", { timeRemaining: 90000, infraction: "TRIP" })] },
    })!;
    const newer = state({ homeTeam: team({ penalties: [penalty("p1", { timeRemaining: 40000 })] }) });
    expect(applyGamePatch(newer, patch).homeTeam.penalties[0]).toMatchObject({ timeRemaining: 40000, infraction: "TRIP" });
  });

  it("doesn't let the score go below zero", () => {
    const patch = { opId: "a", home: { scoreDelta: -1 } };
    expect(applyGamePatch(state({ homeTeam: team({ score: 0 }) }), patch).homeTeam.score).toBe(0);
  });

  it("clears an event field given null", () => {
    const patch = { opId: "a", events: { updated: [{ id: "p1", changes: { removalReason: null } }] } };
    const next = applyGamePatch(state({ eventLog: [event("p1", { removalReason: "manual" })] }), patch);
    expect(next.eventLog[0]).not.toHaveProperty("removalReason");
  });

  it("takes a deleted penalty's events off the log", () => {
    const current = state({
      homeTeam: team({ penalties: [penalty("p1")] }),
      eventLog: [event("e1", { type: "penalty_added", penaltyId: "p1" }), event("g1")],
    });
    const patch = createDeleteEventPatch(current, "e1")!;
    expect(applyGamePatch(current, patch).eventLog.map((e) => e.id)).toEqual(["g1"]);
  });

  it("keeps an ended penalty's events on the log", () => {
    const current = state({
      homeTeam: team({ penalties: [penalty("p1")] }),
      eventLog: [event("e1", { type: "penalty_added", penaltyId: "p1" })],
    });
    const patch = createGamePatch(current, { homeTeam: { ...current.homeTeam, penalties: [] } })!;
    expect(applyGamePatch(current, patch).eventLog.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("invertGamePatch", () => {
  it("undoes a goal without touching a goal added since", () => {
    const before = state();
    const patch = createGamePatch(before, { homeTeam: { ...before.homeTeam, score: 3 } })!;
    const inverse = invertGamePatch(patch, before);
    const serverNow = state({
      homeTeam: team({ score: 4 }),
      eventLog: [event("mine", { opId: patch.opId }), event("theirs", { opId: "other" })],
    });
    const undone = applyGamePatch(serverNow, inverse);
    expect(undone.homeTeam.score).toBe(3);
    expect(undone.eventLog.map((e) => e.id)).toEqual(["theirs"]);
  });

  it("restores an edited event field, including one that wasn't set", () => {
    const before = state({ eventLog: [event("g1", { scorer: "10" })] });
    const patch = createGamePatch(before, { eventLog: [{ ...before.eventLog[0], scorer: "11", assist1: "12" }] })!;
    const undone = applyGamePatch(applyGamePatch(before, patch), invertGamePatch(patch, before));
    expect(undone.eventLog[0].scorer).toBe("10");
    expect(undone.eventLog[0]).not.toHaveProperty("assist1");
  });

  it("removes an event it added", () => {
    const before = state();
    const patch = createGamePatch(before, { eventLog: [event("s1", { type: "shot_on_goal" })] })!;
    expect(applyGamePatch(applyGamePatch(before, patch), invertGamePatch(patch, before)).eventLog).toEqual([]);
  });

  it("brings back a deleted penalty and its event in the original order", () => {
    const before = state({
      homeTeam: team({ penalties: [penalty("p1")] }),
      eventLog: [event("e1", { type: "penalty_added", penaltyId: "p1", createdAt: 1 }), event("g1", { createdAt: 2 })],
    });
    const patch = createDeleteEventPatch(before, "e1")!;
    const undone = applyGamePatch(applyGamePatch(before, patch), invertGamePatch(patch, before));
    expect(undone.homeTeam.penalties).toEqual([penalty("p1")]);
    expect(undone.eventLog.map((e) => e.id)).toEqual(["e1", "g1"]);
  });

  it("removes a penalty it added", () => {
    const before = state();
    const patch = createGamePatch(before, { homeTeam: { ...before.homeTeam, penalties: [penalty("p1")] } })!;
    expect(applyGamePatch(applyGamePatch(before, patch), invertGamePatch(patch, before)).homeTeam.penalties).toEqual([]);
  });

  it("restores team details", () => {
    const before = state();
    const patch = createGamePatch(before, { homeTeam: { ...before.homeTeam, name: "Renamed" } })!;
    expect(applyGamePatch(applyGamePatch(before, patch), invertGamePatch(patch, before)).homeTeam.name).toBe("Home");
  });
});

describe("createDeleteEventPatch", () => {
  const roundTrip = (before: GameState, id: string) => {
    const patch = createDeleteEventPatch(before, id)!;
    const after = applyGamePatch(before, patch);
    return { after, undone: applyGamePatch(after, invertGamePatch(patch, before)) };
  };

  it("takes a deleted goal off the score, and undo restores both", () => {
    const before = state({ homeTeam: team({ score: 2 }), eventLog: [event("g1", { createdAt: 1 }), event("g2", { createdAt: 2 })] });
    const { after, undone } = roundTrip(before, "g1");
    expect(after.homeTeam.score).toBe(1);
    expect(after.eventLog.map((e) => e.id)).toEqual(["g2"]);
    expect(undone.homeTeam.score).toBe(2);
    expect(undone.eventLog.map((e) => e.id)).toEqual(["g1", "g2"]);
  });

  it("puts a goal back on the score when its revoke is deleted", () => {
    const before = state({
      homeTeam: team({ score: 0 }),
      eventLog: [event("g1", { createdAt: 1 }), event("r1", { type: "goal_revoked", createdAt: 2 })],
    });
    expect(roundTrip(before, "r1").after.homeTeam.score).toBe(1);
  });

  it("leaves the score alone when a goal that was already revoked is deleted", () => {
    const before = state({
      homeTeam: team({ score: 0 }),
      eventLog: [event("g1", { createdAt: 1 }), event("r1", { type: "goal_revoked", createdAt: 2 })],
    });
    expect(createDeleteEventPatch(before, "g1")?.home).toBeUndefined();
  });

  it("only changes the event's own team", () => {
    const before = state({ eventLog: [event("g1", { team: "away" })], awayTeam: team({ score: 1 }), homeTeam: team({ score: 4 }) });
    const { after } = roundTrip(before, "g1");
    expect(after.awayTeam.score).toBe(0);
    expect(after.homeTeam.score).toBe(4);
  });

  it("reverses a shot in either direction", () => {
    const up = state({ homeTeam: team({ shots: 5 }), eventLog: [event("s1", { type: "shot_on_goal", shotDelta: 1 })] });
    expect(roundTrip(up, "s1").after.homeTeam.shots).toBe(4);
    const down = state({ homeTeam: team({ shots: 5 }), eventLog: [event("s1", { type: "shot_on_goal", shotDelta: -1 })] });
    expect(roundTrip(down, "s1").after.homeTeam.shots).toBe(6);
  });

  it("takes a running penalty off the clock with its event", () => {
    const before = state({
      homeTeam: team({ penalties: [penalty("p1")] }),
      eventLog: [event("e1", { type: "penalty_added", penaltyId: "p1" })],
    });
    const { after, undone } = roundTrip(before, "e1");
    expect(after.homeTeam.penalties).toEqual([]);
    expect(after.eventLog).toEqual([]);
    expect(undone.homeTeam.penalties).toEqual([penalty("p1")]);
    expect(undone.eventLog.map((e) => e.id)).toEqual(["e1"]);
  });

  it("removes a finished penalty and its note, and undo restores them without restarting it", () => {
    const before = state({
      eventLog: [
        event("e1", { type: "penalty_added", penaltyId: "p1", endClockTime: "10:00", createdAt: 1 }),
        event("n1", { type: "penalty_over_notice", penaltyId: "p1", createdAt: 2 }),
      ],
    });
    const { after, undone } = roundTrip(before, "e1");
    expect(after.eventLog).toEqual([]);
    expect(undone.eventLog.map((e) => e.id)).toEqual(["e1", "n1"]);
    expect(undone.homeTeam.penalties).toEqual([]);
  });

  it("removes a goalie change with nothing else affected", () => {
    const before = state({ eventLog: [event("c1", { type: "goalie_change", goalie: "30" })] });
    const { after } = roundTrip(before, "c1");
    expect(after.eventLog).toEqual([]);
    expect(after.homeTeam).toEqual(before.homeTeam);
  });

  it("won't delete a period row", () => {
    const before = state({ eventLog: [event("e1", { type: "period_end" }), event("s1", { type: "period_start" })] });
    expect(createDeleteEventPatch(before, "e1")).toBeNull();
    expect(createDeleteEventPatch(before, "s1")).toBeNull();
  });

  it("returns null for an event that's gone", () => {
    expect(createDeleteEventPatch(state(), "missing")).toBeNull();
  });
});

describe("the game ID on a patch", () => {
  it("does not end up in the state", () => {
    const next = applyGamePatch(state(), { opId: "a", gameId: "game-1", home: { scoreDelta: 1 } });
    expect(next).not.toHaveProperty("gameId");
    expect(next.homeTeam.score).toBe(3);
  });

  it("does not carry over to the inverse", () => {
    const inverse = invertGamePatch({ opId: "a", gameId: "game-1", home: { scoreDelta: 1 } }, state());
    expect(inverse).not.toHaveProperty("gameId");
    expect(inverse.home?.scoreDelta).toBe(-1);
  });
});
