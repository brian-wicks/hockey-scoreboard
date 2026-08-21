import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { useStore } from "../../store";
import { GlassButton, glassInputClass } from "./ui/glass";
import SavedGamesList from "../game/SavedGamesList";
import NewGameWizard from "../new-game/NewGameWizard";

export default function SavedGamesPanel() {
  const { gameState, saveGame } = useStore();
  const [newGameName, setNewGameName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const defaultName = gameState
    ? `${gameState.homeTeam.name} vs ${gameState.awayTeam.name}`
    : "";

  useEffect(() => {
    if (!isNameTouched) {
      setNewGameName(defaultName);
    }
  }, [defaultName, isNameTouched]);

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
            onClick={() => setIsWizardOpen(true)}
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

      <SavedGamesList />

      <NewGameWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} onStarted={() => setIsWizardOpen(false)} />
    </div>
  );
}
