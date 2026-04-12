import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { GameState, TeamState } from "../../store";
import { buildGoalieChangeEvent, buildShotEvent } from "../../utils/eventLog";
import { UpdateGameState } from "./types";
import GoalReviewPanel from "./GoalReviewPanel";
import PenaltyItem from "./PenaltyItem";
import { SearchDropdownInput, SearchOption } from "./DropdownInputs";

interface TeamControlsProps {
  team: "home" | "away";
  state: TeamState;
  gameState: GameState;
  updateState: UpdateGameState;
  eventLog: GameState["eventLog"];
}

export default function TeamControls({ team, state, gameState, eventLog, updateState }: TeamControlsProps) {
  const [focusPenaltyId, setFocusPenaltyId] = useState<string | null>(null);
  const [goalieValue, setGoalieValue] = useState("");
  const previousPenaltyCountRef = useRef(state.penalties.length);
  const rosterPlayers = state.players ?? [];

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

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6 relative">
      <GoalReviewPanel
        team={team}
        gameState={gameState}
        eventLog={eventLog}
        rosterPlayers={rosterPlayers}
        updateState={updateState}
        className={`min-[1200px]:absolute min-[1200px]:top-0 ${
          team === "home" ? "min-[1200px]:-left-[240px]" : "min-[1200px]:-right-[240px]"
        } min-[1200px]:w-[220px]`}
      />
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-10 rounded-full" style={{ backgroundColor: state.color }} />
          {state.logo && <img src={state.logo} alt={state.abbreviation} className="h-8 w-8 object-contain" />}
          <h2 className="text-2xl font-bold text-zinc-100">{state.name}</h2>
        </div>
        <span className="text-zinc-500 font-mono">{state.abbreviation}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Score</span>
        <div className="flex items-center justify-between">
          <button
            onClick={() => updateTeam({ score: Math.max(0, state.score - 1) })}
            className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Minus size={24} />
          </button>
          <span className="text-5xl font-mono font-bold w-16 text-center">{state.score}</span>
          <button
            onClick={() => updateTeam({ score: state.score + 1 })}
            className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Shots</span>
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const nextShots = Math.max(0, state.shots - 1);
              if (nextShots !== state.shots) {
                const event = buildShotEvent(gameState, team, -1);
                updateState({ [`${team}Team`]: { ...state, shots: nextShots }, eventLog: [...eventLog, event] });
              }
            }}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Minus size={20} />
          </button>
          <span className="text-3xl font-mono font-bold w-12 text-center">{state.shots}</span>
          <button
            onClick={() => {
              const event = buildShotEvent(gameState, team, 1);
              updateState({ [`${team}Team`]: { ...state, shots: state.shots + 1 }, eventLog: [...eventLog, event] });
            }}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Goalie</span>
        <div className="flex items-center gap-2">
          <SearchDropdownInput
            value={goalieValue}
            onChange={setGoalieValue}
            inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
            placeholder="Goalie #"
            options={goalieOptions}
          />
          <button
            type="button"
            onClick={logGoalieChange}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-200"
          >
            Set
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Penalties</span>
          <button
            onClick={() => {
              const newPenalty = {
                id: Math.random().toString(36).slice(2, 11),
                playerNumber: "",
                timeRemaining: 120000,
                duration: 120000,
                infraction: "",
              };
              updateTeam({ penalties: [...state.penalties, newPenalty] });
            }}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium flex items-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.penalties.map((p, i) => (
            <PenaltyItem
              key={p.id}
              penalty={p}
              onChange={(updated) => {
                const newPenalties = [...state.penalties];
                newPenalties[i] = updated;
                updateTeam({ penalties: newPenalties });
              }}
              onRemove={() => {
                const newPenalties = state.penalties.filter((_, index) => index !== i);
                updateTeam({ penalties: newPenalties });
              }}
              autoFocusPlayer={p.id === focusPenaltyId}
              onAutoFocusHandled={() => setFocusPenaltyId((current) => (current === p.id ? null : current))}
              rosterPlayers={rosterPlayers}
            />
          ))}
          {state.penalties.length === 0 && (
            <div className="text-center text-zinc-600 text-sm py-4 italic">No active penalties</div>
          )}
        </div>
      </div>
    </div>
  );
}
