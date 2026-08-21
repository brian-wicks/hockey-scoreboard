import { ReactNode, useState } from "react";
import { Trash2 } from "lucide-react";
import { SavedTeam } from "../../store";
import { GlassButton, glassInsetClass } from "../control-panel/ui/glass";

interface TeamLibraryCardProps {
  entry: SavedTeam;
  onDeleteRequest: () => void;
  actions: ReactNode;
}

export default function TeamLibraryCard({ entry, onDeleteRequest, actions }: TeamLibraryCardProps) {
  const [rosterExpanded, setRosterExpanded] = useState(false);

  return (
    <div className={`p-4 flex flex-col gap-4 relative ${glassInsetClass}`}>
      <button
        type="button"
        onClick={onDeleteRequest}
        className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-500/10"
        aria-label={`Delete preset ${entry.name}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <div className="flex flex-col items-center gap-2">
        <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
          {entry.team.logo ? (
            <img src={entry.team.logo} alt={entry.team.abbreviation} className="h-20 w-20 object-contain" />
          ) : (
            <span className="text-sm font-bold text-zinc-400">{entry.team.abbreviation}</span>
          )}
        </div>
        <div className="font-semibold text-zinc-100 text-center">{entry.team.name}</div>
        <span className="text-xs font-mono text-zinc-400">{entry.team.abbreviation}</span>
      </div>
      {actions}
      <GlassButton
        type="button"
        onClick={() => setRosterExpanded((prev) => !prev)}
        variant="ghost"
        className="w-full text-xs border border-white/10"
      >
        {rosterExpanded ? "Hide Roster" : `Show Roster (${entry.team.players?.length ?? 0})`}
      </GlassButton>
      {rosterExpanded && (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          {(entry.team.players ?? []).length === 0 ? (
            <div className="text-xs text-zinc-500 italic">No players saved for this team.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(entry.team.players ?? []).map((player) => (
                <div key={player.id} className="grid grid-cols-[42px_1fr_30px] gap-2 text-xs text-zinc-300 items-center">
                  <span className="font-mono text-zinc-400">{player.jerseyNumber || "-"}</span>
                  <span className="truncate">{player.name || "-"}</span>
                  <span className="text-zinc-500 text-right">{player.position || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
