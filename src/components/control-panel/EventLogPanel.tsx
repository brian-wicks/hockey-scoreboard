import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { GameEvent, TeamState, TeamPlayer, useStore } from "../../store";
import { exportGamesheetPdf, getGoalMismatches } from "../../utils/gamesheetPdf";
import { toSkaterLabel } from "../../utils/roster";
import { PenaltyReasonInput, SearchDropdownInput } from "./DropdownInputs";
import { UpdateGameState } from "./types";
import { loadPdfLayout } from "./PdfLayoutSettings";
import { CommitInput } from "./ui/CommitInput";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Button, Panel } from "./ui/primitives";

interface EventLogPanelProps {
  eventLog: GameEvent[];
  homeTeam: TeamState;
  awayTeam: TeamState;
  homePlayers: TeamPlayer[];
  awayPlayers: TeamPlayer[];
  updateState: UpdateGameState;
}

type LogRow = { kind: "teams"; home: GameEvent[]; away: GameEvent[] } | { kind: "period"; event: GameEvent };

const isPeriodEvent = (event: GameEvent) => event.type === "period_start" || event.type === "period_end";

function periodEventLabel(event: GameEvent) {
  const period = event.period === "OT" ? "overtime" : `${event.period} period`;
  return `${event.type === "period_start" ? "Start" : "End"} of ${period}`;
}

// Newest first. A period marker is one full-width row, so each team's older events start below it.
function buildLogRows(eventLog: GameEvent[]): LogRow[] {
  const rows: LogRow[] = [];
  for (const event of [...eventLog].reverse()) {
    if (isPeriodEvent(event)) {
      rows.push({ kind: "period", event });
      continue;
    }
    let last = rows[rows.length - 1];
    if (last?.kind !== "teams") {
      last = { kind: "teams", home: [], away: [] };
      rows.push(last);
    }
    last[event.team].push(event);
  }
  return rows;
}

