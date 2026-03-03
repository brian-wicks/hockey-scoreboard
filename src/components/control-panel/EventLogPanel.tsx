import { GameEvent } from "../../store";
import { UpdateGameState } from "./types";

interface EventLogPanelProps {
  eventLog: GameEvent[];
  updateState: UpdateGameState;
}

function getEventLabel(type: GameEvent["type"]) {
  if (type === "goal") return "Goal";
  if (type === "goal_revoked") return "Goal Revoked";
  if (type === "penalty_added") return "Penalty Added";
  return "Penalty Over";
}

export default function EventLogPanel({ eventLog, updateState }: EventLogPanelProps) {
  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    const nextLog = eventLog.map((event) => (event.id === id ? { ...event, ...updates } : event));
    updateState({ eventLog: nextLog });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-300 uppercase tracking-wider">Event Log</h2>
      </div>

      <div className="flex flex-col gap-3 max-h-[560px] overflow-auto pr-1">
        {eventLog.length === 0 && <div className="text-zinc-500 text-sm italic">No events logged yet.</div>}
        {eventLog.map((event) => (
          <div key={event.id} className="border border-zinc-800 rounded-lg p-3 bg-zinc-950">
            {event.readOnly ? (
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
                <input
                  value={event.scorer ?? ""}
                  onChange={(e) => updateEvent(event.id, { scorer: e.target.value })}
                  className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                  placeholder="Scorer"
                />
                <input
                  value={event.assist1 ?? ""}
                  onChange={(e) => updateEvent(event.id, { assist1: e.target.value })}
                  className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                  placeholder="Assist 1"
                />
                <input
                  value={event.assist2 ?? ""}
                  onChange={(e) => updateEvent(event.id, { assist2: e.target.value })}
                  className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                  placeholder="Assist 2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[760px]:grid-cols-4 gap-2 mt-2">
                <input
                  value={event.playerNumber ?? ""}
                  onChange={(e) => updateEvent(event.id, { playerNumber: e.target.value })}
                  className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                  placeholder="Player #"
                />
                <input
                  value={event.infraction ?? ""}
                  onChange={(e) => updateEvent(event.id, { infraction: e.target.value })}
                  className="bg-zinc-800 text-zinc-100 rounded px-2 py-1 text-sm"
                  placeholder="Infraction"
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
