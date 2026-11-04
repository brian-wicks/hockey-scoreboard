import { useEffect, useRef, useState } from "react";
import { ChevronRight, Play, Square } from "lucide-react";
import { ClockState, useStore } from "../../store";
import { useClockDisplay } from "../../hooks/useClockDisplay";
import { parseTimeInputMs } from "../../utils/clock";
import { getNextPeriod, transitionToPeriod } from "../../utils/period";
import { UpdateGameState } from "./types";
import { Button, Panel } from "./ui/primitives";

// How long the next-period button ignores clicks after the clock runs out. It appears
// where Stop was, and a Stop click that lands late shouldn't skip to the next period.
const NEXT_PERIOD_ARM_DELAY_MS = 1000;

interface ClockControlProps {
  clock: ClockState;
  period: string;
  startClock: () => void;
  stopClock: () => void;
  setClock: (timeMs: number) => void;
  updateState: UpdateGameState;
  serverTimeOffsetMs: number;
}

export default function ClockControl({
  clock,
  period,
  startClock,
  stopClock,
  setClock,
  updateState,
  serverTimeOffsetMs,
}: ClockControlProps) {
  const displayTime = useClockDisplay(clock, serverTimeOffsetMs);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("20:00");

  const nextPeriod = getNextPeriod(period);
  const clockExpired = !clock.isRunning && clock.timeRemaining <= 0;

  const wasRunningRef = useRef(clock.isRunning);
  const [nextPeriodArmed, setNextPeriodArmed] = useState(true);

  useEffect(() => {
    const justExpired = clockExpired && wasRunningRef.current;
    wasRunningRef.current = clock.isRunning;
    if (!justExpired) return;
    setNextPeriodArmed(false);
    const timer = setTimeout(() => setNextPeriodArmed(true), NEXT_PERIOD_ARM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [clock.isRunning, clockExpired]);

  const goToNextPeriod = () => {
    const gameState = useStore.getState().gameState;
    if (!gameState || !nextPeriod) return;
    transitionToPeriod(gameState, period, nextPeriod, updateState, setClock);
  };

  const handleSetClock = () => {
    const timeMs = parseTimeInputMs(editValue);
    if (timeMs !== null) {
      setClock(timeMs);
    }
    setEditMode(false);
  };

  return (
    <Panel className="flex flex-col items-center justify-center gap-5">
      <div className="text-sm font-semibold">{period} period</div>

      {editMode ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="text-7xl font-mono font-semibold tracking-tight leading-none h-[72px] box-content p-0 bg-canvas text-ink w-56 max-w-full text-center rounded-sm border border-ink"
          autoFocus
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === "Enter" && handleSetClock()}
          onBlur={handleSetClock}
        />
      ) : (
        <button
          type="button"
          disabled={clock.isRunning}
          title={clock.isRunning ? undefined : "Click to set the clock"}
          className="text-7xl font-mono font-semibold tracking-tight leading-none border border-transparent rounded-sm enabled:hover:border-line"
          onClick={() => {
            const totalSeconds = Math.ceil(clock.timeRemaining / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            setEditValue(`${minutes}:${seconds.toString().padStart(2, "0")}`);
            setEditMode(true);
          }}
        >
          {displayTime}
        </button>
      )}

      <div className="flex gap-4 w-full">
        {clock.isRunning ? (
          <Button onClick={stopClock} variant="destructive" className="flex-1 py-4 text-lg">
            <Square fill="currentColor" size={20} /> Stop
          </Button>
        ) : clockExpired && nextPeriod ? (
          <Button
            onClick={goToNextPeriod}
            disabled={!nextPeriodArmed}
            variant="primary"
            className="flex-1 py-4 text-lg"
          >
            {nextPeriod === "OT" ? "Go to overtime" : `Go to ${nextPeriod} period`}
            <ChevronRight size={20} />
          </Button>
        ) : (
          <Button
            onClick={startClock}
            disabled={clock.timeRemaining <= 0}
            variant="primary"
            className="flex-1 py-4 text-lg"
          >
            <Play fill="currentColor" size={20} /> Start
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <Button onClick={() => setClock(20 * 60 * 1000)} variant="secondary" className="py-2">
          Reset 20:00
        </Button>
        <Button onClick={() => setClock(5 * 60 * 1000)} variant="secondary" className="py-2">
          Reset 5:00
        </Button>
      </div>
    </Panel>
  );
}
