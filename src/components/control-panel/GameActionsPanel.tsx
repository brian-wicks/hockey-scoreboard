import { GameState } from "../../store";
import { buildPeriodEndEvent } from "../../utils/eventLog";
import { UpdateGameState } from "./types";

interface GameActionsPanelProps {
  period: string;
  gameState?: GameState;
  updateState: UpdateGameState;
}

export default function GameActionsPanel({ period, gameState, updateState }: GameActionsPanelProps) {
  const updatePeriod = (nextPeriod: string) => {
    if (gameState && period && period !== nextPeriod) {
      const endEvent = buildPeriodEndEvent(gameState, period);
      updateState({ period: nextPeriod, eventLog: [...gameState.eventLog, endEvent] });
    } else {
      updateState({ period: nextPeriod });
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-zinc-300 uppercase tracking-wider">Game Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => updatePeriod("1st")}
          className={`p-3 rounded-lg font-medium ${period === "1st" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          1st Period
        </button>
        <button
          onClick={() => updatePeriod("2nd")}
          className={`p-3 rounded-lg font-medium ${period === "2nd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          2nd Period
        </button>
        <button
          onClick={() => updatePeriod("3rd")}
          className={`p-3 rounded-lg font-medium ${period === "3rd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          3rd Period
        </button>
        <button
          onClick={() => updatePeriod("OT")}
          className={`p-3 rounded-lg font-medium ${period === "OT" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          Overtime
        </button>
      </div>
    </div>
  );
}
