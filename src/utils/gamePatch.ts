// How the control panel sends changes to the server. A patch holds only what the operator
// changed, so the server can apply it to its own newer state instead of being overwritten by
// a copy of the whole team or event log that may be out of date on a slow connection.
import type { GameEvent, GameState, Penalty, TeamState } from "../store";
import { getLiveGoals } from "./eventLog";

export type PenaltyRemovalReason = "manual" | "deleted";

export interface PenaltyPatch {
  added?: Penalty[];
  updated?: { id: string; changes: Partial<Penalty> }[];
  /** "manual" means the penalty ended early and stays on the gamesheet. "deleted" means it was a mistake. */
  removed?: { id: string; reason: PenaltyRemovalReason }[];
}

export interface TeamPatch {
  set?: Partial<TeamState>;
  scoreDelta?: number;
  shotsDelta?: number;
  penalties?: PenaltyPatch;
}

export interface EventLogPatch {
  added?: GameEvent[];
  /** A null value clears that field. */
  updated?: { id: string; changes: Record<string, unknown> }[];
  removed?: string[];
}

export interface GamePatch {
  opId: string;
  /** The game this change was made for. The server drops the patch if another game is active. */
  gameId?: string;
  /** Set when this patch undoes an earlier one. The server also drops the events that one logged. */
  undoOf?: string;
  /** Stops the server logging events for this patch's score and penalty changes. */
  noLog?: boolean;
  fields?: Partial<GameState>;
  home?: TeamPatch;
  away?: TeamPatch;
  events?: EventLogPatch;
}

type Side = "home" | "away";
const SIDES: Side[] = ["home", "away"];
const teamKey = (side: Side) => (side === "home" ? "homeTeam" : "awayTeam");

// The timer moves on every clock tick, so a smaller gap than this is a tick, not an edit.
const MIN_PENALTY_TIME_EDIT_MS = 1000;

const newOpId = () => Math.random().toString(36).slice(2, 13);
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isEmpty = (value: object) => Object.keys(value).length === 0;

function diffPenalties(current: Penalty[], next: Penalty[]): PenaltyPatch | undefined {
  const currentById = new Map(current.map((penalty) => [penalty.id, penalty]));
  const nextIds = new Set(next.map((penalty) => penalty.id));
  const patch: PenaltyPatch = {};

  for (const penalty of next) {
    const existing = currentById.get(penalty.id);
    if (!existing) {
      (patch.added ??= []).push(penalty);
      continue;
    }
    const changes: Partial<Penalty> = {};
    for (const key of Object.keys(penalty) as (keyof Penalty)[]) {
      if (penalty[key] === existing[key]) continue;
      if (key === "timeRemaining" && Math.abs(penalty.timeRemaining - existing.timeRemaining) < MIN_PENALTY_TIME_EDIT_MS) continue;
      Object.assign(changes, { [key]: penalty[key] });
    }
    if (!isEmpty(changes)) (patch.updated ??= []).push({ id: penalty.id, changes });
  }

  for (const penalty of current) {
    if (!nextIds.has(penalty.id)) {
      (patch.removed ??= []).push({ id: penalty.id, reason: "manual" });
    }
  }
  return isEmpty(patch) ? undefined : patch;
}

function diffTeam(current: TeamState, next: Partial<TeamState>): TeamPatch | undefined {
  const patch: TeamPatch = {};
  for (const key of Object.keys(next) as (keyof TeamState)[]) {
    if (key === "score" || key === "shots") {
      const delta = (next[key] as number) - current[key];
      if (delta !== 0) patch[key === "score" ? "scoreDelta" : "shotsDelta"] = delta;
    } else if (key === "penalties") {
      const penalties = diffPenalties(current.penalties, next.penalties ?? []);
      if (penalties) patch.penalties = penalties;
    } else if (!sameValue(next[key], current[key])) {
      patch.set = { ...patch.set, [key]: next[key] };
    }
  }
  return isEmpty(patch) ? undefined : patch;
}

// Only looks for new and edited events. Nothing can drop an event just by leaving it out of a
// list, because that list could be missing one the server has only just logged.
function diffEvents(current: GameEvent[], next: GameEvent[]): EventLogPatch | undefined {
  const currentById = new Map(current.map((event) => [event.id, event]));
  const patch: EventLogPatch = {};

  for (const event of next) {
    const existing = currentById.get(event.id) as unknown as Record<string, unknown> | undefined;
    if (!existing) {
      (patch.added ??= []).push(event);
      continue;
    }
    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event)) {
      if (!sameValue(value, existing[key])) changes[key] = value === undefined ? null : value;
    }
    if (!isEmpty(changes)) (patch.updated ??= []).push({ id: event.id, changes });
  }
  return isEmpty(patch) ? undefined : patch;
}

