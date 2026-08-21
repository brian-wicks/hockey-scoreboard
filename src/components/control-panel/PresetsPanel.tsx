import { useState } from "react";
import { Save } from "lucide-react";
import { GameState, SavedTeam, TeamPresetTeam, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import { GlassButton, GlassPanel, glassInsetClass } from "./ui/glass";
import TeamLibraryGrid from "../team/TeamLibraryGrid";

interface PresetsPanelProps {
  gameState: GameState;
  updateState: UpdateGameState;
}

interface SaveConflictState {
  side: "home" | "away";
  preferredName: string;
}

function applyPresetTeam(team: TeamState, identity: TeamPresetTeam): TeamState {
  return {
    ...team,
    name: identity.name,
    abbreviation: identity.abbreviation,
    logo: identity.logo,
    color: identity.color,
    players: (identity.players ?? []).map((player) => ({ ...player })),
  };
}

function mapTeamToPreset(team: TeamState): TeamPresetTeam {
  return {
    name: team.name,
    abbreviation: team.abbreviation,
    logo: team.logo,
    color: team.color,
    players: (team.players ?? [])
      .map((player) => ({ ...player }))
      .sort((a, b) => {
        const aNumber = Number.parseInt(a.jerseyNumber, 10);
        const bNumber = Number.parseInt(b.jerseyNumber, 10);
        const aValid = Number.isFinite(aNumber);
        const bValid = Number.isFinite(bNumber);
        if (aValid && bValid) return aNumber - bNumber;
        if (aValid) return -1;
        if (bValid) return 1;
        return a.jerseyNumber.localeCompare(b.jerseyNumber);
      }),
  };
}

export default function PresetsPanel({ gameState, updateState }: PresetsPanelProps) {
  const { teamLibrary, saveTeamToLibrary } = useStore();
  const [savingHomeTeam, setSavingHomeTeam] = useState(false);
  const [savingAwayTeam, setSavingAwayTeam] = useState(false);
  const [homeSaveStatus, setHomeSaveStatus] = useState("");
  const [awaySaveStatus, setAwaySaveStatus] = useState("");
  const [saveConflict, setSaveConflict] = useState<SaveConflictState | null>(null);

  const loadPresetTeamIntoSide = (teamPreset: TeamPresetTeam, side: "home" | "away") => {
    if (side === "home") {
      updateState({ homeTeam: applyPresetTeam(gameState.homeTeam, teamPreset) });
      return;
    }
    updateState({ awayTeam: applyPresetTeam(gameState.awayTeam, teamPreset) });
  };

  const persistTeam = async (side: "home" | "away", saveName: string) => {
    const statusSetter = side === "home" ? setHomeSaveStatus : setAwaySaveStatus;
    const savingSetter = side === "home" ? setSavingHomeTeam : setSavingAwayTeam;
    savingSetter(true);
    statusSetter("");
    try {
      const teamSource = side === "home" ? gameState.homeTeam : gameState.awayTeam;
      await saveTeamToLibrary(saveName, mapTeamToPreset(teamSource));
      statusSetter(`Saved as "${saveName}".`);
    } catch {
      statusSetter("Failed to save team.");
    } finally {
      savingSetter(false);
    }
  };

  const saveTeam = async (side: "home" | "away") => {
    const preferredName = (side === "home" ? gameState.homeTeam.name : gameState.awayTeam.name).trim();
    const statusSetter = side === "home" ? setHomeSaveStatus : setAwaySaveStatus;

    if (!preferredName) {
      statusSetter("Team name is required.");
      return;
    }

    const existing = teamLibrary.find((entry) => entry.name.toLowerCase() === preferredName.toLowerCase());
    if (existing) {
      setSaveConflict({ side, preferredName });
      return;
    }

    await persistTeam(side, preferredName);
  };

  const confirmOverwriteSave = async () => {
    if (!saveConflict) return;
    await persistTeam(saveConflict.side, saveConflict.preferredName);
    setSaveConflict(null);
  };

  const renderCardActions = (entry: SavedTeam) => (
    <div className="flex gap-2">
      <GlassButton onClick={() => loadPresetTeamIntoSide(entry.team, "home")} variant="success" className="flex-1 text-sm">
        To Home
      </GlassButton>
      <GlassButton onClick={() => loadPresetTeamIntoSide(entry.team, "away")} variant="primary" className="flex-1 text-sm">
        To Away
      </GlassButton>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel>
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Team Presets</h2>
            <p className="text-sm text-zinc-400 mt-1">Save the current teams to your library, or load a saved team into Home or Away.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 flex items-center justify-between gap-3 ${glassInsetClass}`}>
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100 truncate">{gameState.homeTeam.name || "Home Team"}</div>
              {homeSaveStatus && <div className="text-xs text-zinc-500 mt-0.5">{homeSaveStatus}</div>}
            </div>
            <GlassButton
              type="button"
              onClick={() => saveTeam("home")}
              disabled={savingHomeTeam}
              variant="secondary"
              className="shrink-0"
            >
              <Save className="w-4 h-4" /> Save Home
            </GlassButton>
          </div>
          <div className={`p-4 flex items-center justify-between gap-3 ${glassInsetClass}`}>
            <div className="min-w-0">
              <div className="font-semibold text-zinc-100 truncate">{gameState.awayTeam.name || "Away Team"}</div>
              {awaySaveStatus && <div className="text-xs text-zinc-500 mt-0.5">{awaySaveStatus}</div>}
            </div>
            <GlassButton
              type="button"
              onClick={() => saveTeam("away")}
              disabled={savingAwayTeam}
              variant="secondary"
              className="shrink-0"
            >
              <Save className="w-4 h-4" /> Save Away
            </GlassButton>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel>
        <TeamLibraryGrid renderActions={renderCardActions} />
      </GlassPanel>

      {saveConflict && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Team Name Already Exists</h3>
            <p className="text-sm text-zinc-400 mt-2">
              A team named "{saveConflict.preferredName}" already exists. Overwrite it?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <GlassButton type="button" onClick={() => setSaveConflict(null)} variant="secondary">
                Cancel
              </GlassButton>
              <GlassButton type="button" onClick={confirmOverwriteSave} variant="success">
                Overwrite
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
