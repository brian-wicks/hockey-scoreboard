import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SavedTeam, TeamPlayer } from "../../store";
import { Button, insetClass } from "../control-panel/ui/primitives";
import TeamEditorFields, { TeamIdentityDraft } from "../team/TeamEditorFields";
import TeamLibraryGrid from "../team/TeamLibraryGrid";

export interface TeamDraft {
  source: "library" | "new";
  identity: TeamIdentityDraft;
  players: TeamPlayer[];
}

interface TeamSelectStepProps {
  side: "home" | "away";
  onConfirm: (draft: TeamDraft) => void;
  onBack?: () => void;
  /** The other side's already-confirmed team, if there is one — shown as a small
   * summary at the top so it stays clear which team was already picked while
   * choosing this one. */
  otherSelection?: { label: string; draft: TeamDraft };
}

const DEFAULT_COLOR: Record<"home" | "away", string> = {
  home: "#3b82f6",
  away: "#ef4444",
};

export default function TeamSelectStep({ side, onConfirm, onBack, otherSelection }: TeamSelectStepProps) {
  const [mode, setMode] = useState<"library" | "create">("library");
  const [identity, setIdentity] = useState<TeamIdentityDraft>({
    name: "",
    abbreviation: "",
    logo: "",
    color: DEFAULT_COLOR[side],
  });
  const [roster, setRoster] = useState<TeamPlayer[]>([]);

  const sideLabel = side === "home" ? "Home" : "Away";

  const handleLibrarySelect = (entry: SavedTeam) => {
    onConfirm({
      source: "library",
      identity: {
        name: entry.team.name,
        abbreviation: entry.team.abbreviation,
        logo: entry.team.logo,
        color: entry.team.color,
      },
      players: entry.team.players ?? [],
    });
  };

  const handleCreateContinue = () => {
    if (!identity.name.trim()) return;
    onConfirm({ source: "new", identity, players: roster });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[1.75rem] leading-[1.2] font-semibold">{sideLabel} team</h3>
        <p className="text-sm text-muted mt-0.5">Pick a team from your library, or create a new one.</p>
      </div>

      {otherSelection && (
        <div className={`flex items-center gap-3 p-3 ${insetClass}`}>
          <div className="w-8 h-8 rounded-sm border border-line overflow-hidden flex items-center justify-center shrink-0 bg-canvas">
            {otherSelection.draft.identity.logo ? (
              <img
                src={otherSelection.draft.identity.logo}
                alt=""
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full" style={{ backgroundColor: otherSelection.draft.identity.color }} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted">
              {otherSelection.label} team selected
            </div>
            <div className="text-sm font-semibold text-ink truncate">
              {otherSelection.draft.identity.name || "Unnamed team"}
            </div>
          </div>
        </div>
      )}

      <div className="inline-flex self-start rounded-sm border border-line overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("library")}
          aria-pressed={mode === "library"}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "library" ? "bg-ink text-canvas" : "bg-canvas text-ink hover:bg-surface"
          }`}
        >
          Pick from library
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          aria-pressed={mode === "create"}
          className={`px-3 py-2 text-sm font-semibold transition-colors ${
            mode === "create" ? "bg-ink text-canvas" : "bg-canvas text-ink hover:bg-surface"
          }`}
        >
          Create new
        </button>
      </div>

      {mode === "library" ? (
        <TeamLibraryGrid
          emptyMessage="No saved teams yet. Switch to Create new to add one."
          renderActions={(entry) => (
            <Button onClick={() => handleLibrarySelect(entry)} variant="primary" className="w-full justify-between">
              Select
              <ChevronRight size={16} />
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TeamEditorFields
            identity={identity}
            onIdentityCommit={(updates) => setIdentity((prev) => ({ ...prev, ...updates }))}
            colorLabel={`${sideLabel} team color`}
            roster={roster}
            onRosterChange={setRoster}
            rosterExpandedDefault={false}
            framed={false}
            logoInput="upload"
          />
          <p className="text-xs text-muted">Roster is optional. You can add players later in Settings.</p>
          <Button onClick={handleCreateContinue} disabled={!identity.name.trim()} variant="primary" className="self-end">
            Continue
            <ChevronRight size={16} />
          </Button>
        </div>
      )}

      {onBack && (
        <div className="pt-2 border-t border-line">
          <Button onClick={onBack} variant="ghost">
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
