import { useState } from "react";
import { Bookmark, House, LayoutGrid, Settings } from "lucide-react";
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
import StreamDeckPanel from "./StreamDeckPanel";

type ActiveTab = "controls" | "settings" | "presets" | "streamdeck";

export default function ControlPanel() {
  const {
    gameState,
    isConnected,
    ensureInitialized,
    updateState,
    startClock,
    stopClock,
    setClock,
    serverTimeOffsetMs,
    undoLastUpdate,
    undoState,
  } = useStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("controls");

  useKeyboardShortcuts(activeTab === "controls" || activeTab === "streamdeck");

  ensureInitialized();

  if (!gameState) {
    return <div className="flex items-center justify-center h-screen bg-zinc-950 text-white">Connecting...</div>;
  }

  const {
    homeTeam,
    awayTeam,
    clock,
    period,
    overlayVisible,
    jumbotronGradientsEnabled,
    eventLog,
    lowerThird,
  } = gameState;
  const tabs: ActiveTab[] = ["controls", "settings", "presets", "streamdeck"];
  const activeTabIndex = tabs.indexOf(activeTab);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <ControlPanelHeader
        isConnected={isConnected}
        onUndo={undoLastUpdate}
        canUndo={Boolean(undoState)}
      />

      <main className="flex-1 p-3 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="relative mb-3 sm:mb-6 border border-zinc-800 bg-zinc-900/80 rounded-2xl p-2 grid grid-cols-4 gap-1 sm:gap-2 w-full overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute top-2 bottom-2 left-2 w-[calc((100%-2.5rem)/4)] rounded-xl bg-indigo-600 shadow-[0_0_30px_rgba(79,70,229,0.35)] transition-transform duration-300 ease-out"
            style={{ transform: `translateX(calc(${activeTabIndex} * (100% + 0.5rem)))` }}
          />
          <button
            type="button"
            onClick={() => setActiveTab("controls")}
            className={`relative z-10 flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "controls" ? "text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <House size={15} />
            <span className="hidden xs:inline">Controls</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`relative z-10 flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "settings" ? "text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Settings size={15} />
            <span className="hidden xs:inline">Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={`relative z-10 flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "presets" ? "text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <Bookmark size={15} />
            <span className="hidden xs:inline">Presets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("streamdeck")}
            className={`relative z-10 flex w-full items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === "streamdeck" ? "text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            <LayoutGrid size={15} />
            <span className="hidden xs:inline">Stream Deck</span>
          </button>
        </div>

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
                <GameActionsPanel period={period} gameState={gameState} updateState={updateState} setClock={setClock} />
              </div>

              <TeamControls team="away" state={awayTeam} gameState={gameState} eventLog={eventLog} updateState={updateState} />
            </div>

            <OverlayControlsPanel
              overlayVisible={overlayVisible}
              jumbotronGradientsEnabled={jumbotronGradientsEnabled}
              updateState={updateState}
              lowerThird={lowerThird}
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
        ) : activeTab === "streamdeck" ? (
          <StreamDeckPanel />
        ) : null}
      </main>
    </div>
  );
}
