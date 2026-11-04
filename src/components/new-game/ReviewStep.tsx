import { ChevronRight } from "lucide-react";
import { TeamDraft } from "./TeamSelectStep";
import { Button, insetClass } from "../control-panel/ui/primitives";

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
    <div className={`p-4 flex flex-col items-center gap-3 ${insetClass}`}>
      <div className="w-12 h-12 rounded-sm border border-line overflow-hidden flex items-center justify-center bg-canvas" aria-hidden>
        {draft.identity.logo ? (
          <img src={draft.identity.logo} alt="" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full" style={{ backgroundColor: draft.identity.color }} />
        )}
      </div>
      <div className="text-center">
        <div className="font-semibold text-ink">{draft.identity.name || "Unnamed team"}</div>
        <div className="text-xs tabular-nums text-muted">{draft.identity.abbreviation || "-"}</div>
      </div>
      <div className="text-xs text-muted">{draft.players.length} players</div>
      {draft.source === "new" && (
        <label className="flex items-center gap-2 text-xs text-muted mt-1">
          <input
            type="checkbox"
            checked={saveToLibrary}
            onChange={(e) => onToggleSave(e.target.checked)}
            className="accent-ink"
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
        <h3 className="text-[1.75rem] leading-[1.2] font-semibold">Review and start</h3>
        <p className="text-sm text-muted mt-0.5">Confirm both teams before starting the game.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamSummaryCard draft={homeDraft} saveToLibrary={saveHomeToLibrary} onToggleSave={onToggleSaveHome} />
        <TeamSummaryCard draft={awayDraft} saveToLibrary={saveAwayToLibrary} onToggleSave={onToggleSaveAway} />
      </div>

      <div className="flex justify-between pt-2 border-t border-line">
        <Button onClick={onBack} variant="ghost" disabled={starting}>
          Back
        </Button>
        <Button onClick={onStart} disabled={starting} variant="primary">
          {starting ? "Starting..." : "Start game"}
          {!starting && <ChevronRight size={16} />}
        </Button>
      </div>
    </div>
  );
}
