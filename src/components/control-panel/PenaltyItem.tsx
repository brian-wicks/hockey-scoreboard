import { useEffect, useRef, useState } from "react";
import { Minus } from "lucide-react";
import { Penalty, TeamPlayer } from "../../store";
import { parseTimeInputMs } from "../../utils/clock";
import { PENALTY_OPTIONS } from "../../constants/penaltyOptions";

function useDropdownPlacement(open: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(224);

  useEffect(() => {
    if (!open) return;

    const updatePlacement = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportPadding = 8;
      const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
      const availableAbove = rect.top - viewportPadding;
      const shouldDropUp = availableBelow < 180 && availableAbove > availableBelow;
      const available = shouldDropUp ? availableAbove : availableBelow;

      setDropUp(shouldDropUp);
      setMaxHeight(Math.max(120, Math.min(224, Math.floor(available))));
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);
    return () => {
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return { containerRef, dropUp, maxHeight };
}

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
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonQuery, setReasonQuery] = useState(penalty.infraction);
  const playerInputRef = useRef<HTMLInputElement | null>(null);
  const reasonDropdown = useDropdownPlacement(reasonOpen);
  const playerDropdown = useDropdownPlacement(playerOpen);

  useEffect(() => {
    if (!autoFocusPlayer) return;
    playerInputRef.current?.focus();
    playerInputRef.current?.select();
    onAutoFocusHandled?.();
  }, [autoFocusPlayer, onAutoFocusHandled]);

  useEffect(() => {
    setPlayerValue(penalty.playerNumber);
  }, [penalty.playerNumber]);

  useEffect(() => {
    setReasonQuery(penalty.infraction);
  }, [penalty.infraction]);

  const reasonOptions = PENALTY_OPTIONS.filter((option) => {
    const query = reasonQuery.trim().toLowerCase();
    if (!query) return true;
    return option.code.toLowerCase().includes(query) || option.label.toLowerCase().includes(query);
  });

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
      <div ref={reasonDropdown.containerRef} className="relative">
        <input
          value={reasonQuery}
          onChange={(e) => setReasonQuery(e.target.value)}
          onFocus={() => setReasonOpen(true)}
          onBlur={() => {
            onChange({ ...penalty, infraction: reasonQuery });
            setReasonOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onChange({ ...penalty, infraction: reasonQuery });
              setReasonOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="bg-zinc-800 text-zinc-200 rounded p-1 text-sm font-mono w-16"
          placeholder="Reason"
        />
        {reasonOpen && (
          <div
            className={`absolute left-0 z-20 w-48 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
              reasonDropdown.dropUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{ maxHeight: `${reasonDropdown.maxHeight}px` }}
          >
            {reasonOptions.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
            ) : (
              reasonOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange({ ...penalty, infraction: option.code });
                    setReasonQuery(option.code);
                    setReasonOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
                >
                  <span className="font-mono">{option.code}</span>
                  <span className="text-zinc-400"> - {option.label}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
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
            if (e.key === "Enter") {
              e.preventDefault();
              const committed = commitPlayerNumber((e.target as HTMLInputElement).value);
              setPlayerValue(committed);
              setPlayerOpen(false);
              e.currentTarget.blur();
            }
          }}
          onFocus={(e) => {
            e.currentTarget.select();
            setPlayerOpen(true);
          }}
          onBlur={(e) => {
            const committed = commitPlayerNumber(e.target.value);
            setPlayerValue(committed);
            setPlayerOpen(false);
          }}
          className="w-16 bg-zinc-800 text-center rounded p-1 text-sm font-mono"
          placeholder="#"
        />
        {playerOpen && (
          <div
            className={`absolute left-0 z-20 w-44 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
              playerDropdown.dropUp ? "bottom-full mb-1" : "top-full mt-1"
            }`}
            style={{ maxHeight: `${playerDropdown.maxHeight}px` }}
          >
            {playerOptions.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
            ) : (
              playerOptions.map((player) => {
                const labelParts = [
                  player.name.trim(),
                  player.position && player.position !== "NM" ? `(${player.position})` : "",
                ].filter(Boolean);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const committed = commitPlayerNumber(player.jerseyNumber);
                      setPlayerValue(committed);
                      setPlayerOpen(false);
                    }}
                    className="w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
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

