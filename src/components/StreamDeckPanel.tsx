import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  X,
  Timer,
  Trophy,
  Activity,
  AlertCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Info,
  Target,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useStore, ShortcutAction, StreamDeckButton } from "../store";
import { useSharedActions } from "../hooks/useSharedActions";
import Overlay from "./Overlay";
import GoalReviewPanel from "./control-panel/GoalReviewPanel";
import PenaltyItem from "./control-panel/PenaltyItem";

// Custom Ice Hockey Icons
const PuckIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        {/* Body of the puck */}
        <path d="M2 12v5c0 3 4.5 5 10 5s10-2 10-5v-5c0 3-4.5 5-10 5s-10-2-10-5Z" />
        {/* Top surface */}
        <ellipse cx="12" cy="10" rx="10" ry="5" />
        {/* Highlight on top */}
        <ellipse cx="12" cy="9" rx="8" ry="3" fill="white" fillOpacity="0.2" />
    </svg>
);

const HockeyStickIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 504 504" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M476.4,377.677c-0.176,0-0.328,0.284-0.504,0.284H323.784l-67.848-67.504v0.195L20.044,74.301
c-4.464-4.468-12.168-4.596-16.624-0.14C1.184,76.397,0,79.297,0,82.453c0,3.16,1.252,6.092,3.484,8.324l338.684,338.648
c2.232,2.232,5.204,3.668,8.364,3.668c0.32,0,0.62,0.024,0.916,0.024H476.4c15.224,0,27.6-12.504,27.6-27.72
S491.62,377.677,476.4,377.677z"/>
    </svg>
);

const GoalIcon = ({size = 24, className = ""}: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
         className={className}>
        <path d="M3 20V6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V20" stroke="currentColor"
              strokeWidth="2"/>
        <path d="M3 10H21M3 15H21M7 4V20M12 4V20M17 4V20" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
    </svg>
);

const WhistleIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 297 297" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M286.966,57.833H104.569c-18.481,0-35.701,5.496-50.12,14.932c-4.36-10.082-14.4-17.157-26.064-17.157
C12.733,55.609,0,68.342,0,83.994c0,13.14,8.977,24.22,21.118,27.438c-5.343,11.632-8.328,24.564-8.328,38.18
c0,50.607,41.172,91.779,91.779,91.779c50.608,0,91.78-41.172,91.78-91.779v-16.659h90.618c5.541,0,10.034-4.493,10.034-10.034
V67.867C297,62.326,292.507,57.833,286.966,57.833z M28.385,75.677c4.586,0,8.317,3.731,8.317,8.317s-3.731,8.317-8.317,8.317
s-8.317-3.731-8.317-8.317S23.799,75.677,28.385,75.677z M276.932,112.886h-90.618c-5.541,0-10.034,4.493-10.034,10.034v26.692
c0,39.541-32.17,71.711-71.712,71.711c-39.541,0-71.711-32.17-71.711-71.711s32.17-71.711,71.711-71.711h8.318v26.668
c0,5.541,4.493,10.034,10.034,10.034s10.034-4.493,10.034-10.034V77.901h143.978V112.886z"/>
    </svg>
);

const AVAILABLE_ICONS = [
  { name: "None", icon: null },
  { name: "Puck", icon: PuckIcon },
  { name: "Stick", icon: HockeyStickIcon },
  { name: "Goal", icon: GoalIcon },
  { name: "Whistle", icon: WhistleIcon },
  { name: "Timer", icon: Timer },
  { name: "Trophy", icon: Trophy },
  { name: "Target", icon: Target },
  { name: "Activity", icon: Activity },
  { name: "AlertCircle", icon: AlertCircle },
  { name: "Clock", icon: Clock },
  { name: "Info", icon: Info },
  { name: "ChevronUp", icon: ChevronUp },
  { name: "ChevronDown", icon: ChevronDown },
  { name: "ArrowUp", icon: ArrowUp },
  { name: "ArrowDown", icon: ArrowDown },
  { name: "ArrowLeft", icon: ArrowLeft },
  { name: "ArrowRight", icon: ArrowRight },
  { name: "RotateCcw", icon: RotateCcw },
  { name: "Settings", icon: Settings },
];

const ACTION_OPTIONS: { value: ShortcutAction | "none"; label: string }[] = [
  { value: "none", label: "No Action" },
  { value: "toggleClock", label: "Toggle Clock" },
  { value: "clockIncrease", label: "Clock +1s" },
  { value: "clockDecrease", label: "Clock -1s" },
  { value: "nextPeriod", label: "Next Period" },
  { value: "prevPeriod", label: "Previous Period" },
  { value: "homeScoreUp", label: "Home Score +1" },
  { value: "awayScoreUp", label: "Away Score +1" },
  { value: "homeShotsUp", label: "Home Shots +1" },
  { value: "awayShotsUp", label: "Away Shots +1" },
  { value: "homeScoreDown", label: "Home Score -1" },
  { value: "awayScoreDown", label: "Away Score -1" },
  { value: "homeShotsDown", label: "Home Shots -1" },
  { value: "awayShotsDown", label: "Away Shots -1" },
  { value: "homePenaltyAdd", label: "Home Penalty" },
  { value: "awayPenaltyAdd", label: "Away Penalty" },
  { value: "homePenaltyRemoveEarliest", label: "Remove Home Penalty" },
  { value: "awayPenaltyRemoveEarliest", label: "Remove Away Penalty" },
];

function ScoreboardPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { width } = containerRef.current.getBoundingClientRect();
      const targetWidth = 760;
      setScale(width / targetWidth);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
    ref={containerRef}
    className="relative w-full overflow-hidden bg-[url('/assets/grunge-navy.jpg')] bg-cover bg-center"
    style={{ height: `${200 * scale}px` }}
    >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top center",
            width: "760px",
            height: "1000px",
            position: "absolute",
            top: 0,
            left: "50%",
            marginLeft: "-380px",
          }}
          className="pointer-events-none"
        >
          <Overlay skipConnect />
        </div>
    </div>
  );
}

interface EditModalProps {
  button: StreamDeckButton;
  index: number;
  onClose: () => void;
  onSave: (button: StreamDeckButton) => void;
}

function EditModal({ button, index, onClose, onSave }: EditModalProps) {
  const [edited, setEdited] = useState<StreamDeckButton>({ ...button });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold">Edit Button {index + 1}</h3>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Label</label>
            <input
              type="text"
              value={edited.label}
              onChange={(e) => setEdited({ ...edited, label: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Action</label>
            <select
              value={edited.action}
              onChange={(e) => setEdited({ ...edited, action: e.target.value as ShortcutAction | "none" })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Color Source</label>
            <div className="grid grid-cols-3 gap-2">
              {(["custom", "home", "away"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setEdited({ ...edited, colorSource: source })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all uppercase ${
                    (edited.colorSource || "custom") === source
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          {(edited.colorSource === "custom" || !edited.colorSource) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Background</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={edited.backgroundColor}
                    onChange={(e) => setEdited({ ...edited, backgroundColor: e.target.value })}
                    className="w-10 h-10 bg-transparent border-0 p-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={edited.backgroundColor}
                    onChange={(e) => setEdited({ ...edited, backgroundColor: e.target.value })}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={edited.textColor}
                    onChange={(e) => setEdited({ ...edited, textColor: e.target.value })}
                    className="w-10 h-10 bg-transparent border-0 p-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={edited.textColor}
                    onChange={(e) => setEdited({ ...edited, textColor: e.target.value })}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Icon</label>
            <div className="grid grid-cols-4 gap-2">
              {AVAILABLE_ICONS.map((item) => {
                const Icon = item.icon;
                const isSelected = edited.icon === item.name || (!edited.icon && item.name === "None");
                return (
                  <button
                    key={item.name}
                    onClick={() => setEdited({ ...edited, icon: item.name === "None" ? undefined : item.name })}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    {Icon ? <Icon size={20} /> : <X size={20} />}
                    <span className="text-[10px] mt-1 truncate w-full text-center">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Image URL (Optional)</label>
            <input
              type="text"
              placeholder="https://example.com/icon.png"
              value={edited.image || ""}
              onChange={(e) => setEdited({ ...edited, image: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(edited)}
            className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-600/20"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StreamDeckPanel() {
  const { gameState, streamDeckConfig, updateStreamDeckButton, updateState } = useStore();
  const { handleAction } = useSharedActions();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [focusPenaltyId, setFocusPenaltyId] = useState<string | null>(null);

  const homePlayers = gameState?.homeTeam.players ?? [];
  const awayPlayers = gameState?.awayTeam.players ?? [];
  const eventLog = gameState?.eventLog ?? [];

  const handleButtonClick = (button: StreamDeckButton) => {
    if (button.action !== "none") {
      handleAction(button.action);
    }
  };

  const resolveButtonColors = (button: StreamDeckButton) => {
    if (!gameState) return { bg: button.backgroundColor, text: button.textColor };

    // Special handling for toggleClock: Green when stopped, Red when running
    if (button.action === "toggleClock") {
        const isRunning = gameState.clock.isRunning;
        return {
            bg: isRunning ? "#991b1b" : "#065f46", // red-800 vs emerald-800
            text: "#ffffff"
        };
    }

    if (button.colorSource === "home") {
        return { bg: gameState.homeTeam.color, text: "#ffffff" };
    }
    if (button.colorSource === "away") {
        return { bg: gameState.awayTeam.color, text: "#ffffff" };
    }
    return { bg: button.backgroundColor, text: button.textColor };
  };

  const handlePenaltyChange = (team: "home" | "away", index: number, updated: any) => {
    if (!gameState) return;
    const teamKey = `${team}Team` as "homeTeam" | "awayTeam";
    const newPenalties = [...gameState[teamKey].penalties];
    newPenalties[index] = updated;
    updateState({ [teamKey]: { ...gameState[teamKey], penalties: newPenalties } });
  };

  const handlePenaltyRemove = (team: "home" | "away", index: number) => {
    if (!gameState) return;
    const teamKey = `${team}Team` as "homeTeam" | "awayTeam";
    const newPenalties = gameState[teamKey].penalties.filter((_, i) => i !== index);
    updateState({ [teamKey]: { ...gameState[teamKey], penalties: newPenalties } });
  };

  useEffect(() => {
    if (!gameState) return;
    const homeCount = gameState.homeTeam.penalties.length;
    const awayCount = gameState.awayTeam.penalties.length;
    
    // Simple heuristic: if a penalty was added, focus it
    const lastHome = gameState.homeTeam.penalties[homeCount - 1];
    if (lastHome && !lastHome.playerNumber && !lastHome.infraction) {
        setFocusPenaltyId(lastHome.id);
    }
    const lastAway = gameState.awayTeam.penalties[awayCount - 1];
    if (lastAway && !lastAway.playerNumber && !lastAway.infraction) {
        setFocusPenaltyId(lastAway.id);
    }
  }, [gameState?.homeTeam.penalties.length, gameState?.awayTeam.penalties.length]);

  if (!gameState) return null;

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
      <ScoreboardPreview />

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4 p-4 sm:p-6 bg-zinc-900/50 border border-zinc-800 rounded-3xl shadow-inner mb-8">
        {streamDeckConfig.buttons.map((button, index) => {
          // Resolve icon component from AVAILABLE_ICONS first, then fallback to LucideIcons
          const iconItem = AVAILABLE_ICONS.find(i => i.name === button.icon);
          const IconComponent = iconItem ? iconItem.icon : (button.icon ? (LucideIcons as any)[button.icon] : null);
          
          const { bg, text } = resolveButtonColors(button);

          return (
            <div key={button.id} className="relative group aspect-square">
              <button
                onClick={() => handleButtonClick(button)}
                style={{
                  backgroundColor: bg,
                  color: text,
                }}
                className="w-full h-full rounded-2xl flex flex-col items-center justify-center p-2 shadow-lg transition-all active:scale-95 hover:brightness-110 group-hover:shadow-indigo-500/10 overflow-hidden relative border border-white/5"
              >
                {button.image ? (
                  <img src={button.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                ) : null}

                <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2">
                  {IconComponent && <IconComponent size={28} className="drop-shadow-md" />}
                  <span className="text-[10px] sm:text-xs font-bold text-center leading-tight drop-shadow-sm px-1">
                    {button.label}
                  </span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
              </button>

              <button
                onClick={() => setEditingIndex(index)}
                className="absolute -top-1.5 -right-1.5 p-1.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-zinc-700 z-20 shadow-xl"
              >
                <Settings size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         {/* Home Active Reviews */}
         <div className="space-y-4">
            <GoalReviewPanel 
                team="home" 
                gameState={gameState} 
                eventLog={eventLog} 
                rosterPlayers={homePlayers} 
                updateState={updateState} 
            />
            <div className="space-y-2">
                {gameState.homeTeam.penalties.map((p, i) => (
                    <PenaltyItem
                        key={p.id}
                        penalty={p}
                        onChange={(u) => handlePenaltyChange("home", i, u)}
                        onRemove={() => handlePenaltyRemove("home", i)}
                        rosterPlayers={homePlayers}
                        autoFocusPlayer={p.id === focusPenaltyId}
                        onAutoFocusHandled={() => setFocusPenaltyId(null)}
                    />
                ))}
            </div>
         </div>

         {/* Away Active Reviews */}
         <div className="space-y-4">
            <GoalReviewPanel 
                team="away" 
                gameState={gameState} 
                eventLog={eventLog} 
                rosterPlayers={awayPlayers} 
                updateState={updateState} 
            />
            <div className="space-y-2">
                {gameState.awayTeam.penalties.map((p, i) => (
                    <PenaltyItem
                        key={p.id}
                        penalty={p}
                        onChange={(u) => handlePenaltyChange("away", i, u)}
                        onRemove={() => handlePenaltyRemove("away", i)}
                        rosterPlayers={awayPlayers}
                        autoFocusPlayer={p.id === focusPenaltyId}
                        onAutoFocusHandled={() => setFocusPenaltyId(null)}
                    />
                ))}
            </div>
         </div>
      </div>

      {editingIndex !== null && (
        <EditModal
          index={editingIndex}
          button={streamDeckConfig.buttons[editingIndex]}
          onClose={() => setEditingIndex(null)}
          onSave={(updatedButton) => {
            updateStreamDeckButton(editingIndex, updatedButton);
            setEditingIndex(null);
          }}
        />
      )}
    </div>
  );
}
