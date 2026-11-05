import { ReactNode, useState } from "react";
import { Trash2 } from "lucide-react";
import { SavedTeam } from "../../store";
import { Button, insetClass } from "../control-panel/ui/primitives";
import { TruncatedText } from "../control-panel/ui/TruncatedText";

interface TeamLibraryCardProps {
  entry: SavedTeam;
  onDeleteRequest: () => void;
  actions: ReactNode;
}

export default function TeamLibraryCard({ entry, onDeleteRequest, actions }: TeamLibraryCardProps) {
  const [rosterExpanded, setRosterExpanded] = useState(false);

  return (
    <div className={`p-6 flex flex-col gap-4 transition-colors hover:border-ink ${insetClass}`}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 shrink-0 flex items-center justify-center overflow-hidden">
          {entry.team.logo ? (
            <img src={entry.team.logo} alt={entry.team.abbreviation} loading="lazy" className="h-12 w-12 object-contain" />
          ) : (
            <div className="w-full h-full rounded-sm border border-line" style={{ backgroundColor: entry.team.color }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <TruncatedText text={entry.team.name} className="font-semibold" />
          <div className="text-sm text-muted">{entry.team.abbreviation}</div>
        </div>
        <button
          type="button"
          onClick={onDeleteRequest}
          className="shrink-0 text-muted hover:text-danger transition-colors p-1 rounded-sm hover:bg-surface"
          aria-label={`Delete preset ${entry.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div
        role="img"
        aria-label={`Team color ${entry.team.color}`}
        className="h-1 outline outline-1 outline-line"
        style={{ backgroundColor: entry.team.color }}
      />
      {actions}
      <Button type="button" onClick={() => setRosterExpanded((prev) => !prev)} variant="ghost" className="w-full">
        {rosterExpanded ? "Hide roster" : `Show roster (${entry.team.players?.length ?? 0})`}
      </Button>
      {rosterExpanded && (
        <div className="border-t border-line pt-3">
          {(entry.team.players ?? []).length === 0 ? (
            <div className="text-sm text-muted">No players saved for this team.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {(entry.team.players ?? []).map((player) => (
                <div key={player.id} className="grid grid-cols-[42px_1fr_30px] gap-2 text-sm items-center">
                  <span className="tabular-nums text-muted">{player.jerseyNumber || "-"}</span>
                  <span className="truncate">{player.name || "-"}</span>
                  <span className="text-muted text-right">{player.position || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
