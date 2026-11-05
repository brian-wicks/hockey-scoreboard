import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { GameState, TeamState, useStore } from "../../store";
import { buildGoalieChangeEvent, buildShotEvent } from "../../utils/eventLog";
import { createBlankPenalty } from "../../utils/penalty";
import { UpdateGameState } from "./types";
import GoalReviewPanel from "./GoalReviewPanel";
import PenaltyItem from "./PenaltyItem";
import { SearchDropdownInput, SearchOption } from "./DropdownInputs";
import { Button, Panel, SectionLabel, inputClass } from "./ui/primitives";

interface TeamControlsProps {
  team: "home" | "away";
  state: TeamState;
  updateState: UpdateGameState;
  eventLog: GameState["eventLog"];
}

// gameState is sourced here (rather than threaded down from ControlPanel as a
// prop) because GoalReviewPanel below is the only thing under this component
// that actually needs it reactively — everything else here only reads it inside
// click handlers.
export default function TeamControls({ team, state, eventLog, updateState }: TeamControlsProps) {
  const gameState = useStore((s) => s.gameState);
  const [focusPenaltyId, setFocusPenaltyId] = useState<string | null>(null);
  const [goalieValue, setGoalieValue] = useState("");
  const previousPenaltyCountRef = useRef(state.penalties.length);
  const rosterPlayers = state.players ?? [];

  useEffect(() => {
    const previousPenaltyCount = previousPenaltyCountRef.current;
    if (state.penalties.length > previousPenaltyCount) {
      const newestPenalty = state.penalties[state.penalties.length - 1];
      if (newestPenalty) {
        setFocusPenaltyId(newestPenalty.id);
      }
    }
    previousPenaltyCountRef.current = state.penalties.length;
  }, [state.penalties]);

  // Never actually null in practice — ControlPanel doesn't render this component
  // until gameState is loaded — but the store types it as nullable, so narrow it
  // once here (before the closures below, which all reference gameState) rather
  // than re-checking in every handler.
  if (!gameState) return null;

  const sideLabel = team === "home" ? "Home" : "Away";

  const updateTeam = (updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...state, ...updates } });
  };

  const goalieOptions: SearchOption[] = rosterPlayers
    .map((player) => ({
      value: player.jerseyNumber.trim(),
      label: player.position !== "" ? `${player.name.trim()} (${player.position})` : `${player.name.trim()}`,
    }))
    .filter((option) => option.value.length > 0);

  const appendEventLog = (event: any) => {
    updateState({ eventLog: [...eventLog, event] });
  };

  const logGoalieChange = () => {
    const nextGoalie = goalieValue.trim();
    if (!nextGoalie) return;
    const event = buildGoalieChangeEvent(gameState, team, nextGoalie);
    appendEventLog(event);
  };

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 pb-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {state.logo && <img src={state.logo} alt={state.abbreviation} className="h-8 w-8 shrink-0 object-contain" />}
            <h2 className="text-2xl font-semibold text-ink truncate" title={state.name}>{state.name}</h2>
          </div>
          <span className="text-sm text-muted shrink-0">{state.abbreviation}</span>
        </div>
        <div className="h-1 outline outline-1 outline-line" style={{ backgroundColor: state.color }} />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Score</SectionLabel>
        <div className="flex items-center justify-between">
          <Button
            onClick={() => updateTeam({ score: Math.max(0, state.score - 1) })}
            variant="secondary"
            className="w-12 h-12 p-0"
            aria-label={`${sideLabel} score -1`}
          >
            <Minus size={24} />
          </Button>
          <span className="text-5xl tabular-nums font-semibold w-20 text-center">{state.score}</span>
          <Button
            onClick={() => updateTeam({ score: state.score + 1 })}
            variant="secondary"
            className="w-12 h-12 p-0"
            aria-label={`${sideLabel} score +1`}
          >
            <Plus size={24} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Shots</SectionLabel>
        <div className="flex items-center justify-between">
          <Button
            onClick={() => {
              const nextShots = Math.max(0, state.shots - 1);
              if (nextShots !== state.shots) {
                const event = buildShotEvent(gameState, team, -1);
                updateState({ [`${team}Team`]: { ...state, shots: nextShots }, eventLog: [...eventLog, event] });
              }
            }}
            variant="secondary"
            className="w-10 h-10 p-0"
            aria-label={`${sideLabel} shots -1`}
          >
            <Minus size={20} />
          </Button>
          <span className="text-3xl tabular-nums font-semibold w-16 text-center">{state.shots}</span>
          <Button
            onClick={() => {
              const event = buildShotEvent(gameState, team, 1);
              updateState({ [`${team}Team`]: { ...state, shots: state.shots + 1 }, eventLog: [...eventLog, event] });
            }}
            variant="secondary"
            className="w-10 h-10 p-0"
            aria-label={`${sideLabel} shots +1`}
          >
            <Plus size={20} />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel>Goalie</SectionLabel>
        <div className="flex items-center gap-2">
          <SearchDropdownInput
            value={goalieValue}
            onChange={setGoalieValue}
            inputClassName={`${inputClass} w-full`}
            containerClassName="relative flex-1 min-w-0"
            placeholder="Goalie #"
            options={goalieOptions}
          />
          <Button type="button" onClick={logGoalieChange} variant="secondary">
            Set
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-line">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Penalties</SectionLabel>
          <Button
            onClick={() => updateTeam({ penalties: [...state.penalties, createBlankPenalty()] })}
            variant="secondary"
            className="px-3 py-1.5 text-sm"
          >
            <Plus size={16} /> Add
          </Button>
        </div>
        <div className="flex flex-col">
          {state.penalties.map((p, i) => (
            <PenaltyItem
              key={p.id}
              penalty={p}
              onChange={(updated) => {
                const newPenalties = [...state.penalties];
                newPenalties[i] = updated;
                updateTeam({ penalties: newPenalties });
              }}
              onEndEarly={() => {
                updateTeam({ penalties: state.penalties.filter((_, index) => index !== i) });
              }}
              autoFocusPlayer={p.id === focusPenaltyId}
              onAutoFocusHandled={() => setFocusPenaltyId((current) => (current === p.id ? null : current))}
              rosterPlayers={rosterPlayers}
            />
          ))}
          {state.penalties.length === 0 && (
            <div className="text-muted text-sm py-2">No active penalties</div>
          )}
        </div>
      </div>
      <GoalReviewPanel
        team={team}
        gameState={gameState}
        eventLog={eventLog}
        rosterPlayers={rosterPlayers}
        updateState={updateState}
        className={`p-0 border-0 min-[1840px]:p-3 min-[1840px]:border min-[1840px]:absolute min-[1840px]:top-0 ${
          team === "home" ? "min-[1840px]:-left-[240px]" : "min-[1840px]:-right-[240px]"
        } min-[1840px]:w-[220px]`}
      />
    </Panel>
  );
}
