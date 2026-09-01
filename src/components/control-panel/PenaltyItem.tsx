import { useState } from "react";
import { Minus } from "lucide-react";
import { Penalty, TeamPlayer } from "../../store";
import { parseTimeInputMs } from "../../utils/clock";
import { ComboboxDropdown, PenaltyReasonInput, useComboboxField } from "./DropdownInputs";
import { glassInsetClass } from "./ui/glass";

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

  const formatPlayerSearchValue = (player: TeamPlayer) => {
    const number = player.jerseyNumber.trim();
    const name = player.name.trim();
    return `${number} ${name}`.trim();
  };

  // Unlike PenaltyReasonInput/SearchDropdownInput, a committed value here isn't
  // just passed through — it's matched against the roster (by jersey, name, or
  // "jersey name") and normalized to a bare 2-digit jersey number, whether the
  // player was picked from the list or the text was typed and blurred/entered
  // freely.
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

  const playerCombobox = useComboboxField({
    value: penalty.playerNumber,
    getOptions: (inputValue) => {
      const query = inputValue.trim().toLowerCase();
      if (!query) return rosterPlayers;
      return rosterPlayers.filter((player) => {
        const number = player.jerseyNumber.trim().toLowerCase();
        const name = player.name.trim().toLowerCase();
        const label = formatPlayerSearchValue(player).toLowerCase();
        return number.includes(query) || name.includes(query) || label.includes(query);
      });
    },
    getOptionValue: (player) => player.jerseyNumber,
    onCommit: commitPlayerNumber,
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
      // Only the remaining time is being corrected here — `duration` is the
      // penalty's original recorded length (used for gamesheet PIM), which this
      // editor shouldn't silently rewrite.
      onChange({ ...penalty, timeRemaining: timeMs });
    }
    setEditMode(false);
  };

  return (
    <div className={`flex items-center gap-2 p-2 ${glassInsetClass}`}>
      <div ref={playerCombobox.containerRef} className="relative">
        <input
          ref={(el) => {
            if (!el || !autoFocusPlayer) return;
            el.focus();
            el.select();
            onAutoFocusHandled?.();
          }}
          type="text"
          value={playerCombobox.inputValue}
          onChange={playerCombobox.handleChange}
          onKeyDown={playerCombobox.handleKeyDown}
          onFocus={(e) => {
            e.currentTarget.select();
            playerCombobox.handleFocus();
          }}
          onBlur={playerCombobox.handleBlur}
          className="w-16 bg-white/[0.05] border border-white/10 text-center rounded-md p-1 text-sm font-mono focus:border-indigo-400/60 focus:outline-none"
          placeholder="#"
        />
        <ComboboxDropdown
          open={playerCombobox.open}
          coords={playerCombobox.coords}
          dropUp={playerCombobox.dropUp}
          maxHeight={playerCombobox.maxHeight}
          options={playerCombobox.options}
          activeIndex={playerCombobox.normalizedActiveIndex}
          optionRefs={playerCombobox.optionRefs}
          onOptionMouseDown={playerCombobox.handleOptionMouseDown}
          onOptionMouseEnter={playerCombobox.setActiveIndex}
          widthClassName="w-44"
          getOptionKey={(player) => player.id}
          renderOption={(player) => {
            const labelParts = [player.name.trim(), player.position ? `(${player.position})` : ""].filter(Boolean);
            return (
              <>
                <span className="font-mono">{player.jerseyNumber || "--"}</span>
                {labelParts.length > 0 && <span className="text-zinc-400"> - {labelParts.join(" ")}</span>}
              </>
            );
          }}
        />
      </div>
      <PenaltyReasonInput
          value={penalty.infraction}
          onChange={(nextValue) => onChange({ ...penalty, infraction: nextValue })}
          inputClassName="bg-white/[0.05] border border-white/10 text-zinc-200 rounded-md p-1 text-sm font-mono w-16 focus:border-indigo-400/60 focus:outline-none"
      />
      {editMode ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTimeChange((e.target as HTMLInputElement).value)}
          onBlur={(e) => handleTimeChange(e.target.value)}
          className="bg-white/[0.05] border border-white/10 rounded-md p-1 text-sm font-mono flex-1 min-w-0 text-center focus:border-indigo-400/60 focus:outline-none"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          placeholder="M:SS"
        />
      ) : (
        <div
          className="bg-white/[0.05] border border-white/10 rounded-md p-1 text-sm flex-1 text-center font-mono cursor-pointer hover:bg-white/[0.09] transition-colors"
          onClick={() => {
            setEditValue(formatPenaltyTime(penalty.timeRemaining));
            setEditMode(true);
          }}
        >
          {formatPenaltyTime(penalty.timeRemaining)}
        </div>
      )}
      <button onClick={onRemove} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md shrink-0">
        <Minus size={16} />
      </button>
    </div>
  );
}

