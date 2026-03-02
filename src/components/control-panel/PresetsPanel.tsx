import { useEffect, useMemo, useState } from "react";
import { GameState, TeamState } from "../../store";
import { UpdateGameState } from "./types";

interface TeamIdentity {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

interface TeamPreset {
  name: string;
  homeTeam: TeamIdentity;
  awayTeam: TeamIdentity;
  updatedAt: number;
}

interface PresetsPanelProps {
  gameState: GameState;
  updateState: UpdateGameState;
}

function pickTeamIdentity(team: TeamState): TeamIdentity {
  return {
    name: team.name,
    abbreviation: team.abbreviation,
    logo: team.logo,
    color: team.color,
  };
}

function applyTeamIdentity(team: TeamState, identity: TeamIdentity): TeamState {
  return {
    ...team,
    name: identity.name,
    abbreviation: identity.abbreviation,
    logo: identity.logo,
    color: identity.color,
  };
}

export default function PresetsPanel({ gameState, updateState }: PresetsPanelProps) {
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState("");

  const baseUrl = useMemo(() => {
    // @ts-ignore
    const envBase = import.meta.env.VITE_BASE_URL || window.location.origin;
    return envBase.replace(/\/+$/, "");
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${baseUrl}/api/team-presets`);
      const data = await response.json();
      setPresets(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error(loadError);
      setError("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPresets();
  }, []);

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) return;

    setError("");
    try {
      const response = await fetch(`${baseUrl}/api/team-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          homeTeam: pickTeamIdentity(gameState.homeTeam),
          awayTeam: pickTeamIdentity(gameState.awayTeam),
        }),
      });
      const data = await response.json();
      setPresets(Array.isArray(data?.presets) ? data.presets : []);
      setPresetName("");
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to save preset");
    }
  };

  const loadPresetIntoGame = (preset: TeamPreset) => {
    updateState({
      homeTeam: applyTeamIdentity(gameState.homeTeam, preset.homeTeam),
      awayTeam: applyTeamIdentity(gameState.awayTeam, preset.awayTeam),
    });
  };

  const deletePreset = async (name: string) => {
    setError("");
    try {
      const response = await fetch(`${baseUrl}/api/team-presets/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      setPresets(Array.isArray(data?.presets) ? data.presets : []);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Failed to delete preset");
    }
  };

  const saveDefaultsNow = async () => {
    setSavingDefaults(true);
    setError("");
    try {
      await fetch(`${baseUrl}/api/team-defaults`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: pickTeamIdentity(gameState.homeTeam),
          awayTeam: pickTeamIdentity(gameState.awayTeam),
        }),
      });
    } catch (defaultsError) {
      console.error(defaultsError);
      setError("Failed to save defaults");
    } finally {
      setSavingDefaults(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Team Presets</h2>
          <p className="text-sm text-zinc-400 mt-1">Save and recall home/away team settings for repeat matchups.</p>
        </div>
        <button
          onClick={saveDefaultsNow}
          disabled={savingDefaults}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium"
        >
          {savingDefaults ? "Saving..." : "Save Current as Defaults"}
        </button>
      </div>

      <div className="mt-5 flex gap-3">
        <input
          type="text"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && savePreset()}
          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
          placeholder="Preset name (example: Wolves vs Falcons)"
        />
        <button
          onClick={savePreset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium"
        >
          Save Preset
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-red-400">{error}</div>}

      <div className="mt-5">
        {loading ? (
          <div className="p-4 text-sm text-zinc-400">Loading presets...</div>
        ) : presets.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic">No presets saved yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((preset) => (
                <div key={preset.name} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-zinc-100 truncate">{preset.name}</div>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
                        {preset.homeTeam.logo ? (
                          <img src={preset.homeTeam.logo} alt={preset.homeTeam.abbreviation} className="h-20 w-20 object-contain" />
                        ) : (
                          <span className="text-sm font-bold text-zinc-400">{preset.homeTeam.abbreviation}</span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-zinc-400">{preset.homeTeam.abbreviation}</span>
                    </div>
                    <span className="text-zinc-500 text-sm font-semibold">VS</span>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
                        {preset.awayTeam.logo ? (
                          <img src={preset.awayTeam.logo} alt={preset.awayTeam.abbreviation} className="h-20 w-20 object-contain" />
                        ) : (
                          <span className="text-sm font-bold text-zinc-400">{preset.awayTeam.abbreviation}</span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-zinc-400">{preset.awayTeam.abbreviation}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadPresetIntoGame(preset)}
                      className="flex-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm font-medium"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deletePreset(preset.name)}
                      className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
