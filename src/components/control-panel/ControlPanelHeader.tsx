import { AlertCircle, LayoutPanelTop, PresentationIcon, RotateCcw, Trophy } from "lucide-react";

interface ControlPanelHeaderProps {
  isConnected: boolean;
  onUndo: () => void;
  canUndo: boolean;
}

export default function ControlPanelHeader({ isConnected, onUndo, canUndo }: ControlPanelHeaderProps) {
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 sm:p-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
          {isConnected ? (
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" title="Connected to server" />
          ) : (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-red-500/15 text-red-400"
              title="Server connection lost"
            >
              <AlertCircle size={14} />
            </span>
          )}
          Hockey Scoreboard
        </h1>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          title="Undo last score/shots/penalty change"
        >
          <RotateCcw size={16} />
          <span className="hidden sm:inline">Undo</span>
        </button>
      </div>
      <div className="flex gap-1 sm:gap-2 flex-wrap justify-end">
        <a
          href="/overlay"
          target="_blank"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <LayoutPanelTop size={16} />
          <span className="hidden sm:inline">Open Overlay</span>
        </a>
        <a
          href="/jumbotron"
          target="_blank"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <PresentationIcon size={16} />
          <span className="hidden sm:inline">Open Jumbotron</span>
        </a>
        <a
          href="/results"
          target="_blank"
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <Trophy size={16} />
          <span className="hidden sm:inline">Open Results</span>
        </a>
      </div>
    </header>
  );
}
