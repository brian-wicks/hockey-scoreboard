import { useEffect, useState } from "react";
import { GameEvent, TeamPlayer } from "../../store";
import { PenaltyReasonInput, useDropdownPlacement } from "./DropdownInputs";
import { UpdateGameState } from "./types";

interface EventLogPanelProps {
  eventLog: GameEvent[];
  homePlayers: TeamPlayer[];
  awayPlayers: TeamPlayer[];
  updateState: UpdateGameState;
}

interface SearchOption {
  value: string;
  label?: string;
}

function getEventLabel(type: GameEvent["type"]) {
  if (type === "goal") return "Goal";
  if (type === "goal_revoked") return "Goal Revoked";
  if (type === "penalty_added") return "Penalty Added";
  return "Penalty Over";
}

function toSkaterLabel(player: TeamPlayer) {
  const number = player.jerseyNumber.trim();
  const name = player.name.trim();
  const position = player.position && player.position !== "NM" ? ` (${player.position})` : "";
  if (number && name) return `${number} ${name}${position}`;
  if (name) return `${name}${position}`;
  return number;
}

function SearchDropdownInput({
  value,
  onChange,
  inputClassName,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
  placeholder: string;
  options: SearchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const { containerRef, dropUp, maxHeight } = useDropdownPlacement(open);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredOptions = options.filter((option) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return option.value.toLowerCase().includes(normalized) || (option.label ?? "").toLowerCase().includes(normalized);
  });

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          onChange(query);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onChange(query);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={inputClassName}
        placeholder={placeholder}
      />
      {open && (
        <div
          className={`absolute left-0 z-20 w-56 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 shadow-lg ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-2 py-1 text-xs text-zinc-500">No matches</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={`${option.value}-${index}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(option.value);
                  onChange(option.value);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                <span className="font-mono">{option.value}</span>
                {option.label ? <span className="text-zinc-400"> - {option.label}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function EventLogPanel({ eventLog, homePlayers, awayPlayers, updateState }: EventLogPanelProps) {
  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    const nextLog = eventLog.map((event) => (event.id === id ? { ...event, ...updates } : event));
    updateState({ eventLog: nextLog });
  };

  const sortedLog = [...eventLog].reverse();

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-300 uppercase tracking-wider">Event Log</h2>
      </div>

      <div className="flex flex-col gap-3 max-h-[560px] overflow-auto pr-1">
        {sortedLog.length === 0 && <div className="text-zinc-500 text-sm italic">No events logged yet.</div>}
        {sortedLog.map((event) => (
          <div key={event.id} className="border border-zinc-800 rounded-lg p-3 bg-zinc-950">
            {(() => {
              const rosterPlayers = event.team === "home" ? homePlayers : awayPlayers;
              const uniqueSkaterOptions = Array.from(
                new Map(
                  rosterPlayers
                    .map((player) => ({ value: toSkaterLabel(player), label: "" }))
                    .filter((option) => option.value.length > 0)
                    .map((option) => [option.value, option]),
                ).values(),
              );
              const uniquePenaltyPlayerOptions = Array.from(
                new Map(
                  rosterPlayers
                    .map((player) => {
                      const name = player.name.trim();
                      const pos =
                        player.position && player.position !== "NM" ? `(${player.position})` : "";
                      return {
                        value: player.jerseyNumber.trim(),
                        label: [name, pos].filter(Boolean).join(" "),
                      };
                    })
                    .filter((option) => option.value.length > 0)
                    .map((option) => [option.value, option]),
                ).values(),
              );

              return event.readOnly ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-zinc-200 font-medium">{event.note ?? "Penalty is over"}</div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {event.period} {event.clockTime}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 min-[760px]:grid-cols-4 gap-2">
                    <select
                      value={event.type}
                      onChange={(e) => updateEvent(event.id, { type: e.target.value as GameEvent["type"] })}
                      className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                    >
                      <option value="goal">Goal</option>
                      <option value="goal_revoked">Goal Revoked</option>
                      <option value="penalty_added">Penalty Added</option>
                      <option value="penalty_over_notice">Penalty Over</option>
                    </select>
                    <select
                      value={event.team}
                      onChange={(e) => updateEvent(event.id, { team: e.target.value as GameEvent["team"] })}
                      className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                    >
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                    </select>
                    <input
                      value={event.period}
                      onChange={(e) => updateEvent(event.id, { period: e.target.value })}
                      className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                      placeholder="Period"
                    />
                    <input
                      value={event.clockTime}
                      onChange={(e) => updateEvent(event.id, { clockTime: e.target.value })}
                      className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm font-mono"
                      placeholder="M:SS"
                    />
                  </div>

                  {event.type === "goal" || event.type === "goal_revoked" ? (
                    <div className="grid grid-cols-1 min-[760px]:grid-cols-3 gap-2 mt-2">
                      <SearchDropdownInput
                        value={event.scorer ?? ""}
                        onChange={(nextValue) => updateEvent(event.id, { scorer: nextValue })}
                        inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                        placeholder="Scorer"
                        options={uniqueSkaterOptions}
                      />
                      <SearchDropdownInput
                        value={event.assist1 ?? ""}
                        onChange={(nextValue) => updateEvent(event.id, { assist1: nextValue })}
                        inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                        placeholder="Assist 1"
                        options={uniqueSkaterOptions}
                      />
                      <SearchDropdownInput
                        value={event.assist2 ?? ""}
                        onChange={(nextValue) => updateEvent(event.id, { assist2: nextValue })}
                        inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                        placeholder="Assist 2"
                        options={uniqueSkaterOptions}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 min-[760px]:grid-cols-4 gap-2 mt-2">
                      <SearchDropdownInput
                        value={event.playerNumber ?? ""}
                        onChange={(nextValue) => updateEvent(event.id, { playerNumber: nextValue })}
                        inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                        placeholder="Player #"
                        options={uniquePenaltyPlayerOptions}
                      />
                      <PenaltyReasonInput
                        value={event.infraction ?? ""}
                        onChange={(nextValue) => updateEvent(event.id, { infraction: nextValue })}
                        inputClassName="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm w-full"
                      />
                      <input
                        value={event.endClockTime ?? ""}
                        onChange={(e) => updateEvent(event.id, { endClockTime: e.target.value })}
                        className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm font-mono"
                        placeholder="End time"
                      />
                      <input
                        value={event.removalReason ?? ""}
                        onChange={(e) =>
                          updateEvent(event.id, {
                            removalReason: (e.target.value || undefined) as GameEvent["removalReason"],
                          })
                        }
                        className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                        placeholder="Removal reason"
                      />
                    </div>
                  )}

                  <div className="mt-2 text-xs text-zinc-500">{getEventLabel(event.type)}</div>
                </>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}
