import { useMemo, useRef, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { GameState, TeamPlayer, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import { GlassButton, GlassPanel, glassInputClass, glassInsetClass } from "./ui/glass";

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
  const { user } = useStore();
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedRosters, setExpandedRosters] = useState<string[]>([]);
  const [presetPendingDelete, setPresetPendingDelete] = useState<TeamPreset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savingHomeTeam, setSavingHomeTeam] = useState(false);
  const [savingAwayTeam, setSavingAwayTeam] = useState(false);
  const [homeSaveStatus, setHomeSaveStatus] = useState("");
  const [awaySaveStatus, setAwaySaveStatus] = useState("");
  const [saveConflict, setSaveConflict] = useState<SaveConflictState | null>(null);
  const hasLoadedRef = useRef(false);

  const baseUrl = useMemo(() => {
    // @ts-ignore
    const envBase = import.meta.env.VITE_BASE_URL || window.location.origin;
    return envBase.replace(/\/+$/, "");
  }, []);

  const loadPresets = async () => {
      if (!user) return;
      setLoading(true);
      setError("");
      try {
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/teams`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setPresets(Array.isArray(data) ? data : []);
      } catch (loadError) {
      console.error(loadError);
      setError("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  if (!hasLoadedRef.current && user) {
    hasLoadedRef.current = true;
    void loadPresets();
  }

  const loadPresetTeamIntoSide = (teamPreset: TeamPresetTeam, side: "home" | "away") => {
    if (side === "home") {
      updateState({ homeTeam: applyPresetTeam(gameState.homeTeam, teamPreset) });
      return;
    }
    updateState({ awayTeam: applyPresetTeam(gameState.awayTeam, teamPreset) });
  };

  const deletePreset = async (name: string) => {
    if (!user) return;
    setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/teams/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setPresets(Array.isArray(data?.teams) ? data.teams : []);
      setExpandedRosters((current) => current.filter((entry) => entry.toLowerCase() !== name.toLowerCase()));
    } catch (deleteError) {
      console.error(deleteError);
      setError("Failed to delete team");
    }
  };

  const persistTeam = async (side: "home" | "away", saveName: string) => {
    if (!user) return;
    if (side === "home") {
      setSavingHomeTeam(true);
      setHomeSaveStatus("");
    } else {
      setSavingAwayTeam(true);
      setAwaySaveStatus("");
    }

    try {
      const teamSource = side === "home" ? gameState.homeTeam : gameState.awayTeam;
      const token = await user.getIdToken();
      const response = await fetch(`${baseUrl}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: saveName,
          team: mapTeamToPreset(teamSource),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save team");
      }

      const data = await response.json();
      setPresets(Array.isArray(data?.teams) ? data.teams : []);
      if (side === "home") {
        setHomeSaveStatus(`Saved as "${saveName}".`);
      } else {
        setAwaySaveStatus(`Saved as "${saveName}".`);
      }
    } catch (saveError) {
      console.error(saveError);
      if (side === "home") {
        setHomeSaveStatus("Failed to save team.");
      } else {
        setAwaySaveStatus("Failed to save team.");
      }
    } finally {
      if (side === "home") {
        setSavingHomeTeam(false);
      } else {
        setSavingAwayTeam(false);
      }
    }
  };

  const saveTeam = async (side: "home" | "away") => {
    const preferredName = (side === "home" ? gameState.homeTeam.name : gameState.awayTeam.name).trim();
    const statusSetter = side === "home" ? setHomeSaveStatus : setAwaySaveStatus;

    if (!preferredName) {
      statusSetter("Team name is required.");
      return;
    }

    const existing = presets.find((entry) => entry.name.toLowerCase() === preferredName.toLowerCase());
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
      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      <div>
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
                className={`w-full ${glassInputClass}`}
              />
            </div>

            {filteredPresets.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500 italic">No teams match your search.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPresets.map((item) => (
                <div
                  key={item.name}
                  className={`p-4 flex flex-col gap-4 relative ${glassInsetClass}`}
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
                      <GlassButton onClick={() => loadPresetTeamIntoSide(item.team, "home")} variant="success" className="flex-1 text-sm">
                        To Home
                      </GlassButton>
                      <GlassButton onClick={() => loadPresetTeamIntoSide(item.team, "away")} variant="primary" className="flex-1 text-sm">
                        To Away
                      </GlassButton>
                    </div>
                    <GlassButton
                      type="button"
                      onClick={() => toggleRoster(item.name)}
                      variant="ghost"
                      className="w-full text-xs border border-white/10"
                    >
                      {expandedRosters.some((entry) => entry.toLowerCase() === item.name.toLowerCase())
                        ? "Hide Roster"
                        : `Show Roster (${item.team.players?.length ?? 0})`}
                    </GlassButton>
                    {expandedRosters.some((entry) => entry.toLowerCase() === item.name.toLowerCase()) && (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
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
      </GlassPanel>

      {presetPendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5">
            <h3 className="text-lg font-semibold text-zinc-100">Delete Team Preset</h3>
            <p className="text-sm text-zinc-400 mt-2">
              Are you sure you want to delete the team preset "{presetPendingDelete.name}"?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <GlassButton type="button" onClick={() => setPresetPendingDelete(null)} variant="secondary">
                Cancel
              </GlassButton>
              <GlassButton
                type="button"
                onClick={async () => {
                  const toDelete = presetPendingDelete;
                  setPresetPendingDelete(null);
                  if (toDelete) {
                    await deletePreset(toDelete.name);
                  }
                }}
                variant="destructive"
              >
                Delete
              </GlassButton>
            </div>
          </div>
        </div>
      )}

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
