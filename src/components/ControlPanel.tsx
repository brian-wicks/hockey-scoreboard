import { useEffect, useRef, useState } from "react";
import { useStore, TeamState, GameState, KeyboardShortcut, Penalty } from "../store";
import { Play, Square, Settings, Minus, Plus, Link as LinkIcon, Keyboard, X } from "lucide-react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export default function ControlPanel() {
  const { gameState, connect, updateState, startClock, stopClock, setClock, loadShortcuts } = useStore();
  const [activeTab, setActiveTab] = useState<"controls" | "settings" | "presets">("controls");

  useKeyboardShortcuts(activeTab === "controls");

  useEffect(() => {
    connect();
    loadShortcuts();
  }, [connect, loadShortcuts]);

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Connecting...</div>;
  }

  const { homeTeam, awayTeam, clock, period } = gameState;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
          Hockey Scoreboard
        </h1>
        <div className="flex gap-2">
          <a
            href="/overlay"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            <LinkIcon size={16} />
            Open Overlay
          </a>
          <button
            onClick={() => setActiveTab("controls")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "controls" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            Controls
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === "settings" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={() => setActiveTab("presets")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "presets" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
            }`}
          >
            Presets
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === "controls" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <TeamControls team="home" state={homeTeam} updateState={updateState} gameState={gameState} />
            
            <div className="flex flex-col gap-6">
              <ClockControl clock={clock} period={period} startClock={startClock} stopClock={stopClock} setClock={setClock} updateState={updateState} gameState={gameState} />
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-zinc-300 uppercase tracking-wider">Game Actions</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => updateState({ period: "1st" })}
                    className={`p-3 rounded-lg font-medium ${period === "1st" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >1st Period</button>
                  <button 
                    onClick={() => updateState({ period: "2nd" })}
                    className={`p-3 rounded-lg font-medium ${period === "2nd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >2nd Period</button>
                  <button 
                    onClick={() => updateState({ period: "3rd" })}
                    className={`p-3 rounded-lg font-medium ${period === "3rd" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >3rd Period</button>
                  <button 
                    onClick={() => updateState({ period: "OT" })}
                    className={`p-3 rounded-lg font-medium ${period === "OT" ? "bg-indigo-600" : "bg-zinc-800 hover:bg-zinc-700"}`}
                  >Overtime</button>
                </div>
              </div>
            </div>

            <TeamControls team="away" state={awayTeam} updateState={updateState} gameState={gameState} />
          </div>
        ) : activeTab === "settings" ? (
          <SettingsPanel gameState={gameState} updateState={updateState} />
        ) : (
          <PresetsPanel gameState={gameState} updateState={updateState} />
        )}
      </main>
    </div>
  );
}

