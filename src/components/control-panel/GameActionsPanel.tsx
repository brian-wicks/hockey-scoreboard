import { UpdateGameState } from "./types";

interface GameActionsPanelProps {
  period: string;
  updateState: UpdateGameState;
}

export default function GameActionsPanel({ period, updateState }: GameActionsPanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4 text-zinc-300 uppercase tracking-wider">Game Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => updateState({ period: "1st" })}
          className={`p-3 rounded-lg font-medium ${period === "1st" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          1st Period
        </button>
        <button
          onClick={() => updateState({ period: "2nd" })}
          className={`p-3 rounded-lg font-medium ${period === "2nd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          2nd Period
        </button>
        <button
          onClick={() => updateState({ period: "3rd" })}
          className={`p-3 rounded-lg font-medium ${period === "3rd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          3rd Period
        </button>
        <button
          onClick={() => updateState({ period: "OT" })}
          className={`p-3 rounded-lg font-medium ${period === "OT" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
        >
          Overtime
        </button>
      </div>
    </div>
  );
}