/** What `updates` changes compared with `current`, or null if it changes nothing. */
export function createGamePatch(current: GameState, updates: Partial<GameState>): GamePatch | null {
  const patch: GamePatch = { opId: newOpId() };

  for (const [key, value] of Object.entries(updates)) {
    if (key === "homeTeam" || key === "awayTeam") {
      const side: Side = key === "homeTeam" ? "home" : "away";
      const teamPatch = diffTeam(current[key], value as Partial<TeamState>);
      if (teamPatch) patch[side] = teamPatch;
    } else if (key === "eventLog") {
      const events = diffEvents(current.eventLog, value as GameEvent[]);
      if (events) patch.events = events;
    } else if (!sameValue(value, current[key as keyof GameState])) {
      patch.fields = { ...patch.fields, [key]: value };
    }
  }

  return patch.fields || patch.home || patch.away || patch.events ? patch : null;
}

const countLiveGoals = (eventLog: GameEvent[], side: Side) => getLiveGoals(eventLog).filter((event) => event.team === side).length;

/**
 * Removes one event from the log and keeps the counts in step, so a deleted goal comes off the
 * score, a deleted shot comes off the shots and a deleted penalty comes off the clock.
 */
export function createDeleteEventPatch(state: GameState, eventId: string): GamePatch | null {
  const event = state.eventLog.find((entry) => entry.id === eventId);
  if (!event || event.type === "period_start" || event.type === "period_end") return null;
  const patch: GamePatch = { opId: newOpId(), noLog: true };

  if (event.type === "penalty_added" && event.penaltyId) {
    patch[event.team] = { penalties: { removed: [{ id: event.penaltyId, reason: "deleted" }] } };
    return patch;
  }

  patch.events = { removed: [eventId] };
  if (event.type === "goal" || event.type === "goal_revoked") {
    // Measured from the goals left standing, because a revoke cancels whichever goal it matches.
    const remaining = state.eventLog.filter((entry) => entry.id !== eventId);
    const scoreDelta = countLiveGoals(remaining, event.team) - countLiveGoals(state.eventLog, event.team);
    if (scoreDelta !== 0) patch[event.team] = { scoreDelta };
  } else if (event.type === "shot_on_goal") {
    patch[event.team] = { shotsDelta: -(event.shotDelta ?? 1) };
  }
  return patch;
}

/** Whether Undo should offer this patch. Display settings and period changes aren't undoable. */
export function isUndoable(patch: GamePatch): boolean {
  return Boolean(patch.home || patch.away || patch.events);
}

function invertTeam(patch: TeamPatch, team: TeamState, side: Side, eventLog: GameEvent[], events: EventLogPatch): TeamPatch {
  const inverse: TeamPatch = {};
  if (patch.set) {
    const previous: Partial<TeamState> = {};
    for (const key of Object.keys(patch.set) as (keyof TeamState)[]) Object.assign(previous, { [key]: team[key] });
    inverse.set = previous;
  }
  if (patch.scoreDelta) inverse.scoreDelta = -patch.scoreDelta;
  if (patch.shotsDelta) inverse.shotsDelta = -patch.shotsDelta;

  if (patch.penalties) {
    const penalties: PenaltyPatch = {};
    const penaltyById = new Map(team.penalties.map((penalty) => [penalty.id, penalty]));
    for (const penalty of patch.penalties.added ?? []) {
      (penalties.removed ??= []).push({ id: penalty.id, reason: "deleted" });
    }
    for (const { id, changes } of patch.penalties.updated ?? []) {
      const existing = penaltyById.get(id);
      if (!existing) continue;
      const previous: Partial<Penalty> = {};
      for (const key of Object.keys(changes) as (keyof Penalty)[]) Object.assign(previous, { [key]: existing[key] });
      (penalties.updated ??= []).push({ id, changes: previous });
    }
    for (const { id, reason } of patch.penalties.removed ?? []) {
      // A penalty that's already over has events to restore but isn't on the clock.
      const existing = penaltyById.get(id);
      if (existing) (penalties.added ??= []).push(existing);
      if (reason === "deleted") {
        const logged = eventLog.filter((event) => event.team === side && event.penaltyId === id);
        if (logged.length > 0) (events.added ??= []).push(...logged);
      }
    }
    if (!isEmpty(penalties)) inverse.penalties = penalties;
  }
  return inverse;
}

