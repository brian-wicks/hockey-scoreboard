import { TeamDraft } from "./TeamSelectStep";
import { GlassButton, glassInsetClass } from "../control-panel/ui/glass";

interface ReviewStepProps {
  homeDraft: TeamDraft;
  awayDraft: TeamDraft;
  saveHomeToLibrary: boolean;
  saveAwayToLibrary: boolean;
  onToggleSaveHome: (value: boolean) => void;
  onToggleSaveAway: (value: boolean) => void;
  onBack: () => void;
  onStart: () => void;
  starting: boolean;
}

function TeamSummaryCard({
  draft,
  saveToLibrary,
  onToggleSave,
}: {
  draft: TeamDraft;
  saveToLibrary: boolean;
  onToggleSave: (value: boolean) => void;
}) {
  return (
    <div className={`p-4 flex flex-col items-center gap-3 ${glassInsetClass}`}>
      <div
        className="w-12 h-12 rounded-full border border-white/20"
        style={{ backgroundColor: draft.identity.color }}
        aria-hidden
      />
      <div className="text-center">
        <div className="font-semibold text-zinc-100">{draft.identity.name || "Unnamed Team"}</div>
        <div className="text-xs font-mono text-zinc-400">{draft.identity.abbreviation || "-"}</div>
      </div>
      <div className="text-xs text-zinc-500">{draft.players.length} players</div>
      {draft.source === "new" && (
        <label className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
          <input
            type="checkbox"
            checked={saveToLibrary}
            onChange={(e) => onToggleSave(e.target.checked)}
            className="accent-indigo-500"
          />
          Save to my team library
        </label>
      )}
    </div>
  );
}

export default function ReviewStep({
  homeDraft,
  awayDraft,
  saveHomeToLibrary,
  saveAwayToLibrary,
  onToggleSaveHome,
  onToggleSaveAway,
  onBack,
  onStart,
  starting,
}: ReviewStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-lg font-bold text-white">Review &amp; Start</h3>
        <p className="text-sm text-zinc-400 mt-0.5">Confirm both teams before starting the game.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamSummaryCard draft={homeDraft} saveToLibrary={saveHomeToLibrary} onToggleSave={onToggleSaveHome} />
        <TeamSummaryCard draft={awayDraft} saveToLibrary={saveAwayToLibrary} onToggleSave={onToggleSaveAway} />
      </div>

      <div className="flex justify-between pt-2 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost" disabled={starting}>
          Back
        </GlassButton>
        <GlassButton onClick={onStart} disabled={starting} variant="success">
          {starting ? "Starting..." : "Start Game"}
        </GlassButton>
      </div>
    </div>
  );
}
