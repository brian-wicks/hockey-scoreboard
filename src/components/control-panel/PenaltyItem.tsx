import { useEffect, useRef, useState } from "react";
import { Minus } from "lucide-react";
import { Penalty } from "../../store";
import { parseTimeInputMs } from "../../utils/clock";

const PENALTY_OPTIONS = [
  { code: "HOOK", label: "Hooking" },
  { code: "HOLD", label: "Holding" },
  { code: "TRIP", label: "Tripping" },
  { code: "INT", label: "Interference" },
  { code: "SLASH", label: "Slashing" },
  { code: "HI-ST", label: "High-Sticking" },
  { code: "CROSS", label: "Cross-Checking" },
  { code: "ROUGH", label: "Roughing" },
  { code: "ELBOW", label: "Elbowing" },
  { code: "KNEE", label: "Kneeing" },
  { code: "DEL", label: "Delay of Game" },
  { code: "TMM", label: "Too Many Men" },
  { code: "HLD-ST", label: "Holding the Stick" },
  { code: "USC", label: "Unsportsmanlike Conduct" },
  { code: "G-INT", label: "Goalie Interference" },
  { code: "DIVE", label: "Embellishment/Diving" },
  { code: "POG", label: "Puck Over the Glass" },
  { code: "HI-ST+", label: "High-Sticking (Blood)" },
  { code: "SPEAR", label: "Spearing (Minor)" },
  { code: "FIGHT", label: "Fighting" },
  { code: "BOARD", label: "Boarding" },
  { code: "CHARG", label: "Charging" },
  { code: "CFB", label: "Checking from Behind" },
  { code: "SPEAR+", label: "Spearing (Major)" },
  { code: "BUTT", label: "Butt-Ending" },
  { code: "H-BUT", label: "Head-Butting" },
  { code: "CLIP", label: "Clipping" },
  { code: "MISC", label: "Misconduct" },
  { code: "GM", label: "Game Misconduct" },
  { code: "MATCH", label: "Match Penalty" },
  { code: "GMISC", label: "Gross Misconduct" },
  { code: "G-PUCK", label: "Handling the Puck" },
  { code: "G-COV", label: "Covering the Puck" },
  { code: "G-CRES", label: "Leaving the Crease" },
] as const;

interface PenaltyItemProps {
  penalty: Penalty;
  onChange: (penalty: Penalty) => void;
  onRemove: () => void;
  autoFocusPlayer?: boolean;
  onAutoFocusHandled?: () => void;
}

export default function PenaltyItem({
  penalty,
  onChange,
  onRemove,
  autoFocusPlayer = false,
  onAutoFocusHandled,
}: PenaltyItemProps) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState("2:00");
  const [playerValue, setPlayerValue] = useState(penalty.playerNumber);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonQuery, setReasonQuery] = useState(penalty.infraction);
  const playerInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleTimeChange = (value: string) => {
    const timeMs = parseTimeInputMs(value);
    if (timeMs !== null) {
      onChange({ ...penalty, timeRemaining: timeMs, duration: timeMs });
    }
    setEditMode(false);
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded border border-zinc-800">
      <div className="relative">
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
          <div className="absolute left-0 top-full mt-1 z-20 w-48 max-h-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg">
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
      <input
        ref={playerInputRef}
        type="text"
        value={playerValue}
        onChange={(e) => {
          const nextPlayerNumber = e.target.value.replace(/\D/g, "").slice(0, 2);
          setPlayerValue(nextPlayerNumber);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const committed = commitPlayerNumber((e.target as HTMLInputElement).value);
            setPlayerValue(committed);
            e.currentTarget.blur();
          }
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          const committed = commitPlayerNumber(e.target.value);
          setPlayerValue(committed);
        }}
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
