import { useEffect, useState } from "react";
import { Play, Square } from "lucide-react";
import { ClockState } from "../../store";
import { formatClockDisplay, parseTimeInputMs } from "../../utils/clock";

interface ClockControlProps {
  clock: ClockState;
  period: string;
  startClock: () => void;
  stopClock: () => void;
  setClock: (timeMs: number) => void;
  serverTimeOffsetMs: number;
}

export default function ClockControl({
  clock,
  period,
  startClock,
  stopClock,
  setClock,
  serverTimeOffsetMs,
}: ClockControlProps) {
  const [displayTime, setDisplayTime] = useState("20:00");
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("20:00");

  useEffect(() => {
    let animationFrameId: number;

    const updateDisplay = () => {
      let currentRemaining = clock.timeRemaining;
      if (clock.isRunning) {
        const now = Date.now() + (serverTimeOffsetMs ?? 0);
        const elapsed = now - clock.lastUpdate;
        currentRemaining = Math.max(0, clock.timeRemaining - elapsed);
      }

      setDisplayTime(formatClockDisplay(currentRemaining));

      if (clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [clock.isRunning, clock.timeRemaining, clock.lastUpdate, serverTimeOffsetMs]);

  const handleSetClock = () => {
    const timeMs = parseTimeInputMs(editValue);
    if (timeMs !== null) {
      setClock(timeMs);
    }
    setEditMode(false);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center gap-6">
      <div className="text-zinc-400 uppercase tracking-widest text-sm font-bold">{period} PERIOD</div>

      {editMode ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="text-6xl font-mono font-bold bg-zinc-950 text-white w-48 text-center rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
            autoFocus
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === "Enter" && handleSetClock()}
            onBlur={handleSetClock}
          />
        </div>
      ) : (
        <div
          className="text-7xl font-mono font-bold tracking-tighter cursor-pointer hover:text-indigo-400 transition-colors"
          onClick={() => {
            if (!clock.isRunning) {
              const totalSeconds = Math.ceil(clock.timeRemaining / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              setEditValue(`${minutes}:${seconds.toString().padStart(2, "0")}`);
              setEditMode(true);
            }
          }}
        >
          {displayTime}
        </div>
      )}

      <div className="flex gap-4 w-full">
        {clock.isRunning ? (
          <button
            onClick={stopClock}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg transition-colors"
          >
            <Square fill="currentColor" size={20} /> STOP
          </button>
        ) : (
          <button
            onClick={startClock}
            disabled={clock.timeRemaining <= 0}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:text-emerald-200/60 text-white rounded-xl font-bold text-lg transition-colors"
          >
            <Play fill="currentColor" size={20} /> START
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <button
          onClick={() => setClock(20 * 60 * 1000)}
          className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium"
        >
          Reset 20:00
        </button>
        <button
          onClick={() => setClock(5 * 60 * 1000)}
          className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium"
        >
          Reset 5:00
        </button>
      </div>
    </div>
  );
}