/** The patch that reverses `patch`, worked out from the state just before it was applied. */
export function invertGamePatch(patch: GamePatch, before: GameState): GamePatch {
  const inverse: GamePatch = { opId: newOpId(), undoOf: patch.opId };
  const events: EventLogPatch = {};

  if (patch.events?.added) events.removed = patch.events.added.map((event) => event.id);
  const removedIds = new Set(patch.events?.removed ?? []);
  if (removedIds.size > 0) events.added = before.eventLog.filter((event) => removedIds.has(event.id));
  for (const { id, changes } of patch.events?.updated ?? []) {
    const existing = before.eventLog.find((event) => event.id === id) as unknown as Record<string, unknown> | undefined;
    if (!existing) continue;
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(changes)) previous[key] = existing[key] ?? null;
    (events.updated ??= []).push({ id, changes: previous });
  }

  for (const side of SIDES) {
    const teamPatch = patch[side];
    if (teamPatch) inverse[side] = invertTeam(teamPatch, before[teamKey(side)], side, before.eventLog, events);
  }
  if (!isEmpty(events)) inverse.events = events;
  return inverse;
}

function applyPenalties(penalties: Penalty[], patch: PenaltyPatch): Penalty[] {
  const removedIds = new Set((patch.removed ?? []).map((removal) => removal.id));
  const changesById = new Map((patch.updated ?? []).map(({ id, changes }) => [id, changes]));
  const kept = penalties
    .filter((penalty) => !removedIds.has(penalty.id))
    .map((penalty) => (changesById.has(penalty.id) ? { ...penalty, ...changesById.get(penalty.id) } : penalty));
  const keptIds = new Set(kept.map((penalty) => penalty.id));
  return [...kept, ...(patch.added ?? []).filter((penalty) => !keptIds.has(penalty.id))];
}

function applyTeam(team: TeamState, patch: TeamPatch): TeamState {
  return {
    ...team,
    ...patch.set,
    score: Math.max(0, team.score + (patch.scoreDelta ?? 0)),
    shots: Math.max(0, team.shots + (patch.shotsDelta ?? 0)),
    penalties: patch.penalties ? applyPenalties(team.penalties, patch.penalties) : team.penalties,
  };
}

function applyEvents(eventLog: GameEvent[], patch: GamePatch): GameEvent[] {
  const removedIds = new Set(patch.events?.removed ?? []);
  const changesById = new Map((patch.events?.updated ?? []).map(({ id, changes }) => [id, changes]));

  const deletedPenalties = new Set<string>();
  for (const side of SIDES) {
    for (const removal of patch[side]?.penalties?.removed ?? []) {
      if (removal.reason === "deleted") deletedPenalties.add(`${side}:${removal.id}`);
    }
  }

  const next = eventLog
    .filter(
      (event) =>
        !removedIds.has(event.id) &&
        !(patch.undoOf && event.opId === patch.undoOf) &&
        !(event.penaltyId && deletedPenalties.has(`${event.team}:${event.penaltyId}`)),
    )
    .map((event) => {
      const changes = changesById.get(event.id);
      if (!changes) return event;
      const edited = { ...event } as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete edited[key];
        else edited[key] = value;
      }
      return edited as unknown as GameEvent;
    });

  const nextIds = new Set(next.map((event) => event.id));
  const added = (patch.events?.added ?? []).filter((event) => !nextIds.has(event.id));
  if (added.length === 0) return next;
  const merged = [...next, ...added];
  // Undo can put back an older event, which belongs where it was and not at the end.
  return patch.undoOf ? merged.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)) : merged;
}

/** Applies a patch's own changes. The server adds the events it logs as a result. */
export function applyGamePatch(state: GameState, patch: GamePatch): GameState {
  return {
    ...state,
    ...patch.fields,
    homeTeam: patch.home ? applyTeam(state.homeTeam, patch.home) : state.homeTeam,
    awayTeam: patch.away ? applyTeam(state.awayTeam, patch.away) : state.awayTeam,
    eventLog: applyEvents(state.eventLog, patch),
  };
}
