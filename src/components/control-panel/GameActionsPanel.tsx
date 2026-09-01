import { memo } from "react";
import { useStore } from "../../store";
import { transitionToPeriod } from "../../utils/period";
import { UpdateGameState } from "./types";
import { GlassPanel, SectionLabel } from "./ui/glass";

interface GameActionsPanelProps {
  period: string;
  updateState: UpdateGameState;
  setClock: (timeMs: number) => void;
}

// period/updateState/setClock are the only props this needs to render — gameState
// is read imperatively below, only at click time, so it deliberately isn't a prop.
// That keeps this panel's props stable across the clock's ~10x/sec ticks (which
// replace gameState with a new object graph every time but never touch period),
// so memo actually skips re-rendering instead of always missing on prop identity.
function GameActionsPanel({ period, updateState, setClock }: GameActionsPanelProps) {
  const updatePeriod = (nextPeriod: string) => {
    const gameState = useStore.getState().gameState;
    if (!gameState) return;
    transitionToPeriod(gameState, period, nextPeriod, updateState, setClock);
  };

  const periodButtonClass = (isActive: boolean) =>
    `p-3 rounded-xl font-medium border transition-colors ${
      isActive
        ? "bg-indigo-500/80 border-indigo-400/40 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]"
        : "bg-white/[0.06] hover:bg-white/[0.1] border-white/10 text-zinc-100"
    }`;

  return (
    <GlassPanel>
      <SectionLabel className="mb-4 text-base text-zinc-300">
        Game Actions
      </SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => updatePeriod("1st")} className={periodButtonClass(period === "1st")}>
          1st Period
        </button>
        <button onClick={() => updatePeriod("2nd")} className={periodButtonClass(period === "2nd")}>
          2nd Period
        </button>
        <button onClick={() => updatePeriod("3rd")} className={periodButtonClass(period === "3rd")}>
          3rd Period
        </button>
        <button onClick={() => updatePeriod("OT")} className={periodButtonClass(period === "OT")}>
          Overtime
        </button>
      </div>
    </GlassPanel>
  );
}

export default memo(GameActionsPanel);
