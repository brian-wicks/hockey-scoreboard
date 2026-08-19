import { useState } from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useStore } from "../store";
import AppSidebar, { ActiveTab } from "./control-panel/AppSidebar";
import ClockControl from "./control-panel/ClockControl";
import ControlPanelHeader from "./control-panel/ControlPanelHeader";
import EventLogPanel from "./control-panel/EventLogPanel";
import GameActionsPanel from "./control-panel/GameActionsPanel";
import OverlayControlsPanel from "./control-panel/OverlayControlsPanel";
import PresetsPanel from "./control-panel/PresetsPanel";
import SettingsPanel from "./control-panel/SettingsPanel";
import TeamControls from "./control-panel/TeamControls";
import StreamDeckPanel from "./StreamDeckPanel";
import ShareModal from "./control-panel/ShareModal";
import SavedGamesPanel from "./control-panel/SavedGamesPanel";

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
    undoStack = [],
    isViewer,
  } = useStore();
  const [activeTab, setActiveTab] = useState<ActiveTab>("controls");
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  useKeyboardShortcuts((activeTab === "controls" || activeTab === "streamdeck") && !isViewer);

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

  return (
    <div className={`relative min-h-screen text-zinc-100 font-sans ${isViewer ? 'select-none pointer-events-none' : ''}`}>
      <div className="control-panel-ambient-bg" />
      <div className="relative z-10 flex flex-col min-h-screen">
        <ControlPanelHeader
          isConnected={isConnected}
          onUndo={undoLastUpdate}
          canUndo={undoStack.length > 0 && !isViewer}
          onShare={() => setIsShareModalOpen(true)}
        />

        {isViewer && (
          <div className="bg-amber-900/40 border-b border-amber-800 py-1.5 px-4 text-center">
            <p className="text-xs font-medium text-amber-200 uppercase tracking-widest">Viewer Mode — Read Only</p>
          </div>
        )}

        <div className="flex-1 flex">
          {!isViewer && <AppSidebar activeTab={activeTab} onSelectTab={setActiveTab} />}

          <main className="flex-1 min-w-0 p-3 sm:p-6 pb-20 md:pb-6 max-w-7xl mx-auto w-full">
            {activeTab === "controls" || isViewer ? (
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
            ) : activeTab === "games" ? (
              <SavedGamesPanel />
            ) : null}
          </main>
        </div>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
