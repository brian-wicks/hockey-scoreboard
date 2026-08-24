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
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-400">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Your Games</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Autosaved &middot; open any game</p>
            </div>
          </div>
          <button
            onClick={() => loadSavedGames()}
            className="text-[10px] font-bold text-zinc-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1.5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
            Refresh List
          </button>
        </div>
        <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
          {games.length === 0 ? (
            <div className="p-8 text-center">
              <History size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No saved games yet.</p>
            </div>
          ) : (
            games.map((game) => {
              const isActive = game.id === activeGameId;
              return (
                <div key={game.id} className="p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white flex items-center gap-2">
                      {game.name}
                      {isActive && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                          Open
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-500">{formatDate(game.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        openGame(game.id);
                        onOpened?.();
                      }}
                      className="p-2 text-zinc-400 hover:text-white hover:bg-indigo-500/80 rounded-lg transition-all"
                      title="Open Game"
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button
                      onClick={() => setPendingDelete({ id: game.id, name: game.name })}
                      className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Game"
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
        title="Delete Saved Game"
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
