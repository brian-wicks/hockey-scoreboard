import { GameState } from "../../store";
import { buildPeriodEndEvent } from "../../utils/eventLog";
import { UpdateGameState } from "./types";
import { GlassPanel, SectionLabel } from "./ui/glass";

interface GameActionsPanelProps {
  period: string;
  gameState?: GameState;
  updateState: UpdateGameState;
  setClock: (timeMs: number) => void;
}

const PERIOD_CLOCKS_MS: Record<string, number> = {
  "1st": 20 * 60 * 1000,
  "2nd": 20 * 60 * 1000,
  "3rd": 20 * 60 * 1000,
  OT: 5 * 60 * 1000,
};

export default function GameActionsPanel({ period, gameState, updateState, setClock }: GameActionsPanelProps) {
  const updatePeriod = (nextPeriod: string) => {
    if (gameState && period && period !== nextPeriod) {
      const lastEvent = gameState.eventLog[gameState.eventLog.length - 1];
      const alreadyEnded =
        (gameState.clock.timeRemaining ?? 0) <= 0 ||
        (lastEvent?.type === "period_end" && lastEvent.period === period);
      if (alreadyEnded) {
        updateState({ period: nextPeriod });
      } else {
        const endEvent = buildPeriodEndEvent(gameState, period);
        updateState({ period: nextPeriod, eventLog: [...gameState.eventLog, endEvent] });
      }
    } else {
      updateState({ period: nextPeriod });
    }
    const nextClock = PERIOD_CLOCKS_MS[nextPeriod];
    if (typeof nextClock === "number") {
      setClock(nextClock);
    }
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
