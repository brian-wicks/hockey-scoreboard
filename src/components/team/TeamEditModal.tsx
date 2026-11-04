import { useState } from "react";
import { X, Save as SaveIcon } from "lucide-react";
import { SavedTeam, TeamPlayer, useStore } from "../../store";
import { Button } from "../control-panel/ui/primitives";
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
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-canvas border border-line rounded-sm">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-line bg-canvas">
          <h2 className="text-xl font-semibold text-ink">{entry ? "Edit team" : "Create new team"}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-ink hover:bg-surface rounded-sm transition-colors"
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
            logoInput="upload"
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button onClick={onClose} variant="secondary" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !identity.name.trim()} variant="primary">
              <SaveIcon className="w-4 h-4" />
              {saving ? "Saving..." : "Save team"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
