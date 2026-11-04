import { memo } from "react";
import { useStore } from "../../store";
import { transitionToPeriod } from "../../utils/period";
import { UpdateGameState } from "./types";
import { Button, Panel, SectionLabel } from "./ui/primitives";

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

  const periodButton = (id: string, label: string) => (
    <Button
      onClick={() => updatePeriod(id)}
      aria-pressed={period === id}
      className={`p-3 ${period === id ? "bg-ink hover:bg-ink text-canvas border-ink" : ""}`}
    >
      {label}
    </Button>
  );

  return (
    <Panel>
      <SectionLabel className="mb-3">Period</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {periodButton("1st", "1st Period")}
        {periodButton("2nd", "2nd Period")}
        {periodButton("3rd", "3rd Period")}
        {periodButton("OT", "Overtime")}
      </div>
    </Panel>
  );
}

export default memo(GameActionsPanel);
