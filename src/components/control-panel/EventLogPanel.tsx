import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { GameEvent, GameState, TeamState, TeamPlayer, useStore } from "../../store";
import { exportGamesheetPdf } from "../../utils/gamesheetPdf";
import { toSkaterLabel } from "../../utils/roster";
import { PenaltyReasonInput, SearchDropdownInput } from "./DropdownInputs";
import { UpdateGameState } from "./types";
import { loadPdfLayout } from "./PdfLayoutSettings";
import { GlassButton, GlassPanel } from "./ui/glass";

interface EventLogPanelProps {
  eventLog: GameEvent[];
  homeTeam: TeamState;
  awayTeam: TeamState;
  homePlayers: TeamPlayer[];
  awayPlayers: TeamPlayer[];
  updateState: UpdateGameState;
}

// gameState is read imperatively (useStore.getState()) inside the export/import
// handlers below, only at click time — it's never used in render, so it
// deliberately isn't a prop here (see GameActionsPanel for the same pattern).
export default function EventLogPanel({
  eventLog,
  homeTeam,
  awayTeam,
  homePlayers,
  awayPlayers,
  updateState,
}: EventLogPanelProps) {
  const [jsonIoStatus, setJsonIoStatus] = useState<"idle" | "exported" | "importing" | "imported" | "error">("idle");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    const nextLog = eventLog.map((event) => (event.id === id ? { ...event, ...updates } : event));
    updateState({ eventLog: nextLog });
  };

  const buildExportState = () => {
    const gameState = useStore.getState().gameState;
    if (!gameState) return null;
    const { serverTime, ...rest } = gameState;
    return rest;
  };

  const exportGamesheetJson = () => {
    try {
      const payload = buildExportState();
      if (!payload) {
        setJsonIoStatus("error");
        setTimeout(() => setJsonIoStatus("idle"), 2000);
        return;
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gamesheet-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
      setJsonIoStatus("exported");
      setTimeout(() => setJsonIoStatus("idle"), 1200);
    } catch {
      setJsonIoStatus("error");
      setTimeout(() => setJsonIoStatus("idle"), 2000);
    }
  };

  const mergeImportedState = (incoming: Partial<GameState>) => {
    const gameState = useStore.getState().gameState;
    if (!gameState) return null;
    const nextHome = { ...gameState.homeTeam, ...(incoming.homeTeam ?? {}) };
    const nextAway = { ...gameState.awayTeam, ...(incoming.awayTeam ?? {}) };
    const nextClock = { ...gameState.clock, ...(incoming.clock ?? {}) };

    return {
      ...gameState,
      ...incoming,
      homeTeam: nextHome,
      awayTeam: nextAway,
      clock: nextClock,
      eventLog: Array.isArray(incoming.eventLog) ? incoming.eventLog : gameState.eventLog,
      overlayVisible: incoming.overlayVisible ?? gameState.overlayVisible,
      overlayLayout: incoming.overlayLayout ?? gameState.overlayLayout,
      overlayCorner: incoming.overlayCorner ?? gameState.overlayCorner,
      period: incoming.period ?? gameState.period,
      jumbotronGoalHighlight: incoming.jumbotronGoalHighlight ?? gameState.jumbotronGoalHighlight,
      lowerThird: incoming.lowerThird ?? gameState.lowerThird,
    } satisfies GameState;
  };

  const importGamesheetJson = (file: File | null) => {
    if (!file) return;
    setJsonIoStatus("importing");
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = typeof reader.result === "string" ? reader.result : "";
        const parsed = JSON.parse(raw) as Partial<GameState>;
        if (!parsed || typeof parsed !== "object") {
          setJsonIoStatus("error");
          setTimeout(() => setJsonIoStatus("idle"), 2000);
          return;
        }
        const merged = mergeImportedState(parsed);
        if (!merged) {
          setJsonIoStatus("error");
          setTimeout(() => setJsonIoStatus("idle"), 2000);
          return;
        }
        updateState(merged);
        setJsonIoStatus("imported");
        setTimeout(() => setJsonIoStatus("idle"), 1200);
      } catch {
        setJsonIoStatus("error");
        setTimeout(() => setJsonIoStatus("idle"), 2000);
      }
    };
    reader.onerror = () => {
      setJsonIoStatus("error");
      setTimeout(() => setJsonIoStatus("idle"), 2000);
    };
    reader.readAsText(file);
  };

  const sortedLog = [...eventLog].reverse();
  // period_end is a shared game marker (not a per-team action), so it appears in both columns.
  const homeLog = sortedLog.filter((event) => event.team === "home" || event.type === "period_end");
  const awayLog = sortedLog.filter((event) => event.team === "away" || event.type === "period_end");

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
      <div key={event.id} className="p-3 border border-white/[0.07] bg-white/[0.03] rounded-xl">
        {event.readOnly ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-200 font-medium">{event.note ?? "Penalty is over"}</div>
            <div className="text-xs text-zinc-400 font-mono">
              {event.period} {event.clockTime}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 @[480px]:grid-cols-4 gap-2">
              <select
                value={event.type}
                onChange={(e) => updateEvent(event.id, { type: e.target.value as GameEvent["type"] })}
                className="control-panel-select bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm"
              >
                <option value="goal">Goal</option>
                <option value="goal_revoked">Goal Revoked</option>
                <option value="penalty_added">Penalty Added</option>
                <option value="penalty_over_notice">Penalty Over</option>
                <option value="shot_on_goal">Shot on Goal</option>
                <option value="goalie_change">Goalie Change</option>
                <option value="period_end">Period End</option>
              </select>
              <select
                value={event.team}
                onChange={(e) => updateEvent(event.id, { team: e.target.value as GameEvent["team"] })}
                className="control-panel-select bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
              <input
                value={event.period}
                onChange={(e) => updateEvent(event.id, { period: e.target.value })}
                className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm"
                placeholder="Period"
              />
              <input
                value={event.clockTime}
                onChange={(e) => updateEvent(event.id, { clockTime: e.target.value })}
                className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm font-mono"
                placeholder="M:SS"
              />
            </div>

            {event.type === "goal" || event.type === "goal_revoked" ? (
              <div className="grid grid-cols-1 @[380px]:grid-cols-3 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.scorer ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { scorer: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Scorer"
                  options={uniqueSkaterOptions}
                />
                <SearchDropdownInput
                  value={event.assist1 ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { assist1: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Assist 1"
                  options={uniqueSkaterOptions}
                />
                <SearchDropdownInput
                  value={event.assist2 ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { assist2: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Assist 2"
                  options={uniqueSkaterOptions}
                />
              </div>
            ) : event.type === "penalty_added" || event.type === "penalty_over_notice" ? (
              <div className="grid grid-cols-1 @[480px]:grid-cols-4 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.playerNumber ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { playerNumber: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Player #"
                  options={uniquePenaltyPlayerOptions}
                />
                <PenaltyReasonInput
                  value={event.infraction ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { infraction: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                />
                <input
                  value={event.endClockTime ?? ""}
                  onChange={(e) => updateEvent(event.id, { endClockTime: e.target.value })}
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm font-mono"
                  placeholder="End time"
                />
                <input
                  value={event.removalReason ?? ""}
                  onChange={(e) =>
                    updateEvent(event.id, {
                      removalReason: (e.target.value || undefined) as GameEvent["removalReason"],
                    })
                  }
                  className="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm"
                  placeholder="Removal reason"
                />
              </div>
            ) : event.type === "shot_on_goal" ? (
              <div className="grid grid-cols-1 @[380px]:grid-cols-3 gap-2 mt-2">
                <select
                  value={event.shotDelta ?? 1}
                  onChange={(e) => updateEvent(event.id, { shotDelta: Number(e.target.value) })}
                  className="control-panel-select bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm"
                >
                  <option value={1}>+1 Shot</option>
                  <option value={-1}>-1 Shot</option>
                </select>
                <div className="text-xs text-zinc-500 flex items-center">Logged for {event.team} shots</div>
              </div>
            ) : event.type === "period_end" ? (
              <div className="grid grid-cols-1 @[280px]:grid-cols-2 gap-2 mt-2">
                <div className="text-xs text-zinc-500 flex items-center">End of period marker</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 @[280px]:grid-cols-2 gap-2 mt-2">
                <SearchDropdownInput
                  value={event.goalie ?? ""}
                  onChange={(nextValue) => updateEvent(event.id, { goalie: nextValue })}
                  inputClassName="bg-white/[0.05] border border-white/10 focus:border-indigo-400/60 focus:outline-none text-zinc-100 rounded-md px-2 py-1 text-sm w-full"
                  placeholder="Goalie #"
                  options={goalieOptions}
                />
                <div className="text-xs text-zinc-500 flex items-center">Select roster NM</div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <GlassPanel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-300 uppercase tracking-wider">Event Log</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (e.target.value) e.target.value = "";
                importGamesheetJson(file);
              }}
            />
            <GlassButton
              type="button"
              onClick={() => importInputRef.current?.click()}
              variant="secondary"
              title="Import gamesheet JSON"
            >
              Import JSON
            </GlassButton>
            <GlassButton
              type="button"
              onClick={exportGamesheetJson}
              variant="secondary"
              title="Export gamesheet JSON"
            >
              Export JSON
            </GlassButton>
            <GlassButton
              type="button"
              onClick={() => exportGamesheetPdf({ homeTeam, awayTeam, eventLog }, { layout: loadPdfLayout() })}
              variant="secondary"
              title="Export gamesheet PDF"
            >
              <Download size={16} />
              Export PDF
            </GlassButton>
            <GlassButton
              type="button"
              onClick={() => exportGamesheetPdf({ homeTeam, awayTeam, eventLog }, { layout: loadPdfLayout(), debug: true })}
              variant="ghost"
              className="border border-white/10"
              title="Export PDF with debug grid"
            >
              <Download size={16} />
              Export (debug)
            </GlassButton>
            <div className="text-xs text-zinc-500 min-w-[90px] text-right">
              {jsonIoStatus === "importing"
                ? "Importing..."
                : jsonIoStatus === "imported"
                  ? "Imported"
                  : jsonIoStatus === "exported"
                    ? "Exported"
                    : jsonIoStatus === "error"
                      ? "Error"
                      : ""}
            </div>
          </div>
        </div>

      <div className="grid grid-cols-1 min-[760px]:grid-cols-2 gap-4">
        <div className="@container flex flex-col gap-2 min-w-0">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Home</div>
          <div className="flex flex-col gap-3 max-h-[560px] overflow-auto pr-1">
            {homeLog.length === 0 && <div className="text-zinc-500 text-sm italic">No home events logged yet.</div>}
            {homeLog.map(renderEventCard)}
          </div>
        </div>
        <div className="@container flex flex-col gap-2 min-w-0 min-[760px]:border-l min-[760px]:border-white/10 min-[760px]:pl-4">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Away</div>
          <div className="flex flex-col gap-3 max-h-[560px] overflow-auto pr-1">
            {awayLog.length === 0 && <div className="text-zinc-500 text-sm italic">No away events logged yet.</div>}
            {awayLog.map(renderEventCard)}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
