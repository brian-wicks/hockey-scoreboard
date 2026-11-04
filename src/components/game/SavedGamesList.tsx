import { useEffect, useState } from "react";
import { History, Play, Trash2 } from "lucide-react";
import { useStore } from "../../store";
import { ConfirmDialog } from "../control-panel/ui/ConfirmDialog";

interface SavedGamesListProps {
  /** Called after a game finishes opening — e.g. to navigate to the Control Panel. */
  onOpened?: () => void;
}

interface PendingDelete {
  id: string;
  name: string;
}

export default function SavedGamesList({ onOpened }: SavedGamesListProps) {
  const { savedGames, activeGameId, openGame, deleteGame, loadSavedGames } = useStore();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  useEffect(() => {
    loadSavedGames();
  }, [loadSavedGames]);

  // Whatever's currently open floats to the top; everything else falls back to most
  // recently played — autosave means updatedAt already reflects that.
  const games = [...savedGames].sort((a, b) => {
    if (a.id === activeGameId) return -1;
    if (b.id === activeGameId) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <>
      <div className="bg-canvas border border-line rounded-sm overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="font-semibold">Your games</h2>
              <p className="text-xs text-muted">Autosaved &middot; open any game</p>
            </div>
          </div>
          <button
            onClick={() => loadSavedGames()}
            className="text-sm font-semibold underline rounded-sm hover:no-underline"
          >
            Refresh list
          </button>
        </div>
        <div className="divide-y divide-line max-h-[500px] overflow-y-auto">
          {games.length === 0 ? (
            <div className="p-8 text-center">
                            <p className="text-sm text-muted">No saved games yet.</p>
            </div>
          ) : (
            games.map((game) => {
              const isActive = game.id === activeGameId;
              return (
                <div key={game.id} className="p-4 flex items-center justify-between hover:bg-surface transition-colors group">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink flex items-center gap-2">
                      {game.name}
                      {isActive && (
                        <span className="text-xs font-semibold text-canvas bg-ink rounded-sm px-1.5 py-0.5">
                          Open
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted">{formatDate(game.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        openGame(game.id);
                        onOpened?.();
                      }}
                      className="p-2 text-ink hover:text-canvas hover:bg-action-hover rounded-sm transition-colors"
                      title="Open game"
                      aria-label={`Open ${game.name}`}
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ id: game.id, name: game.name })}
                      className="p-2 text-muted hover:text-danger hover:bg-surface rounded-sm transition-colors"
                      title="Delete game"
                      aria-label={`Delete ${game.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete saved game"
        message={`Delete "${pendingDelete?.name}" forever? This can't be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (pendingDelete) deleteGame(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
