import { useEffect, useState } from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useStore } from "../store";
import ClockControl from "./control-panel/ClockControl";
import ControlPanelHeader from "./control-panel/ControlPanelHeader";
import EventLogPanel from "./control-panel/EventLogPanel";
import GameActionsPanel from "./control-panel/GameActionsPanel";
import OverlayControlsPanel from "./control-panel/OverlayControlsPanel";
import PresetsPanel from "./control-panel/PresetsPanel";
import SettingsPanel from "./control-panel/SettingsPanel";
import TeamControls from "./control-panel/TeamControls";

type ActiveTab = "controls" | "settings" | "presets";

export default function ControlPanel() {
  const { gameState, connect, updateState, startClock, stopClock, setClock, loadShortcuts, serverTimeOffsetMs } = useStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("controls");

  useKeyboardShortcuts(activeTab === "controls");

  useEffect(() => {
    connect();
    void loadShortcuts();
  }, [connect, loadShortcuts]);

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Connecting...</div>;
  }

  const { homeTeam, awayTeam, clock, period, overlayVisible, jumbotronGradientsEnabled, eventLog } = gameState;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <ControlPanelHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === "controls" ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 min-[950px]:grid-cols-3 gap-6">
              <TeamControls team="home" state={homeTeam} gameState={gameState} eventLog={eventLog} updateState={updateState} />

              <div className="flex flex-col gap-6">
                <ClockControl
                  clock={clock}
                  period={period}
                  startClock={startClock}
                  stopClock={stopClock}
                  setClock={setClock}
                  serverTimeOffsetMs={serverTimeOffsetMs}
                />
                <GameActionsPanel period={period} gameState={gameState} updateState={updateState} />
              </div>

              <TeamControls team="away" state={awayTeam} gameState={gameState} eventLog={eventLog} updateState={updateState} />
            </div>

            <OverlayControlsPanel
              overlayVisible={overlayVisible}
              jumbotronGradientsEnabled={jumbotronGradientsEnabled}
              updateState={updateState}
            />
            <EventLogPanel
              gameState={gameState}
              eventLog={eventLog}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homePlayers={homeTeam.players ?? []}
              awayPlayers={awayTeam.players ?? []}
              updateState={updateState}
            />
          </div>
        ) : activeTab === "settings" ? (
          <SettingsPanel gameState={gameState} updateState={updateState} />
        ) : activeTab === "presets" ? (
          <PresetsPanel gameState={gameState} updateState={updateState} />
        ) : null}
      </main>
    </div>
  );
}
