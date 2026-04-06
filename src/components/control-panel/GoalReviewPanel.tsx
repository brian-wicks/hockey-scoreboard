import { GameEvent, GameState, TeamPlayer } from "../../store";
import { toSkaterLabel } from "../../utils/roster";
import { SearchDropdownInput, SearchOption } from "./DropdownInputs";
import { UpdateGameState } from "./types";

interface GoalReviewPanelProps {
  team: "home" | "away";
  gameState: GameState;
  eventLog: GameEvent[];
  rosterPlayers: TeamPlayer[];
  updateState: UpdateGameState;
  className?: string;
}

function parseClockSeconds(clockTime: string) {
  const [minPart, secPart] = clockTime.split(":");
  const minutes = Number(minPart);
  const seconds = Number(secPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

export default function GoalReviewPanel({
  team,
  gameState,
  eventLog,
  rosterPlayers,
  updateState,
  className = "",
}: GoalReviewPanelProps) {
  const skaterOptions: SearchOption[] = Array.from(
    new Map(
      rosterPlayers
        .map((player) => ({ value: toSkaterLabel(player), label: "" }))
        .filter((option) => option.value.length > 0)
        .map((option) => [option.value, option]),
    ).values(),
  );

  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    const nextLog = eventLog.map((event) => (event.id === id ? { ...event, ...updates } : event));
    updateState({ eventLog: nextLog });
  };

  const currentClockSeconds = Math.max(0, Math.floor(gameState.clock.timeRemaining / 1000));
  const nowMs = typeof gameState.serverTime === "number" ? gameState.serverTime : Date.now();

  const goalReviewItems = eventLog.filter((event) => {
    if (event.type !== "goal" || event.team !== team) return false;
    const scorerMissing = !(event.scorer ?? "").trim();
    const clockSeconds = parseClockSeconds(event.clockTime ?? "");
    const isRecentGoal =
      event.period === gameState.period &&
      typeof clockSeconds === "number" &&
      clockSeconds >= currentClockSeconds &&
      clockSeconds - currentClockSeconds <= 120;
    return scorerMissing || isRecentGoal;
  });

  if (goalReviewItems.length === 0) return null;

  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-3 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-zinc-300 uppercase tracking-wider text-sm font-semibold">Goal Review</span>
      </div>
      <div className="flex flex-col gap-3">
        {goalReviewItems.map((event) => (
          <div key={event.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            {(() => {
              const activeHighlight = gameState.jumbotronGoalHighlight;
              const scorer = (event.scorer ?? "").trim();
              const assist1 = (event.assist1 ?? "").trim();
              const assist2 = (event.assist2 ?? "").trim();
              const isActive =
                activeHighlight &&
                activeHighlight.team === event.team &&
                activeHighlight.scorer === scorer &&
                (activeHighlight.assist1 ?? "") === assist1 &&
                (activeHighlight.assist2 ?? "") === assist2 &&
                nowMs < activeHighlight.expiresAt;
              return (
                <>
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>{event.period}</span>
              <span>{event.clockTime}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <SearchDropdownInput
                value={event.scorer ?? ""}
                onChange={(nextValue) => updateEvent(event.id, { scorer: nextValue })}
                inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                placeholder="Scorer"
                options={skaterOptions}
              />
              <SearchDropdownInput
                value={event.assist1 ?? ""}
                onChange={(nextValue) => updateEvent(event.id, { assist1: nextValue })}
                inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                placeholder="Assist 1"
                options={skaterOptions}
              />
              <SearchDropdownInput
                value={event.assist2 ?? ""}
                onChange={(nextValue) => updateEvent(event.id, { assist2: nextValue })}
                inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                placeholder="Assist 2"
                options={skaterOptions}
              />
              {isActive ? (
                <button
                  type="button"
                  onClick={() => updateState({ jumbotronGoalHighlight: null })}
                  className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-semibold text-white transition-colors"
                >
                  Hide from Jumbotron
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!scorer) return;
                  updateState({
                    jumbotronGoalHighlight: {
                      team: event.team,
                      scorer,
                      assist1,
                      assist2,
                      expiresAt: nowMs + 15_000,
                    },
                  });
                }}
                disabled={!scorer}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-lg text-sm font-semibold text-white transition-colors"
              >
                  Show on Jumbotron (15s)
              </button>
              )}
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