export default function EventLogPanel({
  eventLog,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  updateState,
}: EventLogPanelProps) {
  const deleteEvent = useStore((state) => state.deleteEvent);
  const [exportMismatches, setExportMismatches] = useState<ReturnType<typeof getGoalMismatches>>([]);

  const exportPdf = () => exportGamesheetPdf({ homeTeam, awayTeam, eventLog }, { layout: loadPdfLayout() });

  const handleExport = () => {
    const mismatches = getGoalMismatches({ homeTeam, awayTeam, eventLog });
    if (mismatches.length > 0) {
      setExportMismatches(mismatches);
    } else {
      exportPdf();
    }
  };

  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    const nextLog = eventLog.map((event) => (event.id === id ? { ...event, ...updates } : event));
    updateState({ eventLog: nextLog });
  };

  const rows = buildLogRows(eventLog);
  if (!rows.some((row) => row.kind === "teams")) rows.unshift({ kind: "teams", home: [], away: [] });
  const firstTeamsRow = rows.find((row) => row.kind === "teams");
  const homeHasEvents = eventLog.some((event) => event.team === "home" && !isPeriodEvent(event));
  const awayHasEvents = eventLog.some((event) => event.team === "away" && !isPeriodEvent(event));

  const renderDeleteButton = (event: GameEvent) => (
    <button
      type="button"
      onClick={() => deleteEvent(event.id)}
      aria-label={`Delete event at ${event.clockTime}`}
      title="Delete this entry"
      className="p-1.5 text-danger hover:bg-surface rounded-sm shrink-0 transition-colors pointer-coarse:min-h-11"
    >
      <Trash2 size={16} />
    </button>
  );

  const renderEventCard = (event: GameEvent) => {
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
    const goalieOptions = Array.from(
      new Map(
        rosterPlayers
          .map((player) => {
            const name = player.position !== "" ? `${player.name} (${player.position})` : `${player.name}`;
            return { value: player.jerseyNumber.trim(), label: name };
          })
          .filter((option) => option.value.length > 0)
          .map((option) => [option.value, option]),
      ).values(),
    );

    return (
      <div key={event.id} className={`py-3 ${isPeriodEvent(event) ? "" : "border-b border-line"}`}>
        {event.readOnly ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-ink font-semibold">
              {isPeriodEvent(event) ? periodEventLabel(event) : event.note ?? "Penalty is over"}
            </div>
            <div className="text-xs text-muted tabular-nums">
              {isPeriodEvent(event) ? event.clockTime : `${event.period} ${event.clockTime}`}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
            <div className="grid grid-cols-1 @[480px]:grid-cols-4 gap-2 flex-1 min-w-0">
              <select
                value={event.type}
                onChange={(e) => updateEvent(event.id, { type: e.target.value as GameEvent["type"] })}
                className="control-panel-select bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm"
              >
                <option value="goal">Goal</option>
                <option value="goal_revoked">Goal revoked</option>
                <option value="penalty_added">Penalty added</option>
                <option value="penalty_over_notice">Penalty over</option>
                <option value="shot_on_goal">Shot on goal</option>
                <option value="goalie_change">Goalie change</option>
                <option value="period_start">Period start</option>
                <option value="period_end">Period end</option>
              </select>
              <select
                value={event.team}
                onChange={(e) => updateEvent(event.id, { team: e.target.value as GameEvent["team"] })}
                className="control-panel-select bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              <CommitInput
                value={event.period}
                onCommit={(period) => updateEvent(event.id, { period })}
                className="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm"
                placeholder="Period"
              />
              <CommitInput
                value={event.clockTime}
                onCommit={(clockTime) => updateEvent(event.id, { clockTime })}
                className="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm tabular-nums"
                placeholder="M:SS"
              />
            </div>
            {!isPeriodEvent(event) && renderDeleteButton(event)}
            </div>

            {event.type === "goal" || event.type === "goal_revoked" ? (
              <div className="grid grid-cols-1 @[380px]:grid-cols-3 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.scorer ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { scorer: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                  placeholder="Scorer"
                  options={uniqueSkaterOptions}
                />
                <SearchDropdownInput
                  value={event.assist1 ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { assist1: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                  placeholder="Assist 1"
                  options={uniqueSkaterOptions}
                />
                <SearchDropdownInput
                  value={event.assist2 ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { assist2: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                  placeholder="Assist 2"
                  options={uniqueSkaterOptions}
                />
              </div>
            ) : event.type === "penalty_added" || event.type === "penalty_over_notice" ? (
              <div className="grid grid-cols-1 @[480px]:grid-cols-4 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.playerNumber ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { playerNumber: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                  placeholder="Player #"
                  options={uniquePenaltyPlayerOptions}
                />
                <PenaltyReasonInput
                  value={event.infraction ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { infraction: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                />
                <CommitInput
                  value={event.endClockTime ?? ""}
                  onCommit={(endClockTime) => updateEvent(event.id, { endClockTime })}
                  className="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm tabular-nums"
                  placeholder="End time"
                />
                <CommitInput
                  value={event.removalReason ?? ""}
                  onCommit={(reason) =>
                    updateEvent(event.id, { removalReason: (reason || undefined) as GameEvent["removalReason"] })
                  }
                  className="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm"
                  placeholder="Removal reason"
                />
              </div>
            ) : event.type === "shot_on_goal" ? (
              <div className="grid grid-cols-1 @[380px]:grid-cols-3 gap-2 mt-2">
                <select
                  value={event.shotDelta ?? 1}
                  onChange={(e) => updateEvent(event.id, { shotDelta: Number(e.target.value) })}
                  className="control-panel-select bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm"
                >
                  <option value={1}>+1 shot</option>
                  <option value={-1}>-1 shot</option>
                </select>
                <div className="text-xs text-muted flex items-center">Logged for {event.team} shots</div>
              </div>
            ) : isPeriodEvent(event) ? (
              <div className="grid grid-cols-1 @[280px]:grid-cols-2 gap-2 mt-2">
                <div className="text-xs text-muted flex items-center">{periodEventLabel(event)}</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 @[280px]:grid-cols-2 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.goalie ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { goalie: nextValue })}
                  inputClassName="bg-canvas border border-line focus:border-ink focus:outline-none text-ink rounded-sm px-2 py-1 text-sm w-full"
                  placeholder="Goalie #"
                  options={goalieOptions}
                />
                <div className="text-xs text-muted flex items-center">Select roster NM</div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Event log</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              onClick={handleExport}
              variant="secondary"
              title="Export gamesheet PDF"
            >
              <Download size={16} />
              Export PDF
            </Button>
          </div>
        </div>

      <div className="max-h-[560px] overflow-auto pr-1">
        <div className="hidden min-[760px]:grid grid-cols-2 gap-4 sticky top-0 z-10 bg-canvas pb-2 text-xs font-semibold text-muted">
          <div>Home</div>
          <div className="pl-4">Away</div>
        </div>
        {rows.map((row, index) =>
          row.kind === "period" ? (
            <div key={row.event.id} className="@container bg-surface rounded-sm px-3 my-3">
              {renderEventCard(row.event)}
            </div>
          ) : (
            <div key={`teams-${index}`} className="grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
              <div className="@container flex flex-col gap-3 min-w-0">
                <div className="min-[760px]:hidden text-xs font-semibold text-muted">Home</div>
                {row === firstTeamsRow && !homeHasEvents && <div className="text-muted text-sm">No home events logged yet.</div>}
                {row.home.map(renderEventCard)}
              </div>
              <div className="@container flex flex-col gap-3 min-w-0 min-[760px]:border-l min-[760px]:border-line min-[760px]:pl-4">
                <div className="min-[760px]:hidden text-xs font-semibold text-muted">Away</div>
                {row === firstTeamsRow && !awayHasEvents && <div className="text-muted text-sm">No away events logged yet.</div>}
                {row.away.map(renderEventCard)}
              </div>
            </div>
          ),
        )}
      </div>

      <ConfirmDialog
        open={exportMismatches.length > 0}
        title="Goals don't match the score"
        message={
          <>
            <ul className="flex flex-col gap-1 mb-2">
              {exportMismatches.map((team) => (
                <li key={team.name}>
                  {team.name}: {team.sheetGoals} on the gamesheet, {team.score} on the scoreboard
                </li>
              ))}
            </ul>
            Check the event log for a missing goal or a mistyped period.
          </>
        }
        confirmLabel="Export anyway"
        confirmVariant="primary"
        onConfirm={() => {
          setExportMismatches([]);
          exportPdf();
        }}
        onCancel={() => setExportMismatches([])}
      />
    </Panel>
  );
}
