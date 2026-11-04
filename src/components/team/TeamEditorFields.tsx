import { useEffect, useRef, useState } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { PlayerPosition, TeamIdentity, TeamPlayer, useStore } from "../../store";
import { ColorPicker } from "../control-panel/ui/ColorPicker";
import { inputClass } from "../control-panel/ui/primitives";
import { LogoUploadError, uploadTeamLogo } from "../../lib/uploadTeamLogo";
import { sortPlayersByJersey } from "../../utils/roster";

/** A team's identity fields while being edited in a form — same shape as the
 * persisted TeamIdentity, kept as a distinct alias since call sites read better
 * naming it for what it is here: in-progress draft state, not saved data. */
export type TeamIdentityDraft = TeamIdentity;

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
  /** "url" (default) shows the raw Logo URL text field alongside a small upload button —
   * used by Settings, where someone may already have a URL to paste while a game is live.
   * "upload" replaces it with a single drag-and-drop/click-to-browse dropzone and no URL
   * field — used by the Edit Team modal and the New game wizard's team creation step, so
   * both "create/edit a team" entry points share the same logo experience. */
  logoInput?: "url" | "upload";
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

/**
 * Team identity + roster editor. Owns its own text-input draft state so typing stays
 * snappy while the caller decides when to persist (on blur/Enter, via onIdentityCommit /
 * onRosterChange) — SettingsPanel commits straight to the live socket; a local form
 * (New game wizard, Team Manager) just commits to its own draft state instead.
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
  logoInput = "url",
}: TeamEditorFieldsProps) {
  const user = useStore((state) => state.user);
  const [name, setName] = useState(identity.name);
  const [abbreviation, setAbbreviation] = useState(identity.abbreviation);
  const [logo, setLogo] = useState(identity.logo);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
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

  const uploadLogoFile = async (file: File) => {
    if (!user) return;
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const url = await uploadTeamLogo(user.uid, file);
      setLogo(url);
      onIdentityCommit({ logo: url });
    } catch (error) {
      setLogoUploadError(error instanceof LogoUploadError ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (file) void uploadLogoFile(file);
  };

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onIdentityCommit({ name: trimmed });
    } else {
      // Team name is required everywhere it's edited — revert rather than commit a blank,
      // which would otherwise broadcast instantly to viewers when this is wired to a live
      // socket update (e.g. SettingsPanel), unlike the draft-only wizard/modal flows.
      setName(identity.name);
    }
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadLogoFile(file);
  };

  return (
    <div className={framed ? "bg-canvas border border-line rounded-sm p-6" : undefined}>
      {title && (
        <div className="mb-6 border-b border-line pb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-semibold text-muted mb-1">Team name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitName();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={`w-full ${inputClass}`}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-muted mb-1">Abbreviation (3 letters)</label>
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
            className={`w-full ${inputClass} tabular-nums`}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-muted mb-1">Logo</label>
          {logoInput === "upload" ? (
            <div
              onClick={() => logoFileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDraggingLogo(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setIsDraggingLogo(false)}
              onDrop={handleLogoDrop}
              role="button"
              tabIndex={0}
              className={`flex flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDraggingLogo
                  ? "border-ink bg-surface"
                  : "border-line hover:border-ink bg-canvas"
              }`}
            >
              {logo ? (
                <img src={logo} alt="" className="w-16 h-16 object-contain rounded-sm" />
              ) : (
                <Upload size={20} className="text-muted" />
              )}
              <span className="text-xs text-muted">
                {isUploadingLogo ? "Uploading..." : logo ? "Drag & drop, or click to replace" : "Drag & drop an image, or click to browse"}
              </span>
              {logoUploadError && <span className="text-xs text-danger">{logoUploadError}</span>}
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                onClick={(e) => e.stopPropagation()}
                className="hidden"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 shrink-0 rounded-sm bg-canvas border border-line flex items-center justify-center overflow-hidden">
                {logo ? (
                  <img src={logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <Upload size={16} className="text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
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
                  className={`w-full ${inputClass}`}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUploadingLogo || !user}
                    onClick={() => logoFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-canvas border border-line hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-xs font-semibold text-ink"
                  >
                    <Upload size={13} />
                    {isUploadingLogo ? "Uploading..." : "Upload image"}
                  </button>
                  {logoUploadError && <span className="text-xs text-danger">{logoUploadError}</span>}
                </div>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-muted mb-1">Primary color</label>
          <ColorPicker value={identity.color} onChange={(hex) => onIdentityCommit({ color: hex })} label={colorLabel} />
        </div>
        <div className="pt-3 border-t border-line">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-semibold text-muted">
              Roster
              <span className="ml-2 inline-flex items-center rounded-full bg-canvas border border-line px-2 py-0.5 text-xs tabular-nums text-ink">
                {rosterDraft.length} players
              </span>
            </label>
            <button
              type="button"
              onClick={() => setRosterExpanded((prev) => !prev)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-canvas border border-line hover:bg-surface text-ink"
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
                    className={`${inputClass} tabular-nums`}
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
                    className={inputClass}
                    placeholder="Player name"
                  />
                  <select
                    value={player.position ?? ""}
                    onChange={(e) => commitDraftPlayer(player.id, { position: e.target.value as PlayerPosition }, false)}
                    className={`control-panel-select ${inputClass}`}
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
                    className="px-2 py-2 bg-canvas border border-line hover:bg-surface rounded-sm text-xs font-semibold"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {rosterDraft.length === 0 && <div className="text-xs text-muted">No players added.</div>}
              <button
                type="button"
                onClick={addPlayer}
                className="mt-2 w-full px-3 py-2 bg-canvas border border-line hover:bg-surface rounded-sm text-xs font-semibold text-ink"
              >
                Add player
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
