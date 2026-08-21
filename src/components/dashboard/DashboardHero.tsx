import { Radio, Zap, MonitorPlay, Share2 } from "lucide-react";
import { glassInsetClass } from "../control-panel/ui/glass";

export default function DashboardHero() {
  return (
    <div className={`p-5 flex items-start gap-4 ${glassInsetClass}`}>
      <div className="w-11 h-11 rounded-full bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-400">
        <Radio size={20} />
      </div>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-white">Hockey Scoreboard</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Live game control for ice hockey broadcasts — score, clock, and penalties sync instantly to
          your stream overlay, jumbotron display, and shareable viewer links.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs font-medium text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Zap size={13} className="text-amber-400" /> Live overlay
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MonitorPlay size={13} className="text-indigo-400" /> Jumbotron
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Share2 size={13} className="text-emerald-400" /> Shareable links
          </span>
        </div>
      </div>
    </div>
  );
}
