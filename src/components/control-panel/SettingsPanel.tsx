import { useState } from "react";
import { Keyboard, Users, FileText } from "lucide-react";
import { GameState, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import ShortcutEditor from "./ShortcutEditor";
import PdfLayoutSettings from "./PdfLayoutSettings";
import TeamEditorFields from "../team/TeamEditorFields";

interface SettingsPanelProps {
  gameState: GameState;
  updateState: UpdateGameState;
}

const SHORTCUT_GROUPS = [
  {
    title: "Clock",
    description: "Start/stop and adjust game time.",
    actions: ["toggleClock", "clockIncrease", "clockDecrease", "prevPeriod", "nextPeriod"] as const,
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
  const [settingsTab, setSettingsTab] = useState<"teams" | "shortcuts" | "pdf">("teams");

  const baseUrl = (() => {
    // @ts-ignore
    const envBase = import.meta.env.VITE_BASE_URL || window.location.origin;
    return envBase.replace(/\/+$/, "");
  })();

  const updateTeam = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...gameState[`${team}Team`], ...updates } });
  };

  const shortcutsByAction = new Map(keyboardShortcuts.map((shortcut, index) => [shortcut.action, { shortcut, index }]));
  const groupedActions = new Set(SHORTCUT_GROUPS.flatMap((group) => [...group.actions]));
  const ungroupedShortcuts = keyboardShortcuts
    .map((shortcut, index) => ({ shortcut, index }))
    .filter(({ shortcut }) => !groupedActions.has(shortcut.action));

  return (
    <div className="flex flex-col gap-6">
      <div className="inline-flex self-start rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setSettingsTab("teams")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsTab === "teams"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Users size={15} /> Teams &amp; Rosters
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("shortcuts")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsTab === "shortcuts"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Keyboard size={15} /> Keyboard Shortcuts
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("pdf")}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsTab === "pdf"
              ? "bg-indigo-500/20 border border-indigo-400/30 text-white"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <FileText size={15} /> Gamesheet PDF
        </button>
      </div>

      {settingsTab === "teams" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <TeamEditorFields
          title="Home Team Settings"
          identity={{
            name: gameState.homeTeam.name,
            abbreviation: gameState.homeTeam.abbreviation,
            logo: gameState.homeTeam.logo,
            color: gameState.homeTeam.color,
          }}
          onIdentityCommit={(updates) => updateTeam("home", updates)}
          colorLabel="Home team color"
          roster={gameState.homeTeam.players ?? []}
          onRosterChange={(players) => updateTeam("home", { players })}
        />
        <TeamEditorFields
          title="Away Team Settings"
          identity={{
            name: gameState.awayTeam.name,
            abbreviation: gameState.awayTeam.abbreviation,
            logo: gameState.awayTeam.logo,
            color: gameState.awayTeam.color,
          }}
          onIdentityCommit={(updates) => updateTeam("away", updates)}
          colorLabel="Away team color"
          roster={gameState.awayTeam.players ?? []}
          onRosterChange={(players) => updateTeam("away", { players })}
        />
      </div>
      )}

      {settingsTab === "shortcuts" && (
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Keyboard size={24} />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={resetShortcuts}
            className="px-4 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-sm font-medium transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
        <div className="text-sm text-zinc-500 mb-4 italic">
          Note: Keyboard shortcuts only work on the Controls tab, not in Settings.
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="border border-white/10 rounded-lg bg-white/[0.03] p-4">
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
        <section className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
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
      </div>
      )}

      {settingsTab === "pdf" && (
        <PdfLayoutSettings homeTeam={gameState.homeTeam} awayTeam={gameState.awayTeam} eventLog={gameState.eventLog} />
      )}
    </div>
  );
}
