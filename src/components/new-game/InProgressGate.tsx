import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { GameState } from "../../store";
import { GlassButton, glassInputClass } from "../control-panel/ui/glass";

interface InProgressGateProps {
  gameState: GameState;
  onSaveAndContinue: (name: string) => Promise<void>;
  onDiscardContinue: () => void;
  onQuickStart: () => void;
  onCancel: () => void;
}

export default function InProgressGate({
  gameState,
  onSaveAndContinue,
  onDiscardContinue,
  onQuickStart,
  onCancel,
}: InProgressGateProps) {
  const defaultName = `${gameState.homeTeam.name} vs ${gameState.awayTeam.name}`;
  const [saveName, setSaveName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await onSaveAndContinue(saveName.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-semibold text-amber-200">This game is already in progress.</p>
          <p className="text-sm text-zinc-400 mt-1">
            Starting a new game will replace the current score, clock, and event log. Save it first if you want to
            come back to it later.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="Game Name (e.g. Finals vs Stars)"
          className={`flex-1 ${glassInputClass}`}
        />
        <GlassButton onClick={handleSave} disabled={saving || !saveName.trim()} variant="primary">
          {saving ? "Saving..." : "Save & Continue"}
        </GlassButton>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-between pt-2 border-t border-white/10">
        <GlassButton onClick={onCancel} variant="ghost">
          Cancel
        </GlassButton>
        <div className="flex gap-2">
          <GlassButton onClick={onDiscardContinue} variant="secondary">
            Discard &amp; Continue
          </GlassButton>
          <GlassButton onClick={onQuickStart} variant="destructive">
            Quick Start (skip setup)
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
