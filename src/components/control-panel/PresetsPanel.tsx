import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { GameState, TeamPlayer, TeamState } from "../../store";
import { UpdateGameState } from "./types";

interface TeamIdentity {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

interface TeamPresetTeam extends TeamIdentity {
  players: TeamPlayer[];
}

interface TeamPreset {
  name: string;
  team: TeamPresetTeam;
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

function pickPresetTeam(team: TeamState): TeamPresetTeam {
  return {
    ...pickTeamIdentity(team),
    players: (team.players ?? []).map((player) => ({ ...player })),
  };
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

export default function PresetsPanel({ gameState, updateState }: PresetsPanelProps) {
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState("");
  const [expandedRosters, setExpandedRosters] = useState<string[]>([]);
  const [presetPendingDelete, setPresetPendingDelete] = useState<TeamPreset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const baseUrl = useMemo(() => {
    // @ts-ignore
    const envBase = import.meta.env.VITE_BASE_URL || window.location.origin;
    return envBase.replace(/\/+$/, "");
  }, []);

  const loadPresets = async () => {
      setLoading(true);
      setError("");
      try {
      const response = await fetch(`${baseUrl}/api/teams`);
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

  const loadPresetTeamIntoSide = (teamPreset: TeamPresetTeam, side: "home" | "away") => {
    if (side === "home") {
      updateState({ homeTeam: applyPresetTeam(gameState.homeTeam, teamPreset) });
      return;
    }
    updateState({ awayTeam: applyPresetTeam(gameState.awayTeam, teamPreset) });
  };

  const deletePreset = async (name: string) => {
    setError("");
    try {
      const response = await fetch(`${baseUrl}/api/teams/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      setPresets(Array.isArray(data?.teams) ? data.teams : []);
      setExpandedRosters((current) => current.filter((entry) => entry.toLowerCase() !== name.toLowerCase()));
    } catch (deleteError) {
      console.error(deleteError);
      setError("Failed to delete team");
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
          homeTeam: pickPresetTeam(gameState.homeTeam),
          awayTeam: pickPresetTeam(gameState.awayTeam),
        }),
      });
    } catch (defaultsError) {
      console.error(defaultsError);
      setError("Failed to save defaults");
    } finally {
      setSavingDefaults(false);
    }
  };

  const toggleRoster = (name: string) => {
    setExpandedRosters((current) => {
      const exists = current.some((entry) => entry.toLowerCase() === name.toLowerCase());
      if (exists) return current.filter((entry) => entry.toLowerCase() !== name.toLowerCase());
      return [...current, name];
    });
  };

  const sortedPresets = presets
    .slice()
    .sort((a, b) => a.team.name.localeCompare(b.team.name, undefined, { sensitivity: "base" }));

  const filteredPresets = sortedPresets.filter((preset) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      preset.name.toLowerCase().includes(query) ||
      preset.team.name.toLowerCase().includes(query) ||
      preset.team.abbreviation.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Team Presets</h2>
          <p className="text-sm text-zinc-400 mt-1">Load saved teams into Home or Away, including roster.</p>
        </div>
        <button
          onClick={saveDefaultsNow}
          disabled={savingDefaults}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium"
        >
          {savingDefaults ? "Saving..." : "Save Current as Defaults"}
        </button>
      </div>

      {error && <div className="mt-5 text-sm text-red-400">{error}</div>}

      <div className="mt-5">
        {loading ? (
          <div className="p-4 text-sm text-zinc-400">Loading presets...</div>
        ) : presets.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic">No saved teams yet.</div>
        ) : (
          <>
            <div className="mb-4 flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {filteredPresets.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500 italic">No teams match your search.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPresets.map((item) => (
                <div
                  key={item.name}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-4 relative"
                >
                  <button
                    type="button"
                    onClick={() => setPresetPendingDelete(item)}
                    className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-full hover:bg-red-500/10"
                    aria-label={`Delete preset ${item.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 flex items-center justify-center overflow-hidden">
                        {item.team.logo ? (
                          <img src={item.team.logo} alt={item.team.abbreviation} className="h-20 w-20 object-contain" />
                        ) : (
                          <span className="text-sm font-bold text-zinc-400">{item.team.abbreviation}</span>
                        )}
                      </div>
                      <div className="font-semibold text-zinc-100 text-center">{item.team.name}</div>
                      <span className="text-xs font-mono text-zinc-400">{item.team.abbreviation}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadPresetTeamIntoSide(item.team, "home")}
                        className="flex-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm font-medium"
                      >
                        To Home
                      </button>
                      <button
                        onClick={() => loadPresetTeamIntoSide(item.team, "away")}
                        className="flex-1 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 rounded text-sm font-medium"
                      >
                        To Away
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleRoster(item.name)}
                      className="w-full px-3 py-2 bg-zinc-900 hover:bg-zinc-800 rounded text-xs font-medium text-zinc-300 border border-zinc-800"
                    >
                      {expandedRosters.some((entry) => entry.toLowerCase() === item.name.toLowerCase())
                        ? "Hide Roster"
                        : `Show Roster (${item.team.players?.length ?? 0})`}
                    </button>
                    {expandedRosters.some((entry) => entry.toLowerCase() === item.name.toLowerCase()) && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-3">
                        {(item.team.players ?? []).length === 0 ? (
                          <div className="text-xs text-zinc-500 italic">No players saved for this team.</div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {(item.team.players ?? []).map((player) => (
                              <div
                                key={player.id}
                                className="grid grid-cols-[42px_1fr_30px] gap-2 text-xs text-zinc-300 items-center"
                              >
                                <span className="font-mono text-zinc-400">{player.jerseyNumber || "-"}</span>
                                <span className="truncate">{player.name || "-"}</span>
                                <span className="text-zinc-500 text-right">{player.position || "-"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {presetPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Delete Team Preset</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Are you sure you want to delete the team preset "{presetPendingDelete.name}"?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPresetPendingDelete(null)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const toDelete = presetPendingDelete;
                  setPresetPendingDelete(null);
                  if (toDelete) {
                    await deletePreset(toDelete.name);
                  }
                }}
                className="px-3 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
