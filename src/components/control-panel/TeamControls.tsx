import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { TeamState } from "../../store";
import { UpdateGameState } from "./types";
import PenaltyItem from "./PenaltyItem";

interface TeamControlsProps {
  team: "home" | "away";
  state: TeamState;
  updateState: UpdateGameState;
}

export default function TeamControls({ team, state, updateState }: TeamControlsProps) {
  const [focusPenaltyId, setFocusPenaltyId] = useState<string | null>(null);
  const previousPenaltyCountRef = useRef(state.penalties.length);
  const rosterPlayers = state.players ?? [];

  const updateTeam = (updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...state, ...updates } });
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
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
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
            onClick={() => updateTeam({ shots: Math.max(0, state.shots - 1) })}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Minus size={20} />
          </button>
          <span className="text-3xl font-mono font-bold w-12 text-center">{state.shots}</span>
          <button
            onClick={() => updateTeam({ shots: state.shots + 1 })}
            className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
          >
            <Plus size={20} />
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
