import { useState } from "react";
import { Save } from "lucide-react";
import { GameState, SavedTeam, TeamPresetTeam, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import { Button, Panel, insetClass } from "./ui/primitives";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import TeamLibraryGrid from "../team/TeamLibraryGrid";
import { sortPlayersByJersey } from "../../utils/roster";

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
    players: sortPlayersByJersey((team.players ?? []).map((player) => ({ ...player }))),
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
      <Button onClick={() => loadPresetTeamIntoSide(entry.team, "home")} variant="primary" className="flex-1 text-sm">
        To home
      </Button>
      <Button onClick={() => loadPresetTeamIntoSide(entry.team, "away")} variant="primary" className="flex-1 text-sm">
        To away
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Teams</h2>
            <p className="text-sm text-muted mt-1">Save the current teams to your library, or load a saved team into Home or Away.</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-4 flex items-center justify-between gap-3 ${insetClass}`}>
            <div className="min-w-0">
              <div className="font-semibold text-ink truncate">{gameState.homeTeam.name || "Home team"}</div>
              {homeSaveStatus && <div className="text-xs text-muted mt-0.5">{homeSaveStatus}</div>}
            </div>
            <Button
              type="button"
              onClick={() => saveTeam("home")}
              disabled={savingHomeTeam}
              variant="secondary"
              className="shrink-0"
            >
              <Save className="w-4 h-4" /> Save home
            </Button>
          </div>
          <div className={`p-4 flex items-center justify-between gap-3 ${insetClass}`}>
            <div className="min-w-0">
              <div className="font-semibold text-ink truncate">{gameState.awayTeam.name || "Away team"}</div>
              {awaySaveStatus && <div className="text-xs text-muted mt-0.5">{awaySaveStatus}</div>}
            </div>
            <Button
              type="button"
              onClick={() => saveTeam("away")}
              disabled={savingAwayTeam}
              variant="secondary"
              className="shrink-0"
            >
              <Save className="w-4 h-4" /> Save away
            </Button>
          </div>
        </div>
      </Panel>

      <TeamLibraryGrid renderActions={renderCardActions} />

      <ConfirmDialog
        open={saveConflict !== null}
        title="Team name already exists"
        message={`A team named "${saveConflict?.preferredName}" already exists. Overwrite it?`}
        confirmLabel="Overwrite"
        confirmVariant="primary"
        onConfirm={confirmOverwriteSave}
        onCancel={() => setSaveConflict(null)}
      />
    </div>
  );
}
