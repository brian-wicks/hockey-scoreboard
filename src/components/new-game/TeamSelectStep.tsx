import { useState } from "react";
import { SavedTeam, TeamPlayer } from "../../store";
import { GlassButton, glassInsetClass } from "../control-panel/ui/glass";
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
        <h3 className="text-lg font-bold text-white">{sideLabel} Team</h3>
        <p className="text-sm text-zinc-400 mt-0.5">Pick a team from your library, or create a new one.</p>
      </div>

      {otherSelection && (
        <div className={`flex items-center gap-3 p-3 ${glassInsetClass}`}>
          <div className="w-8 h-8 rounded-full border border-white/20 overflow-hidden flex items-center justify-center shrink-0 bg-white/[0.04]">
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
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {otherSelection.label} team selected
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {otherSelection.draft.identity.name || "Unnamed Team"}
            </div>
          </div>
        </div>
      )}

      <div className="inline-flex self-start rounded-xl border border-white/10 bg-white/[0.03] p-1 gap-1">
        <button
          type="button"
          onClick={() => setMode("library")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "library"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Pick from library
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "create"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Create new
        </button>
      </div>

      {mode === "library" ? (
        <TeamLibraryGrid
          emptyMessage="No saved teams yet — switch to Create New instead."
          renderActions={(entry) => (
            <GlassButton onClick={() => handleLibrarySelect(entry)} variant="primary" className="w-full text-sm">
              Select
            </GlassButton>
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
          />
          <p className="text-xs text-zinc-500 italic">Roster is optional — you can add players later in Settings.</p>
          <GlassButton onClick={handleCreateContinue} disabled={!identity.name.trim()} variant="primary" className="self-end">
            Continue
          </GlassButton>
        </div>
      )}

      {onBack && (
        <div className="pt-2 border-t border-white/10">
          <GlassButton onClick={onBack} variant="ghost">
            Back
          </GlassButton>
        </div>
      )}
    </div>
  );
}
