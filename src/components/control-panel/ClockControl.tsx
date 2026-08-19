import { useState } from "react";
import { Play, Square } from "lucide-react";
import { ClockState } from "../../store";
import { useClockDisplay } from "../../hooks/useClockDisplay";
import { parseTimeInputMs } from "../../utils/clock";
import { GlassButton, GlassPanel } from "./ui/glass";

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
  const displayTime = useClockDisplay(clock, serverTimeOffsetMs);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("20:00");

  const handleSetClock = () => {
    const timeMs = parseTimeInputMs(editValue);
    if (timeMs !== null) {
      setClock(timeMs);
    }
    setEditMode(false);
  };

  return (
    <GlassPanel className="flex flex-col items-center justify-center gap-6">
      <div className="text-zinc-400 uppercase tracking-widest text-sm font-bold">{period} PERIOD</div>

      {editMode ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="text-6xl font-mono font-bold bg-white/[0.05] text-white w-48 text-center rounded-xl border border-white/10 focus:border-indigo-400/60 focus:outline-none"
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
          <GlassButton onClick={stopClock} variant="destructive" className="flex-1 py-4 text-lg font-bold">
            <Square fill="currentColor" size={20} /> STOP
          </GlassButton>
        ) : (
          <GlassButton
            onClick={startClock}
            disabled={clock.timeRemaining <= 0}
            variant="success"
            className="flex-1 py-4 text-lg font-bold"
          >
            <Play fill="currentColor" size={20} /> START
          </GlassButton>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        <GlassButton onClick={() => setClock(20 * 60 * 1000)} variant="secondary" className="py-2">
          Reset 20:00
        </GlassButton>
        <GlassButton onClick={() => setClock(5 * 60 * 1000)} variant="secondary" className="py-2">
          Reset 5:00
        </GlassButton>
      </div>
    </GlassPanel>
  );
}
