import { useState } from "react";
import { Keyboard, Users, FileText } from "lucide-react";
import { GameState, TeamState, useStore } from "../../store";
import { getBaseUrl } from "../../lib/localMode";
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
    const envBase = getBaseUrl();
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
      <div className="inline-flex self-start rounded-sm border border-line bg-canvas p-1 gap-1">
        <button
          type="button"
          onClick={() => setSettingsTab("teams")}
          className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition-colors ${
            settingsTab === "teams"
              ? "bg-ink border border-ink text-canvas"
              : "border border-transparent text-muted hover:text-ink"
          }`}
        >
          <Users size={15} /> Teams and rosters
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("shortcuts")}
          className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition-colors ${
            settingsTab === "shortcuts"
              ? "bg-ink border border-ink text-canvas"
              : "border border-transparent text-muted hover:text-ink"
          }`}
        >
          <Keyboard size={15} /> Keyboard shortcuts
        </button>
        <button
          type="button"
          onClick={() => setSettingsTab("pdf")}
          className={`flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-semibold transition-colors ${
            settingsTab === "pdf"
              ? "bg-ink border border-ink text-canvas"
              : "border border-transparent text-muted hover:text-ink"
          }`}
        >
          <FileText size={15} /> Gamesheet PDF
        </button>
      </div>

      {settingsTab === "teams" && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <TeamEditorFields
          title="Home team settings"
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
          title="Away team settings"
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
      <div className="bg-canvas border border-line rounded-sm p-6">
        <div className="flex items-center justify-between mb-6 border-b border-line pb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Keyboard size={24} />
            Keyboard shortcuts
          </h2>
          <button
            onClick={resetShortcuts}
            className="px-4 py-2 bg-canvas border border-line hover:bg-surface rounded-sm text-sm font-semibold transition-colors"
          >
            Reset to defaults
          </button>
        </div>
        <div className="text-sm text-muted mb-4">
          Note: Keyboard shortcuts only work on the Controls tab, not in Settings.
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-ink">{group.title}</h3>
                <p className="text-xs text-muted mt-1">{group.description}</p>
              </div>
              <div className="flex flex-col border-t border-line">
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
        <section className="bg-canvas border border-line rounded-sm p-6">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-ink">Other</h3>
            <p className="text-xs text-muted mt-1">Shortcuts not assigned to a standard group.</p>
          </div>
          <div className="flex flex-col border-t border-line">
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
