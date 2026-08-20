import { useEffect, useRef, useState } from "react";
import { Keyboard, ChevronDown, Users, FileText } from "lucide-react";
import { GameState, PlayerPosition, TeamPlayer, TeamState, useStore } from "../../store";
import { UpdateGameState } from "./types";
import ShortcutEditor from "./ShortcutEditor";
import PdfLayoutSettings from "./PdfLayoutSettings";

interface SettingsPanelProps {
  gameState: GameState;
  updateState: UpdateGameState;
}

interface TeamMeta {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  players: TeamPlayer[];
}

const rostersEqual = (a: TeamPlayer[], b: TeamPlayer[]) =>
  a.length === b.length &&
  a.every((player, i) => {
    const other = b[i];
    return (
      player.id === other.id &&
      player.jerseyNumber === other.jerseyNumber &&
      player.name === other.name &&
      player.position === other.position
    );
  });

const teamMetaEqual = (a: TeamMeta, b: TeamMeta) =>
  a.name === b.name &&
  a.abbreviation === b.abbreviation &&
  a.logo === b.logo &&
  a.color === b.color &&
  rostersEqual(a.players, b.players);

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
  const [homeName, setHomeName] = useState(gameState.homeTeam.name);
  const [homeAbbr, setHomeAbbr] = useState(gameState.homeTeam.abbreviation);
  const [homeLogo, setHomeLogo] = useState(gameState.homeTeam.logo);
  const [homeColorText, setHomeColorText] = useState(gameState.homeTeam.color);
  const [awayName, setAwayName] = useState(gameState.awayTeam.name);
  const [awayAbbr, setAwayAbbr] = useState(gameState.awayTeam.abbreviation);
  const [awayLogo, setAwayLogo] = useState(gameState.awayTeam.logo);
  const [awayColorText, setAwayColorText] = useState(gameState.awayTeam.color);
  const [homeRosterDraft, setHomeRosterDraft] = useState<TeamPlayer[]>(gameState.homeTeam.players ?? []);
  const [awayRosterDraft, setAwayRosterDraft] = useState<TeamPlayer[]>(gameState.awayTeam.players ?? []);
  const [homeRosterExpanded, setHomeRosterExpanded] = useState(false);
  const [awayRosterExpanded, setAwayRosterExpanded] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"teams" | "shortcuts" | "pdf">("teams");
  const homeRosterRef = useRef<HTMLDivElement | null>(null);
  const awayRosterRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<{ home?: string; away?: string }>({});
  const lastSyncedTeamMetaRef = useRef<{ home: TeamMeta; away: TeamMeta } | null>(null);

  const baseUrl = (() => {
    // @ts-ignore
    const envBase = import.meta.env.VITE_BASE_URL || window.location.origin;
    return envBase.replace(/\/+$/, "");
  })();

  const normalizeHexInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  };

  const updateTeam = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateState({ [`${team}Team`]: { ...gameState[`${team}Team`], ...updates } });
  };

  const sanitizeJerseyNumber = (value: string) => value.replace(/\D/g, "").slice(0, 2);

  const updateTeamPlayers = (team: "home" | "away", nextPlayers: TeamPlayer[]) => {
    updateTeam(team, { players: nextPlayers });
  };

  const updateDraftPlayers = (team: "home" | "away", nextPlayers: TeamPlayer[]) => {
    if (team === "home") {
      setHomeRosterDraft(nextPlayers);
    } else {
      setAwayRosterDraft(nextPlayers);
    }
  };

  const updateDraftPlayer = (team: "home" | "away", playerId: string, updates: Partial<TeamPlayer>) => {
    const currentPlayers = team === "home" ? homeRosterDraft : awayRosterDraft;
    const nextPlayers = currentPlayers.map((player) => (player.id === playerId ? { ...player, ...updates } : player));
    updateDraftPlayers(team, nextPlayers);
  };

  const commitDraftPlayer = (
    team: "home" | "away",
    playerId: string,
    updates: Partial<TeamPlayer>,
    sortIfComplete: boolean,
  ) => {
    const currentPlayers = team === "home" ? homeRosterDraft : awayRosterDraft;
    const nextPlayers = currentPlayers.map((player) => (player.id === playerId ? { ...player, ...updates } : player));
    const target = nextPlayers.find((player) => player.id === playerId);
    const hasNumber = Boolean(target?.jerseyNumber?.trim());
    const hasName = Boolean(target?.name?.trim());
    const shouldSort = sortIfComplete && hasNumber && hasName;
    const finalPlayers = shouldSort ? sortPlayersByJersey(nextPlayers) : nextPlayers;
    updateDraftPlayers(team, finalPlayers);
    updateTeamPlayers(team, finalPlayers);
  };

  const sortPlayersByJersey = (players: TeamPlayer[]) =>
    players.slice().sort((a, b) => {
      const aNumber = Number.parseInt(a.jerseyNumber, 10);
      const bNumber = Number.parseInt(b.jerseyNumber, 10);
      const aValid = Number.isFinite(aNumber);
      const bValid = Number.isFinite(bNumber);
      if (aValid && bValid) return aNumber - bNumber;
      if (aValid) return -1;
      if (bValid) return 1;
      return a.jerseyNumber.localeCompare(b.jerseyNumber);
    });

  const addTeamPlayer = (team: "home" | "away") => {
    const currentPlayers = team === "home" ? homeRosterDraft : awayRosterDraft;
    const nextPlayer: TeamPlayer = {
      id: Math.random().toString(36).slice(2, 11),
      jerseyNumber: "",
      name: "",
      position: "",
    };
    const nextPlayers = sortPlayersByJersey([...currentPlayers, nextPlayer]);
    updateDraftPlayers(team, nextPlayers);
    updateTeamPlayers(team, nextPlayers);
    if (team === "home") {
      pendingFocusRef.current.home = nextPlayer.id;
      requestAnimationFrame(() => {
        const targetId = pendingFocusRef.current.home;
        if (!targetId) return;
        const input = homeRosterRef.current?.querySelector<HTMLInputElement>(
          `[data-player-input="${targetId}"]`,
        );
        if (input) {
          input.focus();
          input.select();
          pendingFocusRef.current.home = undefined;
        }
      });
    } else {
      pendingFocusRef.current.away = nextPlayer.id;
      requestAnimationFrame(() => {
        const targetId = pendingFocusRef.current.away;
        if (!targetId) return;
        const input = awayRosterRef.current?.querySelector<HTMLInputElement>(
          `[data-player-input="${targetId}"]`,
        );
        if (input) {
          input.focus();
          input.select();
          pendingFocusRef.current.away = undefined;
        }
      });
    }
  };

  const removeTeamPlayer = (team: "home" | "away", playerId: string) => {
    const currentPlayers = team === "home" ? homeRosterDraft : awayRosterDraft;
    const nextPlayers = currentPlayers.filter((player) => player.id !== playerId);
    updateDraftPlayers(team, nextPlayers);
    updateTeamPlayers(team, nextPlayers);
  };

  const commitTeamField = (team: "home" | "away", updates: Partial<TeamState>) => {
    updateTeam(team, updates);
  };

  useEffect(() => {
    const home = gameState.homeTeam;
    const away = gameState.awayTeam;
    const homeMeta = { name: home.name, abbreviation: home.abbreviation, logo: home.logo, color: home.color, players: home.players ?? [] };
    const awayMeta = { name: away.name, abbreviation: away.abbreviation, logo: away.logo, color: away.color, players: away.players ?? [] };
    const last = lastSyncedTeamMetaRef.current;

    // gameState.homeTeam/awayTeam get new object references on every broadcast —
    // including the ~10/sec clock-tick broadcasts while the clock is running, which
    // don't touch name/abbreviation/logo/color/roster at all. Resetting drafts on
    // every such tick wiped out whatever the operator was mid-typing, so only reset
    // when the actual team metadata changed (e.g. another device edited it, or a
    // saved game was loaded).
    const homeChanged = !last || !teamMetaEqual(last.home, homeMeta);
    const awayChanged = !last || !teamMetaEqual(last.away, awayMeta);

    if (homeChanged) {
      setHomeName(homeMeta.name);
      setHomeAbbr(homeMeta.abbreviation);
      setHomeLogo(homeMeta.logo);
      setHomeColorText(homeMeta.color);
      setHomeRosterDraft(homeMeta.players);
    }
    if (awayChanged) {
      setAwayName(awayMeta.name);
      setAwayAbbr(awayMeta.abbreviation);
      setAwayLogo(awayMeta.logo);
      setAwayColorText(awayMeta.color);
      setAwayRosterDraft(awayMeta.players);
    }

    lastSyncedTeamMetaRef.current = { home: homeMeta, away: awayMeta };
  }, [gameState.homeTeam, gameState.awayTeam]);

  const shortcutsByAction = new Map(keyboardShortcuts.map((shortcut, index) => [shortcut.action, { shortcut, index }]));
  const groupedActions = new Set(SHORTCUT_GROUPS.flatMap((group) => [...group.actions]));
  const ungroupedShortcuts = keyboardShortcuts
    .map((shortcut, index) => ({ shortcut, index }))
    .filter(({ shortcut }) => !groupedActions.has(shortcut.action));

  const homePlayerCount = homeRosterDraft.length;
  const awayPlayerCount = awayRosterDraft.length;

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
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold">Home Team Settings</h2>
        </div>
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Primary Color</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={gameState.homeTeam.color}
                onChange={(e) => updateTeam("home", { color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer bg-zinc-950 border border-white/10"
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
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-400">
                Roster
                <span className="ml-2 inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                  {homePlayerCount} players
                </span>
              </label>
              <button
                type="button"
                onClick={() => setHomeRosterExpanded((prev) => !prev)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-zinc-200"
                aria-label={homeRosterExpanded ? "Collapse home roster" : "Expand home roster"}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${homeRosterExpanded ? "rotate-180" : "rotate-0"}`}
                />
              </button>
            </div>
            {homeRosterExpanded && (
              <div ref={homeRosterRef} className="flex flex-col gap-2">
                {homeRosterDraft.map((player) => (
                  <div key={player.id} className="grid grid-cols-[70px_1fr_74px_64px] gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={player.jerseyNumber}
                      data-player-input={player.id}
                      onChange={(e) =>
                        updateDraftPlayer("home", player.id, {
                          jerseyNumber: sanitizeJerseyNumber(e.target.value),
                        })
                      }
                      onBlur={(e) =>
                        commitDraftPlayer(
                          "home",
                          player.id,
                          { jerseyNumber: sanitizeJerseyNumber(e.target.value) },
                          true,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitDraftPlayer(
                            "home",
                            player.id,
                            { jerseyNumber: sanitizeJerseyNumber((e.target as HTMLInputElement).value) },
                            true,
                          );
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none font-mono"
                      placeholder="#"
                    />
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updateDraftPlayer("home", player.id, { name: e.target.value })}
                      onBlur={(e) =>
                        commitDraftPlayer("home", player.id, { name: e.target.value }, true)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitDraftPlayer(
                            "home",
                            player.id,
                            { name: (e.target as HTMLInputElement).value },
                            true,
                          );
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="Player name"
                    />
                    <select
                      value={player.position ?? ""}
                      onChange={(e) =>
                        commitDraftPlayer(
                          "home",
                          player.id,
                          { position: e.target.value as PlayerPosition },
                          false,
                        )
                      }
                      className="control-panel-select bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-</option>
                      <option value="NM">NM</option>
                      <option value="A">A</option>
                      <option value="C">C</option>
                    </select>
                    <button
                      type="button"
                      aria-label="Remove player"
                      title="Remove player"
                      onClick={() => removeTeamPlayer("home", player.id)}
                      className="px-2 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {homeRosterDraft.length === 0 && (
                  <div className="text-xs text-zinc-500 italic">No players added.</div>
                )}
                <button
                  type="button"
                  onClick={() => addTeamPlayer("home")}
                  className="mt-2 w-full px-3 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium text-zinc-100"
                >
                  Add Player
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <div className="mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold">Away Team Settings</h2>
        </div>
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Primary Color</label>
            <div className="flex gap-3">
              <input
                type="color"
                value={gameState.awayTeam.color}
                onChange={(e) => updateTeam("away", { color: e.target.value })}
                className="w-12 h-12 rounded cursor-pointer bg-zinc-950 border border-white/10"
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
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none font-mono"
              />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-400">
                Roster
                <span className="ml-2 inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                  {awayPlayerCount} players
                </span>
              </label>
              <button
                type="button"
                onClick={() => setAwayRosterExpanded((prev) => !prev)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-zinc-200"
                aria-label={awayRosterExpanded ? "Collapse away roster" : "Expand away roster"}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${awayRosterExpanded ? "rotate-180" : "rotate-0"}`}
                />
              </button>
            </div>
            {awayRosterExpanded && (
              <div ref={awayRosterRef} className="flex flex-col gap-2">
                {awayRosterDraft.map((player) => (
                  <div key={player.id} className="grid grid-cols-[70px_1fr_74px_64px] gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={player.jerseyNumber}
                      data-player-input={player.id}
                      onChange={(e) =>
                        updateDraftPlayer("away", player.id, {
                          jerseyNumber: sanitizeJerseyNumber(e.target.value),
                        })
                      }
                      onBlur={(e) =>
                        commitDraftPlayer(
                          "away",
                          player.id,
                          { jerseyNumber: sanitizeJerseyNumber(e.target.value) },
                          true,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitDraftPlayer(
                            "away",
                            player.id,
                            { jerseyNumber: sanitizeJerseyNumber((e.target as HTMLInputElement).value) },
                            true,
                          );
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none font-mono"
                      placeholder="#"
                    />
                    <input
                      type="text"
                      value={player.name}
                      onChange={(e) => updateDraftPlayer("away", player.id, { name: e.target.value })}
                      onBlur={(e) =>
                        commitDraftPlayer("away", player.id, { name: e.target.value }, true)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitDraftPlayer(
                            "away",
                            player.id,
                            { name: (e.target as HTMLInputElement).value },
                            true,
                          );
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none"
                      placeholder="Player name"
                    />
                    <select
                      value={player.position ?? ""}
                      onChange={(e) =>
                        commitDraftPlayer(
                          "away",
                          player.id,
                          { position: e.target.value as PlayerPosition },
                          false,
                        )
                      }
                      className="control-panel-select bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-</option>
                      <option value="NM">NM</option>
                      <option value="A">A</option>
                      <option value="C">C</option>
                    </select>
                    <button
                      type="button"
                      aria-label="Remove player"
                      title="Remove player"
                      onClick={() => removeTeamPlayer("away", player.id)}
                      className="px-2 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {awayRosterDraft.length === 0 && (
                  <div className="text-xs text-zinc-500 italic">No players added.</div>
                )}
                <button
                  type="button"
                  onClick={() => addTeamPlayer("away")}
                  className="mt-2 w-full px-3 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium text-zinc-100"
                >
                  Add Player
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
