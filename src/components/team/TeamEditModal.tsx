import { useState } from "react";
import { X, Save as SaveIcon } from "lucide-react";
import { SavedTeam, TeamPlayer, useStore } from "../../store";
import { GlassButton } from "../control-panel/ui/glass";
import TeamEditorFields, { TeamIdentityDraft } from "./TeamEditorFields";

interface TeamEditModalProps {
  /** null creates a new library entry; a SavedTeam edits it in place. */
  entry: SavedTeam | null;
  onClose: () => void;
}

const BLANK_IDENTITY: TeamIdentityDraft = { name: "", abbreviation: "", logo: "", color: "#3b82f6" };

export default function TeamEditModal({ entry, onClose }: TeamEditModalProps) {
  const { saveTeamToLibrary, deleteTeamFromLibrary } = useStore();
  const [identity, setIdentity] = useState<TeamIdentityDraft>(entry ? { ...entry.team } : BLANK_IDENTITY);
  const [roster, setRoster] = useState<TeamPlayer[]>(entry?.team.players ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const name = identity.name.trim();
    if (!name) {
      setError("Team name is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // The library entry's key is the team's display name (matching how the Presets
      // tab already saves teams) — if editing renamed it, save under the new name and
      // clean up the old one so it doesn't linger as a stale duplicate.
      await saveTeamToLibrary(name, { ...identity, players: roster });
      if (entry && entry.name !== name) {
        await deleteTeamFromLibrary(entry.name);
      }
      onClose();
    } catch {
      setError("Failed to save team.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-950/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="sticky top-0 flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-zinc-950/90 backdrop-blur-2xl">
          <h2 className="text-xl font-bold text-white">{entry ? "Edit Team" : "Create New Team"}</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex flex-col gap-4">
          <TeamEditorFields
            identity={identity}
            onIdentityCommit={(updates) => setIdentity((prev) => ({ ...prev, ...updates }))}
            colorLabel="Team color"
            roster={roster}
            onRosterChange={setRoster}
            rosterExpandedDefault={roster.length > 0}
            framed={false}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <GlassButton onClick={onClose} variant="ghost" disabled={saving}>
              Cancel
            </GlassButton>
            <GlassButton onClick={handleSave} disabled={saving || !identity.name.trim()} variant="primary">
              <SaveIcon className="w-4 h-4" />
              {saving ? "Saving..." : "Save Team"}
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  );
}
