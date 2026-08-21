import { PlayCircle } from "lucide-react";
import { GameState } from "../../store";
import { isGameInProgress } from "../../utils/gameProgress";
import { formatClockDisplay } from "../../utils/clock";
import { GlassButton, glassInsetClass } from "../control-panel/ui/glass";

interface ResumeGameCardProps {
  gameState: GameState;
  onResume: () => void;
}

export default function ResumeGameCard({ gameState, onResume }: ResumeGameCardProps) {
  const inProgress = isGameInProgress(gameState);
  const { homeTeam, awayTeam, clock, period } = gameState;

  return (
    <div className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${glassInsetClass}`}>
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            inProgress ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-zinc-500"
          }`}
        >
          <PlayCircle size={22} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {homeTeam.name || "Home"} {homeTeam.score} &ndash; {awayTeam.score} {awayTeam.name || "Away"}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {inProgress ? (
              <>
                {period} &middot; {formatClockDisplay(clock.timeRemaining)}
                {clock.isRunning ? " · Running" : ""}
              </>
            ) : (
              "Not started yet"
            )}
          </div>
        </div>
      </div>
      <GlassButton onClick={onResume} variant={inProgress ? "primary" : "secondary"} className="shrink-0">
        {inProgress ? "Resume Game" : "Open Control Panel"}
      </GlassButton>
    </div>
  );
}
