import { useEffect, useState } from "react";
import { Keyboard } from "lucide-react";
import { GameState, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import ShortcutEditor from "./ShortcutEditor";

interface SettingsPanelProps {
  gameState: GameState;
  updateState: UpdateGameState;
}

const SHORTCUT_GROUPS = [
  {
    title: "Clock",
    description: "Start/stop and adjust game time.",
    actions: ["toggleClock", "clockIncrease", "clockDecrease"] as const,
  },
  {
    title: "Scoring",
    description: "Increment or revoke goals.",
    actions: ["homeScoreUp", "awayScoreUp", "homeScoreDown", "awayScoreDown"] as const,
  },
  {
    title: "Shots",
    description: "Adjust shots on goal.",
    actions: ["homeShotsUp", "awayShotsUp", "homeShotsDown", "awayShotsDown"] as const,
  },
  {
    title: "Penalties",
    description: "Add or remove active penalties.",
    actions: [
      "homePenaltyAdd",
      "awayPenaltyAdd",
      "homePenaltyRemoveEarliest",
      "awayPenaltyRemoveEarliest",
    ] as const,
  },
];

export default function SettingsPanel({ gameState, updateState }: SettingsPanelProps) {
  const { keyboardShortcuts, updateShortcut, resetShortcuts } = useStore();
  const [homeName, setHomeName] = useState(gameState.homeTeam.name);
  const [homeAbbr, setHomeAbbr] = useState(gameState.homeTeam.abbreviation);
  const [homeLogo, setHomeLogo] = useState(gameState.homeTeam.logo);
  const [homeColorText, setHomeColorText] = useState(gameState.homeTeam.color);
  const [awayName, setAwayName] = useState(gameState.awayTeam.name);
  const [awayAbbr, setAwayAbbr] = useState(gameState.awayTeam.abbreviation);
  const [awayLogo, setAwayLogo] = useState(gameState.awayTeam.logo);
  const [awayColorText, setAwayColorText] = useState(gameState.awayTeam.color);

  const normalizeHexInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  const updateTeam = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...gameState[`${team}Team`], ...updates } });
  };

  const commitTeamField = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateTeam(team, updates);
  };

  useEffect(() => {
    setHomeName(gameState.homeTeam.name);
    setHomeAbbr(gameState.homeTeam.abbreviation);
    setHomeLogo(gameState.homeTeam.logo);
    setHomeColorText(gameState.homeTeam.color);
    setAwayName(gameState.awayTeam.name);
    setAwayAbbr(gameState.awayTeam.abbreviation);
    setAwayLogo(gameState.awayTeam.logo);
    setAwayColorText(gameState.awayTeam.color);
  }, [gameState.homeTeam, gameState.awayTeam]);

  const shortcutsByAction = new Map(keyboardShortcuts.map((shortcut, index) => [shortcut.action, { shortcut, index }]));
  const groupedActions = new Set(SHORTCUT_GROUPS.flatMap((group) => [...group.actions]));
  const ungroupedShortcuts = keyboardShortcuts
    .map((shortcut, index) => ({ shortcut, index }))
    .filter(({ shortcut }) => !groupedActions.has(shortcut.action));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-xl font-bold mb-6 border-b border-zinc-800 pb-4">Home Team Settings</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Team Name</label>
            <input
              type="text"
              value={homeName}
              onChange={(e) => setHomeName(e.target.value)}
              onBlur={() => commitTeamField("home", { name: homeName })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("home", { name: homeName });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Abbreviation (3 letters)</label>
            <input
              type="text"
              maxLength={3}
              value={homeAbbr}
              onChange={(e) => setHomeAbbr(e.target.value.toUpperCase())}
              onBlur={() => commitTeamField("home", { abbreviation: homeAbbr.toUpperCase() })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("home", { abbreviation: homeAbbr.toUpperCase() });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Logo URL</label>
            <input
              type="text"
              value={homeLogo}
              onChange={(e) => setHomeLogo(e.target.value)}
              onBlur={() => commitTeamField("home", { logo: homeLogo })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("home", { logo: homeLogo });
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
                value={homeColorText}
                onChange={(e) => setHomeColorText(e.target.value)}
                onBlur={() => commitTeamField("home", { color: normalizeHexInput(homeColorText) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTeamField("home", { color: normalizeHexInput(homeColorText) });
                    (e.target as HTMLInputElement).blur();
                  }
                }}
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
              value={awayName}
              onChange={(e) => setAwayName(e.target.value)}
              onBlur={() => commitTeamField("away", { name: awayName })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("away", { name: awayName });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Abbreviation (3 letters)</label>
            <input
              type="text"
              maxLength={3}
              value={awayAbbr}
              onChange={(e) => setAwayAbbr(e.target.value.toUpperCase())}
              onBlur={() => commitTeamField("away", { abbreviation: awayAbbr.toUpperCase() })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("away", { abbreviation: awayAbbr.toUpperCase() });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Logo URL</label>
            <input
              type="text"
              value={awayLogo}
              onChange={(e) => setAwayLogo(e.target.value)}
              onBlur={() => commitTeamField("away", { logo: awayLogo })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTeamField("away", { logo: awayLogo });
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
                value={awayColorText}
                onChange={(e) => setAwayColorText(e.target.value)}
                onBlur={() => commitTeamField("away", { color: normalizeHexInput(awayColorText) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTeamField("away", { color: normalizeHexInput(awayColorText) });
                    (e.target as HTMLInputElement).blur();
                  }
                }}
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="border border-zinc-800 rounded-lg bg-zinc-950/70 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">{group.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">{group.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                {group.actions.map((action) => {
                  const entry = shortcutsByAction.get(action);
                  if (!entry) return null;
                  return (
                    <ShortcutEditor
                      key={entry.index}
                      shortcut={entry.shortcut}
                      onUpdate={(updated) => updateShortcut(entry.index, updated)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {ungroupedShortcuts.length > 0 && (
          <section className="border border-zinc-800 rounded-lg bg-zinc-950/70 p-4 mt-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-200">Other</h3>
              <p className="text-xs text-zinc-500 mt-1">Shortcuts not assigned to a standard group.</p>
            </div>
            <div className="flex flex-col gap-2">
              {ungroupedShortcuts.map(({ shortcut, index }) => (
                <ShortcutEditor key={index} shortcut={shortcut} onUpdate={(updated) => updateShortcut(index, updated)} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-4 text-xs text-zinc-600">
          Tip: click any shortcut button and press a new key combination to remap.
        </div>
      </div>
    </div>
  );
}
