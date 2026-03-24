import { useEffect, useRef, useState } from "react";
import { Minus } from "lucide-react";
import { Penalty, TeamPlayer } from "../../store";
import { parseTimeInputMs } from "../../utils/clock";
import { PenaltyReasonInput, useDropdownPlacement } from "./DropdownInputs";

interface PenaltyItemProps {
  penalty: Penalty;
  onChange: (penalty: Penalty) => void;
  onRemove: () => void;
  autoFocusPlayer?: boolean;
  onAutoFocusHandled?: () => void;
  rosterPlayers?: TeamPlayer[];
}

export default function PenaltyItem({
  penalty,
  onChange,
  onRemove,
  autoFocusPlayer = false,
  onAutoFocusHandled,
  rosterPlayers = [],
}: PenaltyItemProps) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("2:00");
  const [playerValue, setPlayerValue] = useState(penalty.playerNumber);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activePlayerIndex, setActivePlayerIndex] = useState(-1);
  const suppressPlayerBlurCommitRef = useRef(false);
  const playerInputRef = useRef<HTMLInputElement | null>(null);
  const playerDropdown = useDropdownPlacement(playerOpen);
  const playerListRef = useRef<HTMLDivElement | null>(null);
  const playerOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!autoFocusPlayer) return;
    playerInputRef.current?.focus();
    playerInputRef.current?.select();
    onAutoFocusHandled?.();
  }, [autoFocusPlayer, onAutoFocusHandled]);

  useEffect(() => {
    setPlayerValue(penalty.playerNumber);
  }, [penalty.playerNumber]);

  const commitPlayerNumber = (value: string) => {
    const trimmed = value.trim();
    const normalized = trimmed.toLowerCase();
    const matchedPlayer = rosterPlayers.find((player) => {
      const jersey = player.jerseyNumber.trim();
      const name = player.name.trim();
      const fullLabel = `${jersey} ${name}`.trim().toLowerCase();
      return normalized === jersey.toLowerCase() || normalized === name.toLowerCase() || normalized === fullLabel;
    });
    const nextPlayerNumber = (matchedPlayer?.jerseyNumber ?? trimmed).replace(/\D/g, "").slice(0, 2);
    onChange({ ...penalty, playerNumber: nextPlayerNumber });
    return nextPlayerNumber;
  };

  const formatPlayerSearchValue = (player: TeamPlayer) => {
    const number = player.jerseyNumber.trim();
    const name = player.name.trim();
    return `${number} ${name}`.trim();
  };

  const playerOptions = rosterPlayers.filter((player) => {
    const query = playerValue.trim().toLowerCase();
    if (!query) return true;
    const number = player.jerseyNumber.trim().toLowerCase();
    const name = player.name.trim().toLowerCase();
    const label = formatPlayerSearchValue(player).toLowerCase();
    return number.includes(query) || name.includes(query) || label.includes(query);
  });

  useEffect(() => {
    if (!playerOpen) {
      setActivePlayerIndex(-1);
      return;
    }
    if (playerOptions.length === 0) {
      setActivePlayerIndex(-1);
      return;
    }
    if (activePlayerIndex === -1 || activePlayerIndex >= playerOptions.length) {
      setActivePlayerIndex(0);
    }
  }, [playerOpen, playerOptions.length, activePlayerIndex]);

  useEffect(() => {
    if (!playerOpen || activePlayerIndex < 0) return;
    const el = playerOptionRefs.current[activePlayerIndex];
    el?.scrollIntoView({ block: "nearest" });
  }, [playerOpen, activePlayerIndex]);

  const formatPenaltyTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleTimeChange = (value: string) => {
    const timeMs = parseTimeInputMs(value);
    if (timeMs !== null) {
      onChange({ ...penalty, timeRemaining: timeMs, duration: timeMs });
    }
    setEditMode(false);
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800">
      <div ref={playerDropdown.containerRef} className="relative">
        <input
          ref={playerInputRef}
          type="text"
          value={playerValue}
          onChange={(e) => {
            setPlayerValue(e.target.value);
            setPlayerOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              if (!playerOpen) {
                setPlayerOpen(true);
                setActivePlayerIndex(playerOptions.length > 0 ? 0 : -1);
                return;
              }
              if (playerOptions.length === 0) return;
              e.preventDefault();
              const delta = e.key === "ArrowDown" ? 1 : -1;
              setActivePlayerIndex((prev) => {
                const next = prev === -1 ? 0 : prev + delta;
                if (next < 0) return playerOptions.length - 1;
                if (next >= playerOptions.length) return 0;
                return next;
              });
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (playerOpen && activePlayerIndex >= 0 && activePlayerIndex < playerOptions.length) {
                const selected = playerOptions[activePlayerIndex];
                const committed = commitPlayerNumber(selected.jerseyNumber);
                setPlayerValue(committed);
                setPlayerOpen(false);
                suppressPlayerBlurCommitRef.current = true;
                return;
              }
              const committed = commitPlayerNumber((e.target as HTMLInputElement).value);
              setPlayerValue(committed);
              setPlayerOpen(false);
            }
          }}
          onFocus={(e) => {
            e.currentTarget.select();
            setPlayerOpen(true);
          }}
          onBlur={(e) => {
            if (suppressPlayerBlurCommitRef.current) {
              suppressPlayerBlurCommitRef.current = false;
              return;
            }
            const committed = commitPlayerNumber(e.target.value);
            setPlayerValue(committed);
            setPlayerOpen(false);
          }}
          className="w-16 bg-zinc-800 text-center rounded p-1 text-sm font-mono"
          placeholder="#"
        />
        {playerOpen && (
          <div
            ref={playerListRef}
            className={`absolute left-0 z-20 w-44 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
              playerDropdown.dropUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{ maxHeight: `${playerDropdown.maxHeight}px` }}
          >
            {playerOptions.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
            ) : (
              playerOptions.map((player, index) => {
                const labelParts = [
                  player.name.trim(),
                  player.position ? `(${player.position})` : "",
                ].filter(Boolean);
                return (
                  <button
                    key={player.id}
                    type="button"
                    ref={(el) => {
                      playerOptionRefs.current[index] = el;
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const committed = commitPlayerNumber(player.jerseyNumber);
                      setPlayerValue(committed);
                      setPlayerOpen(false);
                    }}
                    onMouseEnter={() => setActivePlayerIndex(index)}
                    className={`w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 ${
                      index === activePlayerIndex ? "bg-zinc-800" : ""
                    }`}
                  >
                    <span className="font-mono">{player.jerseyNumber || "--"}</span>
                    {labelParts.length > 0 && <span className="text-zinc-400"> - {labelParts.join(" ")}</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      <PenaltyReasonInput
          value={penalty.infraction}
          onChange={(nextValue) => onChange({ ...penalty, infraction: nextValue })}
          inputClassName="bg-zinc-800 text-zinc-200 rounded p-1 text-sm font-mono w-16"
      />
      {editMode ? (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTimeChange((e.target as HTMLInputElement).value)}
            onBlur={(e) => handleTimeChange(e.target.value)}
            className="bg-zinc-800 rounded p-1 text-sm font-mono w-24 text-center"
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
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
      <button onClick={onRemove} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded shrink-0">
        <Minus size={16} />
      </button>
    </div>
  );
}