function TeamControls({ team, state, updateState }: { team: "home" | "away", state: TeamState, updateState: any, gameState: GameState }) {
  const [focusPenaltyId, setFocusPenaltyId] = useState<string | null>(null);
  const previousPenaltyCountRef = useRef(state.penalties.length);

  const updateTeam = (updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...state, ...updates } });
  };

  useEffect(() => {
    const previousPenaltyCount = previousPenaltyCountRef.current;
    if (state.penalties.length > previousPenaltyCount) {
      const newestPenalty = state.penalties[state.penalties.length - 1];
      if (newestPenalty) {
        setFocusPenaltyId(newestPenalty.id);
      }
    }
    previousPenaltyCountRef.current = state.penalties.length;
  }, [state.penalties]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-bold" style={{ color: state.color }}>{state.name}</h2>
        <span className="text-zinc-500 font-mono">{state.abbreviation}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Score</span>
        <div className="flex items-center gap-4">
          <button onClick={() => updateTeam({ score: Math.max(0, state.score - 1) })} className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Minus size={24} />
          </button>
          <span className="text-5xl font-mono font-bold w-16 text-center">{state.score}</span>
          <button onClick={() => updateTeam({ score: state.score + 1 })} className="w-12 h-12 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Plus size={24} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Shots</span>
        <div className="flex items-center gap-4">
          <button onClick={() => updateTeam({ shots: Math.max(0, state.shots - 1) })} className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Minus size={20} />
          </button>
          <span className="text-3xl font-mono font-bold w-12 text-center">{state.shots}</span>
          <button onClick={() => updateTeam({ shots: state.shots + 1 })} className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Timeouts</span>
        <div className="flex items-center gap-4">
          <button onClick={() => updateTeam({ timeouts: Math.max(0, state.timeouts - 1) })} className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Minus size={20} />
          </button>
          <span className="text-3xl font-mono font-bold w-12 text-center">{state.timeouts}</span>
          <button onClick={() => updateTeam({ timeouts: state.timeouts + 1 })} className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-zinc-400 uppercase tracking-wider text-sm font-semibold">Penalties</span>
          <button
            onClick={() => {
              const newPenalty = { id: Math.random().toString(36).substr(2, 9), playerNumber: "00", timeRemaining: 120000, duration: 120000 };
              updateTeam({ penalties: [...state.penalties, newPenalty] });
            }}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium flex items-center gap-1"
          >
            <Plus size={16} /> Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {state.penalties.map((p, i) => (
            <PenaltyItem
              key={p.id}
              penalty={p}
              onChange={(updated) => {
                const newPenalties = [...state.penalties];
                newPenalties[i] = updated;
                updateTeam({ penalties: newPenalties });
              }}
              onRemove={() => {
                const newPenalties = state.penalties.filter((_, index) => index !== i);
                updateTeam({ penalties: newPenalties });
              }}
              autoFocusPlayer={p.id === focusPenaltyId}
              onAutoFocusHandled={() => setFocusPenaltyId((current) => (current === p.id ? null : current))}
            />
          ))}
          {state.penalties.length === 0 && (
            <div className="text-center text-zinc-600 text-sm py-4 italic">No active penalties</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClockControl({ clock, period, startClock, stopClock, setClock }: any) {
  const [displayTime, setDisplayTime] = useState("20:00");
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("20:00");

  useEffect(() => {
    let animationFrameId: number;
    
    const updateDisplay = () => {
      let currentRemaining = clock.timeRemaining;
      if (clock.isRunning) {
        const elapsed = Date.now() - clock.lastUpdate;
        currentRemaining = Math.max(0, clock.timeRemaining - elapsed);
      }
      
      const totalSeconds = Math.ceil(currentRemaining / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      if (currentRemaining <= 60000 && currentRemaining > 0) {
        // Last minute: show tenths
        const tenths = Math.floor((currentRemaining % 1000) / 100);
        setDisplayTime(`${seconds}.${tenths}`);
      } else {
        setDisplayTime(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      }
      
      if (clock.isRunning) {
        animationFrameId = requestAnimationFrame(updateDisplay);
      }
    };

    updateDisplay();
    return () => cancelAnimationFrame(animationFrameId);
  }, [clock.isRunning, clock.timeRemaining, clock.lastUpdate]);

  const parseTime = (input: string): number | null => {
    input = input.trim();

    if (input.includes(":")) {
      const parts = input.split(":");
      if (parts.length === 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        if (!isNaN(mins) && !isNaN(secs)) {
          return (mins * 60 + secs) * 1000;
        }
      }
      return null;
    }

    const digits = input.replace(/\D/g, "");
    if (!digits) return null;

    const num = parseInt(digits);
    if (isNaN(num)) return null;

    if (digits.length <= 2) {
      return num * 1000;
    }

    if (digits.length === 3) {
      const mins = parseInt(digits[0]);
      const secs = parseInt(digits.slice(1));
      return (mins * 60 + secs) * 1000;
    }

    const secs = parseInt(digits.slice(-2));
    const mins = parseInt(digits.slice(0, -2));
    return (mins * 60 + secs) * 1000;
  };

  const handleSetClock = () => {
    const timeMs = parseTime(editValue);
    if (timeMs !== null) {
      setClock(timeMs);
    }
    setEditMode(false);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center justify-center gap-6">
      <div className="text-zinc-400 uppercase tracking-widest text-sm font-bold">{period} PERIOD</div>
      
      {editMode ? (
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="text-6xl font-mono font-bold bg-zinc-950 text-white w-48 text-center rounded-lg border border-zinc-700 focus:border-indigo-500 focus:outline-none"
            autoFocus
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => e.key === "Enter" && handleSetClock()}
            onBlur={handleSetClock}
          />
        </div>
      ) : (
        <div 
          className="text-7xl font-mono font-bold tracking-tighter cursor-pointer hover:text-indigo-400 transition-colors"
          onClick={() => {
            if (!clock.isRunning) {
              const totalSeconds = Math.ceil(clock.timeRemaining / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              setEditValue(`${minutes}:${seconds.toString().padStart(2, "0")}`);
              setEditMode(true);
            }
          }}
        >
          {displayTime}
        </div>
      )}

      <div className="flex gap-4 w-full">
        {clock.isRunning ? (
          <button 
            onClick={stopClock}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg transition-colors"
          >
            <Square fill="currentColor" size={20} /> STOP
          </button>
        ) : (
          <button 
            onClick={startClock}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg transition-colors"
          >
            <Play fill="currentColor" size={20} /> START
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-2 w-full">
        <button onClick={() => setClock(20 * 60 * 1000)} className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium">Reset 20:00</button>
        <button onClick={() => setClock(5 * 60 * 1000)} className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium">Reset 5:00</button>
      </div>
    </div>
  );
}

function SettingsPanel({ gameState, updateState }: { gameState: GameState, updateState: any }) {
  const { keyboardShortcuts, updateShortcut, resetShortcuts } = useStore();
  const updateTeam = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...gameState[`${team}Team`], ...updates } });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6 border-b border-zinc-800 pb-4">Home Team Settings</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Team Name</label>
            <input 
              type="text" 
              value={gameState.homeTeam.name}
              onChange={(e) => updateTeam("home", { name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Abbreviation (3 letters)</label>
            <input 
              type="text" 
              maxLength={3}
              value={gameState.homeTeam.abbreviation}
              onChange={(e) => updateTeam("home", { abbreviation: e.target.value.toUpperCase() })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Logo URL</label>
            <input 
              type="text" 
              value={gameState.homeTeam.logo}
              onChange={(e) => updateTeam("home", { logo: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Primary Color</label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={gameState.homeTeam.color}
                onChange={(e) => updateTeam("home", { color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer bg-zinc-950 border border-zinc-800"
              />
              <input 
                type="text" 
                value={gameState.homeTeam.color}
                onChange={(e) => updateTeam("home", { color: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6 border-b border-zinc-800 pb-4">Away Team Settings</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Team Name</label>
            <input 
              type="text" 
              value={gameState.awayTeam.name}
              onChange={(e) => updateTeam("away", { name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Abbreviation (3 letters)</label>
            <input 
              type="text" 
              maxLength={3}
              value={gameState.awayTeam.abbreviation}
              onChange={(e) => updateTeam("away", { abbreviation: e.target.value.toUpperCase() })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Logo URL</label>
            <input 
              type="text" 
              value={gameState.awayTeam.logo}
              onChange={(e) => updateTeam("away", { logo: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Primary Color</label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={gameState.awayTeam.color}
                onChange={(e) => updateTeam("away", { color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer bg-zinc-950 border border-zinc-800"
              />
              <input 
                type="text" 
                value={gameState.awayTeam.color}
                onChange={(e) => updateTeam("away", { color: e.target.value })}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 md:col-span-2">
        <div className="flex items-center justify-between mb-6 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Keyboard size={24} />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={resetShortcuts}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
        <div className="text-sm text-zinc-500 mb-4 italic">
          Note: Keyboard shortcuts only work on the Controls tab, not in Settings.
        </div>
        <div className="grid grid-cols-1 gap-3">
          {keyboardShortcuts.map((shortcut, index) => (
            <ShortcutEditor
              key={index}
              shortcut={shortcut}
              onUpdate={(updated) => updateShortcut(index, updated)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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

function PresetsPanel({ gameState, updateState }: { gameState: GameState; updateState: any }) {
  const [presets, setPresets] = useState<TeamPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [error, setError] = useState("");

  const loadPresets = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:3000/api/team-presets");
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
    loadPresets();
  }, []);

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) return;

    setError("");
    try {
      const response = await fetch("http://localhost:3000/api/team-presets", {
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
      const response = await fetch(`http://localhost:3000/api/team-presets/${encodeURIComponent(name)}`, {
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
      await fetch("http://localhost:3000/api/team-defaults", {
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

      <div className="mt-5 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-4 text-sm text-zinc-400">Loading presets...</div>
        ) : presets.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500 italic">No presets saved yet.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {presets
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((preset) => (
                <div key={preset.name} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-zinc-100 truncate">{preset.name}</div>
                    <div className="text-sm text-zinc-400 truncate">
                      {preset.homeTeam.abbreviation} vs {preset.awayTeam.abbreviation}
                    </div>
                  </div>
                  <button
                    onClick={() => loadPresetIntoGame(preset)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded text-sm font-medium"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deletePreset(preset.name)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PenaltyItem({
  penalty,
  onChange,
  onRemove,
  autoFocusPlayer = false,
  onAutoFocusHandled,
}: {
  penalty: Penalty;
  onChange: (penalty: Penalty) => void;
  onRemove: () => void;
  autoFocusPlayer?: boolean;
  onAutoFocusHandled?: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("2:00");
  const playerInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocusPlayer) return;
    playerInputRef.current?.focus();
    playerInputRef.current?.select();
    onAutoFocusHandled?.();
  }, [autoFocusPlayer, onAutoFocusHandled]);

  const commitPlayerNumber = (value: string) => {
    const nextPlayerNumber = value.replace(/\D/g, "").slice(0, 2);
    onChange({ ...penalty, playerNumber: nextPlayerNumber });
    return nextPlayerNumber;
  };

  const formatPenaltyTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleTimeChange = () => {
    const parts = editValue.split(":");
    if (parts.length === 2) {
      const mins = parseInt(parts[0]);
      const secs = parseInt(parts[1]);
      if (!isNaN(mins) && !isNaN(secs)) {
        const timeMs = (mins * 60 + secs) * 1000;
        onChange({ ...penalty, timeRemaining: timeMs, duration: timeMs });
      }
    }
    setEditMode(false);
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800">
      <input
        ref={playerInputRef}
        type="text"
        value={penalty.playerNumber}
        onChange={(e) => {
          const nextPlayerNumber = commitPlayerNumber(e.target.value);
          if (nextPlayerNumber.length === 2) {
            e.currentTarget.blur();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitPlayerNumber((e.target as HTMLInputElement).value);
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commitPlayerNumber(e.target.value)}
        className="w-12 bg-zinc-800 text-center rounded p-1 text-sm font-mono"
        placeholder="#"
        inputMode="numeric"
      />
      {editMode ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTimeChange()}
            onBlur={handleTimeChange}
            className="bg-zinc-800 rounded p-1 text-sm font-mono flex-1 text-center"
            autoFocus
            placeholder="M:SS"
          />
        </div>
      ) : (
        <div
          className="bg-zinc-800 rounded p-1 text-sm flex-1 text-center font-mono cursor-pointer hover:bg-zinc-700"
          onClick={() => {
            setEditValue(formatPenaltyTime(penalty.timeRemaining));
            setEditMode(true);
          }}
        >
          {formatPenaltyTime(penalty.timeRemaining)}
        </div>
      )}
      <button
        onClick={onRemove}
        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}

function ShortcutEditor({ shortcut, onUpdate }: { shortcut: KeyboardShortcut; onUpdate: (shortcut: KeyboardShortcut) => void }) {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore if only modifier keys are pressed
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      const key = e.key === " " ? " " : e.key.length === 1 ? e.key.toLowerCase() : e.key;

      onUpdate({
        ...shortcut,
        key,
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
      });

      setIsRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, shortcut, onUpdate]);

  const formatKey = (shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.shift) parts.push("Shift");

    const keyName = shortcut.key === " " ? "Space" :
                    shortcut.key === "ArrowUp" ? "↑" :
                    shortcut.key === "ArrowDown" ? "↓" :
                    shortcut.key === "ArrowLeft" ? "←" :
                    shortcut.key === "ArrowRight" ? "→" :
                    shortcut.key.toUpperCase();

    parts.push(keyName);
    return parts.join(" + ");
  };

  return (
    <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-lg border border-zinc-800">
      <span className="text-zinc-300 flex-1">{shortcut.description}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRecording(true)}
          className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
            isRecording
              ? "bg-indigo-600 text-white animate-pulse"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          }`}
        >
          {isRecording ? "Press any key..." : formatKey(shortcut)}
        </button>
        {isRecording && (
          <button
            onClick={() => setIsRecording(false)}
            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
