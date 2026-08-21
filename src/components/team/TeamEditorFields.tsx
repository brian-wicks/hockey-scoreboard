import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { PlayerPosition, TeamPlayer } from "../../store";
import { ColorPicker } from "../control-panel/ui/ColorPicker";

export interface TeamIdentityDraft {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
}

interface TeamEditorFieldsProps {
  title?: string;
  identity: TeamIdentityDraft;
  onIdentityCommit: (updates: Partial<TeamIdentityDraft>) => void;
  colorLabel: string;
  roster: TeamPlayer[];
  onRosterChange: (players: TeamPlayer[]) => void;
  rosterExpandedDefault?: boolean;
  /** False when already nested inside another blurred/bordered container (e.g. a modal) — skips
   * this component's own outer glass panel so blur/border don't stack on top of the parent's. */
  framed?: boolean;
}

const identityEqual = (a: TeamIdentityDraft, b: TeamIdentityDraft) =>
  a.name === b.name && a.abbreviation === b.abbreviation && a.logo === b.logo && a.color === b.color;

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

const sanitizeJerseyNumber = (value: string) => value.replace(/\D/g, "").slice(0, 2);

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

/**
 * Team identity + roster editor. Owns its own text-input draft state so typing stays
 * snappy while the caller decides when to persist (on blur/Enter, via onIdentityCommit /
 * onRosterChange) — SettingsPanel commits straight to the live socket; a local form
 * (New Game wizard, Team Manager) just commits to its own draft state instead.
 */
export default function TeamEditorFields({
  title,
  identity,
  onIdentityCommit,
  colorLabel,
  roster,
  onRosterChange,
  rosterExpandedDefault = false,
  framed = true,
}: TeamEditorFieldsProps) {
  const [name, setName] = useState(identity.name);
  const [abbreviation, setAbbreviation] = useState(identity.abbreviation);
  const [logo, setLogo] = useState(identity.logo);
  const [rosterDraft, setRosterDraft] = useState<TeamPlayer[]>(roster);
  const [rosterExpanded, setRosterExpanded] = useState(rosterExpandedDefault);
  const rosterRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<string | undefined>(undefined);
  const lastSyncedRef = useRef<{ identity: TeamIdentityDraft; roster: TeamPlayer[] }>({
    identity,
    roster,
  });

  useEffect(() => {
    const last = lastSyncedRef.current;
    if (!identityEqual(last.identity, identity)) {
      setName(identity.name);
      setAbbreviation(identity.abbreviation);
      setLogo(identity.logo);
    }
    if (!rostersEqual(last.roster, roster)) {
      setRosterDraft(roster);
    }
    lastSyncedRef.current = { identity, roster };
  }, [identity, roster]);

  const commitDraftPlayer = (playerId: string, updates: Partial<TeamPlayer>, sortIfComplete: boolean) => {
    const nextPlayers = rosterDraft.map((player) => (player.id === playerId ? { ...player, ...updates } : player));
    const target = nextPlayers.find((player) => player.id === playerId);
    const hasNumber = Boolean(target?.jerseyNumber?.trim());
    const hasName = Boolean(target?.name?.trim());
    const shouldSort = sortIfComplete && hasNumber && hasName;
    const finalPlayers = shouldSort ? sortPlayersByJersey(nextPlayers) : nextPlayers;
    setRosterDraft(finalPlayers);
    onRosterChange(finalPlayers);
  };

  const updateDraftPlayer = (playerId: string, updates: Partial<TeamPlayer>) => {
    setRosterDraft((current) => current.map((player) => (player.id === playerId ? { ...player, ...updates } : player)));
  };

  const addPlayer = () => {
    const nextPlayer: TeamPlayer = {
      id: Math.random().toString(36).slice(2, 11),
      jerseyNumber: "",
      name: "",
      position: "",
    };
    const nextPlayers = sortPlayersByJersey([...rosterDraft, nextPlayer]);
    setRosterDraft(nextPlayers);
    onRosterChange(nextPlayers);
    pendingFocusRef.current = nextPlayer.id;
    requestAnimationFrame(() => {
      const targetId = pendingFocusRef.current;
      if (!targetId) return;
      const input = rosterRef.current?.querySelector<HTMLInputElement>(`[data-player-input="${targetId}"]`);
      if (input) {
        input.focus();
        input.select();
        pendingFocusRef.current = undefined;
      }
    });
  };

  const removePlayer = (playerId: string) => {
    const nextPlayers = rosterDraft.filter((player) => player.id !== playerId);
    setRosterDraft(nextPlayers);
    onRosterChange(nextPlayers);
  };

  return (
    <div className={framed ? "bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6" : undefined}>
      {title && (
        <div className="mb-6 border-b border-white/10 pb-4">
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Team Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => onIdentityCommit({ name })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onIdentityCommit({ name });
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
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
            onBlur={() => onIdentityCommit({ abbreviation: abbreviation.toUpperCase() })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onIdentityCommit({ abbreviation: abbreviation.toUpperCase() });
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
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            onBlur={() => onIdentityCommit({ logo })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onIdentityCommit({ logo });
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="https://example.com/logo.png"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Primary Color</label>
          <ColorPicker value={identity.color} onChange={(hex) => onIdentityCommit({ color: hex })} label={colorLabel} />
        </div>
        <div className="pt-3 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-zinc-400">
              Roster
              <span className="ml-2 inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                {rosterDraft.length} players
              </span>
            </label>
            <button
              type="button"
              onClick={() => setRosterExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-zinc-200"
              aria-label={rosterExpanded ? "Collapse roster" : "Expand roster"}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${rosterExpanded ? "rotate-180" : "rotate-0"}`} />
            </button>
          </div>
          {rosterExpanded && (
            <div ref={rosterRef} className="flex flex-col gap-2">
              {rosterDraft.map((player) => (
                <div key={player.id} className="grid grid-cols-[70px_1fr_74px_64px] gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={player.jerseyNumber}
                    data-player-input={player.id}
                    onChange={(e) => updateDraftPlayer(player.id, { jerseyNumber: sanitizeJerseyNumber(e.target.value) })}
                    onBlur={(e) => commitDraftPlayer(player.id, { jerseyNumber: sanitizeJerseyNumber(e.target.value) }, true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDraftPlayer(
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
                    onChange={(e) => updateDraftPlayer(player.id, { name: e.target.value })}
                    onBlur={(e) => commitDraftPlayer(player.id, { name: e.target.value }, true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDraftPlayer(player.id, { name: (e.target as HTMLInputElement).value }, true);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="bg-white/[0.05] border border-white/10 rounded-lg px-2 py-2 text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="Player name"
                  />
                  <select
                    value={player.position ?? ""}
                    onChange={(e) => commitDraftPlayer(player.id, { position: e.target.value as PlayerPosition }, false)}
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
                    onClick={() => removePlayer(player.id)}
                    className="px-2 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {rosterDraft.length === 0 && <div className="text-xs text-zinc-500 italic">No players added.</div>}
              <button
                type="button"
                onClick={addPlayer}
                className="mt-2 w-full px-3 py-2 bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] rounded-lg text-xs font-medium text-zinc-100"
              >
                Add Player
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
