import { GameEvent, GameState, TeamPlayer } from "../../store";
import { toSkaterLabel } from "../../utils/roster";
import { SearchDropdownInput, SearchOption } from "./DropdownInputs";
import { UpdateGameState } from "./types";
import { GlassButton, GlassPanel, SectionLabel, glassInputClass, glassInsetClass } from "./ui/glass";

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
    <GlassPanel className={`p-3 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Goal Review</SectionLabel>
      </div>
      <div className="flex flex-col gap-3">
        {goalReviewItems.map((event) => (
          <div key={event.id} className={`p-3 ${glassInsetClass}`}>
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
                inputClassName={`${glassInputClass} w-full`}
                placeholder="Scorer"
                options={skaterOptions}
              />
              <SearchDropdownInput
                value={event.assist1 ?? ""}
                onChange={(nextValue) => updateEvent(event.id, { assist1: nextValue })}
                inputClassName={`${glassInputClass} w-full`}
                placeholder="Assist 1"
                options={skaterOptions}
              />
              <SearchDropdownInput
                value={event.assist2 ?? ""}
                onChange={(nextValue) => updateEvent(event.id, { assist2: nextValue })}
                inputClassName={`${glassInputClass} w-full`}
                placeholder="Assist 2"
                options={skaterOptions}
              />
              {isActive ? (
                <GlassButton
                  type="button"
                  onClick={() =>
                    updateState({
                      jumbotronGoalHighlight: null,
                      lowerThird: {
                        active: false,
                        title: gameState.lowerThird?.title ?? "",
                        subtitle: gameState.lowerThird?.subtitle,
                      },
                    })
                  }
                  variant="secondary"
                  className="font-semibold"
                >
                  Hide from Jumbotron
                </GlassButton>
              ) : (
                <GlassButton
                  type="button"
                  onClick={() => {
                    if (!scorer) return;
                    const teamName =
                      event.team === "home" ? gameState.homeTeam.name : gameState.awayTeam.name;
                    const assistText = [assist1, assist2].filter(Boolean).join(", ");
                    const subtitle = assistText
                      ? `${scorer} | Assists: ${assistText}`
                      : `${scorer}`;
                    updateState({
                      jumbotronGoalHighlight: {
                        team: event.team,
                        scorer,
                        assist1,
                        assist2,
                        expiresAt: nowMs + 15_000,
                      },
                      lowerThird: {
                        active: true,
                        title: `${teamName || "Goal"} GOAL`,
                        subtitle,
                      },
                    });
                  }}
                disabled={!scorer}
                variant="success"
                className="font-semibold"
              >
                  Show on Jumbotron (15s)
              </GlassButton>
              )}
            </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
