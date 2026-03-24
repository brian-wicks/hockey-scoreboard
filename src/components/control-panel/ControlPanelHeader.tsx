import {Bookmark, LayoutPanelTop, Settings, PresentationIcon, House} from "lucide-react";

interface ControlPanelHeaderProps {
  activeTab: "controls" | "settings" | "presets";
  setActiveTab: (tab: "controls" | "settings" | "presets") => void;
}

export default function ControlPanelHeader({ activeTab, setActiveTab }: ControlPanelHeaderProps) {
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        Hockey Scoreboard
      </h1>
      <div className="flex gap-2">
        <a
          href="/overlay"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <LayoutPanelTop size={16} />
          Open Overlay
        </a>
        <a
          href="/jumbotron"
          target="_blank"
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          <PresentationIcon size={16} />
          Open Jumbotron
        </a>
        <button
          onClick={() => setActiveTab("controls")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "controls" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
          }`}
        >
          <House size={16} />
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "settings" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
          }`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          onClick={() => setActiveTab("presets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "presets" ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700"
          }`}
          aria-label="Presets"
          title="Presets"
        >
          <Bookmark size={16} />
        </button>
      </div>
    </header>
  );
}
