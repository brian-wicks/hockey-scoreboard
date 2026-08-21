import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Play, Trash2 } from "lucide-react";
import { useStore } from "../../store";
import { ConfirmDialog } from "../control-panel/ui/ConfirmDialog";

interface SavedGamesListProps {
  limit?: number;
  showHeader?: boolean;
  footerLink?: { to: string; label: string };
}

interface PendingAction {
  type: "load" | "delete";
  id: string;
  name: string;
}

export default function SavedGamesList({ limit, showHeader = true, footerLink }: SavedGamesListProps) {
  const { savedGames, loadGame, deleteGame, loadSavedGames } = useStore();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    loadSavedGames();
  }, [loadSavedGames]);

  const games = typeof limit === "number" ? savedGames.slice(0, limit) : savedGames;

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (pendingAction.type === "load") {
      loadGame(pendingAction.id);
    } else {
      deleteGame(pendingAction.id);
    }
    setPendingAction(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <>
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        {showHeader && (
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-400">
                <History size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Game History</h2>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Load previous snapshots</p>
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
        )}
        <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
          {games.length === 0 ? (
            <div className="p-8 text-center">
              <History size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No saved games yet.</p>
            </div>
          ) : (
            games.map((game) => (
              <div key={game.id} className="p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white">{game.name}</span>
                  <span className="text-[10px] text-zinc-500">{formatDate(game.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPendingAction({ type: "load", id: game.id, name: game.name })}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-indigo-500/80 rounded-lg transition-all"
                    title="Load Game"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => setPendingAction({ type: "delete", id: game.id, name: game.name })}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete Game"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {footerLink && savedGames.length > 0 && (
          <div className="p-3 border-t border-white/10 text-center">
            <Link to={footerLink.to} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
              {footerLink.label}
            </Link>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.type === "delete" ? "Delete Saved Game" : "Load Saved Game"}
        message={
          pendingAction?.type === "delete"
            ? `Delete "${pendingAction.name}" forever?`
            : `Are you sure you want to load "${pendingAction?.name}"? Current state will be replaced.`
        }
        confirmLabel={pendingAction?.type === "delete" ? "Delete" : "Load"}
        confirmVariant={pendingAction?.type === "delete" ? "destructive" : "primary"}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
