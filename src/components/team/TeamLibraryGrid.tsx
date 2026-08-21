import { ReactNode, useEffect, useState } from "react";
import { SavedTeam, useStore } from "../../store";
import { glassInputClass } from "../control-panel/ui/glass";
import { ConfirmDialog } from "../control-panel/ui/ConfirmDialog";
import TeamLibraryCard from "./TeamLibraryCard";

interface TeamLibraryGridProps {
  renderActions: (entry: SavedTeam) => ReactNode;
  emptyMessage?: string;
}

export default function TeamLibraryGrid({ renderActions, emptyMessage = "No saved teams yet." }: TeamLibraryGridProps) {
  const { teamLibrary, loadTeamLibrary, deleteTeamFromLibrary } = useStore();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<SavedTeam | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    void loadTeamLibrary().finally(() => setLoading(false));
  }, [loadTeamLibrary]);

  const sortedTeams = teamLibrary
    .slice()
    .sort((a, b) => a.team.name.localeCompare(b.team.name, undefined, { sensitivity: "base" }));

  const filteredTeams = sortedTeams.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.name.toLowerCase().includes(query) ||
      entry.team.name.toLowerCase().includes(query) ||
      entry.team.abbreviation.toLowerCase().includes(query)
    );
  });

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError("");
    try {
      await deleteTeamFromLibrary(pendingDelete.name);
      setPendingDelete(null);
    } catch {
      setDeleteError("Failed to delete team");
    }
  };

  return (
    <div>
      {loading ? (
        <div className="p-4 text-sm text-zinc-400">Loading teams...</div>
      ) : teamLibrary.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500 italic">{emptyMessage}</div>
      ) : (
        <>
          <div className="mb-4 flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams..."
              className={`w-full ${glassInputClass}`}
            />
          </div>

          {filteredTeams.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500 italic">No teams match your search.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.map((entry) => (
                <TeamLibraryCard
                  key={entry.name}
                  entry={entry}
                  onDeleteRequest={() => setPendingDelete(entry)}
                  actions={renderActions(entry)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Team Preset"
        message={`Are you sure you want to delete the team preset "${pendingDelete?.name}"?`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
