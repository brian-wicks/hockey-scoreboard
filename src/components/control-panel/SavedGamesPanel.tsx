import { useState, useEffect } from "react";
import { History, Save, Trash2, Play } from "lucide-react";
import { useStore } from "../../store";
import { GlassButton, glassInputClass } from "./ui/glass";

export default function SavedGamesPanel() {
  const { gameState, savedGames, saveGame, loadGame, deleteGame, loadSavedGames, resetGame } = useStore();
  const [newGameName, setNewGameName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNameTouched, setIsNameTouched] = useState(false);

  const defaultName = gameState
    ? `${gameState.homeTeam.name} vs ${gameState.awayTeam.name}`
    : "";

  useEffect(() => {
    if (!isNameTouched) {
      setNewGameName(defaultName);
    }
  }, [defaultName, isNameTouched]);

  useEffect(() => {
    loadSavedGames();
  }, [loadSavedGames]);

  if (!gameState) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    setIsSaving(true);
    try {
      await saveGame(newGameName.trim());
      setNewGameName("");
      setIsNameTouched(false);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Save size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Save Current Game</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Snapshot current state</p>
            </div>
          </div>
          <GlassButton
            onClick={() => {
              if (confirm("Reset current game to defaults? This cannot be undone unless you save first.")) {
                resetGame();
              }
            }}
            variant="ghost"
            className="border border-white/10 hover:border-red-500/40 hover:text-red-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            New Game
          </GlassButton>
        </div>
        <div className="p-4">
          <form onSubmit={handleSave} className="flex gap-2">
            <input
              type="text"
              value={newGameName}
              onChange={(e) => {
                setNewGameName(e.target.value);
                setIsNameTouched(true);
              }}
              placeholder="Game Name (e.g. Finals vs Stars)"
              className={`flex-1 ${glassInputClass}`}
            />
            <GlassButton
              type="submit"
              disabled={isSaving || !newGameName.trim()}
              variant="primary"
              className="px-6 py-2.5 shrink-0"
            >
              {isSaving ? "Saving..." : "Save"}
            </GlassButton>
          </form>
        </div>
      </div>

      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
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
        <div className="divide-y divide-white/10 max-h-[500px] overflow-y-auto">
          {savedGames.length === 0 ? (
            <div className="p-8 text-center">
              <History size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No saved games yet.</p>
            </div>
          ) : (
            savedGames.map((game) => (
              <div key={game.id} className="p-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white">{game.name}</span>
                  <span className="text-[10px] text-zinc-500">{formatDate(game.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to load "${game.name}"? Current state will be replaced.`)) {
                        loadGame(game.id);
                      }
                    }}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-indigo-500/80 rounded-lg transition-all"
                    title="Load Game"
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${game.name}" forever?`)) {
                        deleteGame(game.id);
                      }
                    }}
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
      </div>
    </div>
  );
}
